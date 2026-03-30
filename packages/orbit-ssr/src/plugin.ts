import type { Plugin } from "vite";

export interface OrbitSSRConfig {
  /** index.html のパス（デフォルト: "index.html"） */
  entry?: string;
}

/**
 * Orbit SSR Vite プラグイン。
 *
 * 3つの仕事をする:
 * 1. virtual:orbit-ssr/app — SSR 用の React ツリー生成（Router + QueryProvider）
 * 2. dev サーバー: ページリクエストを SSR してレスポンス
 * 3. ビルド: Cloudflare Workers 用のサーバーエントリを生成
 */

const VIRTUAL_APP_ID = "virtual:orbit-ssr/app";
const RESOLVED_VIRTUAL_APP_ID = `\0${VIRTUAL_APP_ID}`;

const VIRTUAL_SERVER_ENTRY_ID = "virtual:orbit-ssr/server-entry";
const RESOLVED_VIRTUAL_SERVER_ENTRY_ID = `\0${VIRTUAL_SERVER_ENTRY_ID}`;

const VIRTUAL_CLIENT_ENTRY_ID = "virtual:orbit-ssr/client-entry";
const RESOLVED_VIRTUAL_CLIENT_ENTRY_ID = `\0${VIRTUAL_CLIENT_ENTRY_ID}`;

export function orbitSSR(config: OrbitSSRConfig = {}): Plugin[] {
  const entryHtml = config.entry ?? "index.html";
  let root: string;

  return [
    {
      name: "orbit-ssr:virtual-modules",

      configResolved(resolvedConfig) {
        root = resolvedConfig.root;
      },

      resolveId(id) {
        if (id === VIRTUAL_APP_ID) return RESOLVED_VIRTUAL_APP_ID;
        if (id === VIRTUAL_SERVER_ENTRY_ID) return RESOLVED_VIRTUAL_SERVER_ENTRY_ID;
        if (id === VIRTUAL_CLIENT_ENTRY_ID) return RESOLVED_VIRTUAL_CLIENT_ENTRY_ID;
      },

      load(id) {
        if (id === RESOLVED_VIRTUAL_APP_ID) {
          return generateAppModule();
        }
        if (id === RESOLVED_VIRTUAL_SERVER_ENTRY_ID) {
          return generateServerEntry();
        }
        if (id === RESOLVED_VIRTUAL_CLIENT_ENTRY_ID) {
          return generateClientEntry();
        }
      },
    },

    {
      name: "orbit-ssr:dev-server",

      configureServer(server) {
        // Vite のデフォルト HTML 配信より前に SSR middleware を挿入
        server.middlewares.use(async (req, res, next) => {
          const url = req.url;
          // 静的アセット・RPC・Vite 内部リクエストはスキップ
          if (
            !url ||
            url.startsWith("/rpc") ||
            url.startsWith("/@") ||
            url.startsWith("/__") ||
            url.startsWith("/node_modules") ||
            url.includes(".")
          ) {
            return next();
          }

          try {
            // 1. index.html を読み込み、Vite の変換を通す
            const fs = await import("node:fs");
            const path = await import("node:path");
            const htmlPath = path.default.resolve(root, entryHtml);
            let html = fs.default.readFileSync(htmlPath, "utf-8");
            html = await server.transformIndexHtml(url, html);

            // 2. SSR 用モジュールをロード
            const { renderApp } = await server.ssrLoadModule(VIRTUAL_APP_ID);

            // 3. React を HTML にレンダリング
            const { html: appHtml, dehydratedState } = await renderApp(url);

            // 4. dehydrated state を注入
            const stateScript = `<script>window.__ORBIT_DATA__=${JSON.stringify(dehydratedState).replace(/</g, "\\u003c")}</script>`;

            // 5. #root に SSR 結果を注入
            html = html.replace(
              '<div id="root"></div>',
              `<div id="root">${appHtml}</div>${stateScript}`,
            );

            // 6. main.tsx を client entry に差し替え
            html = html.replace(
              /\/src\/main\.tsx[^"]*/,
              `/@id/__x00__${VIRTUAL_CLIENT_ENTRY_ID}`,
            );

            res.setHeader("Content-Type", "text/html");
            res.end(html);
          } catch (err) {
            server.ssrFixStacktrace(err as Error);
            console.error("[orbit-ssr]", err);
            next(err);
          }
        });
      },
    },
  ];
}

/**
 * virtual:orbit-ssr/app
 *
 * サーバーサイドで React アプリをレンダリングする関数を提供する。
 * dev middleware と本番 Worker の両方から使われる。
 */
function generateAppModule(): string {
  return `
import { renderToReadableStream } from "react-dom/server";
import { createElement } from "react";
import { routes, NotFound } from "virtual:orbit-router/routes";
import { Router } from "orbit-router";
import { createQueryClient, QueryProvider } from "orbit-query";

export async function renderApp(url) {
  const queryClient = createQueryClient();

  const tree = createElement(
    QueryProvider,
    { client: queryClient },
    createElement(Router, { routes, NotFound, url })
  );

  const stream = await renderToReadableStream(tree);
  await stream.allReady;

  const chunks = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const html = new TextDecoder().decode(
    chunks.reduce((acc, chunk) => {
      const merged = new Uint8Array(acc.length + chunk.length);
      merged.set(acc);
      merged.set(chunk, acc.length);
      return merged;
    }, new Uint8Array())
  );

  const dehydratedState = queryClient.dehydrate();

  return { html, dehydratedState };
}
`;
}

/**
 * virtual:orbit-ssr/client-entry
 *
 * CSR の main.tsx に代わるクライアントエントリ。
 * サーバーから受け取った dehydrated state を hydrate してから React を起動する。
 */
function generateClientEntry(): string {
  return `
import { hydrateRoot } from "react-dom/client";
import { createElement, StrictMode } from "react";
import { routes, NotFound } from "virtual:orbit-router/routes";
import { Router } from "orbit-router";
import { createQueryClient, QueryProvider } from "orbit-query";

const queryClient = createQueryClient();

if (window.__ORBIT_DATA__) {
  queryClient.hydrate(window.__ORBIT_DATA__);
}

hydrateRoot(
  document.getElementById("root"),
  createElement(
    StrictMode,
    null,
    createElement(
      QueryProvider,
      { client: queryClient },
      createElement(Router, { routes, NotFound })
    )
  )
);
`;
}

/**
 * virtual:orbit-ssr/server-entry
 *
 * Cloudflare Workers 用のサーバーエントリ。
 * RPC ルート（orbit-rpc）と SSR ページレンダリングを統合した Hono アプリ。
 */
function generateServerEntry(): string {
  return `
import { Hono } from "hono";
import rpcApp from "virtual:orbit-rpc/server";
import { renderApp } from "virtual:orbit-ssr/app";

const app = new Hono();

// RPC エンドポイント
app.route("/", rpcApp);

// 静的アセットは Workers Sites / Pages が配信する想定

// SSR: すべてのページリクエスト
app.get("*", async (c) => {
  const url = new URL(c.req.url);
  const { html: appHtml, dehydratedState } = await renderApp(url.pathname + url.search);

  const stateScript = \`<script>window.__ORBIT_DATA__=\${JSON.stringify(dehydratedState).replace(/</g, "\\\\u003c")}</script>\`;

  const html = \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Orbit App</title>
  <!-- TODO: client assets injection -->
</head>
<body>
  <div id="root">\${appHtml}</div>
  \${stateScript}
  <!-- TODO: client JS bundle -->
</body>
</html>\`;

  return c.html(html);
});

export default app;
`;
}
