import { type Plugin, build as viteBuild } from "vite";

export interface OrbitSSRConfig {
  /** index.html のパス（デフォルト: "index.html"） */
  entry?: string;
  /** orbit-rpc の Hono アプリを統合する（デフォルト: false） */
  rpc?: boolean;
}

/**
 * Orbit SSR Vite プラグイン。
 *
 * 3つの仕事をする:
 * 1. virtual:orbit-ssr/app — SSR 用の React ツリー生成（Router + QueryProvider）
 * 2. dev サーバー: ページリクエストを SSR してレスポンス
 * 3. ビルド: client build 後に Cloudflare Workers 用 server build を自動実行
 */

const VIRTUAL_APP_ID = "virtual:orbit-ssr/app";
const RESOLVED_VIRTUAL_APP_ID = `\0${VIRTUAL_APP_ID}`;

const VIRTUAL_SERVER_ENTRY_ID = "virtual:orbit-ssr/server-entry";
const RESOLVED_VIRTUAL_SERVER_ENTRY_ID = `\0${VIRTUAL_SERVER_ENTRY_ID}`;

const VIRTUAL_CLIENT_ENTRY_ID = "virtual:orbit-ssr/client-entry";
const RESOLVED_VIRTUAL_CLIENT_ENTRY_ID = `\0${VIRTUAL_CLIENT_ENTRY_ID}`;

/** JSON を HTML <script> 内に安全に埋め込むためのエスケープ */
function escapeJsonForHtml(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Vite manifest からエントリの CSS / JS アセットパスを抽出 */
function extractAssetsFromManifest(manifest: Record<string, ManifestEntry>): {
  css: string[];
  js: string[];
} {
  const css: string[] = [];
  const js: string[] = [];

  for (const entry of Object.values(manifest)) {
    if (entry.isEntry) {
      if (entry.file) js.push(`/${entry.file}`);
      if (entry.css) css.push(...entry.css.map((f) => `/${f}`));
    }
  }

  return { css, js };
}

interface ManifestEntry {
  file: string;
  isEntry?: boolean;
  css?: string[];
  imports?: string[];
}

export function orbitSSR(config: OrbitSSRConfig = {}): Plugin[] {
  const entryHtml = config.entry ?? "index.html";
  const useRpc = config.rpc ?? false;
  let root: string;
  let isSsrBuild = false;
  // client build → server build へのマニフェスト受け渡し用
  let clientManifest: Record<string, ManifestEntry> | null = null;
  // server build 内では vite.config のプラグインも再利用されるため、
  // 同一プロセスの closeBundle が再帰しないようフラグで制御
  let isServerBuildPhase = false;

  return [
    {
      name: "orbit-ssr:virtual-modules",

      config(userConfig, env) {
        if (env.command !== "build") return;

        isSsrBuild = !!userConfig.build?.ssr;

        if (isSsrBuild) {
          // Server build: Workers 向け
          return {
            build: {
              outDir: "dist/server",
              copyPublicDir: false,
              rollupOptions: {
                output: { entryFileNames: "index.js" },
              },
            },
            ssr: {
              target: "webworker",
              noExternal: true,
            },
            resolve: {
              conditions: ["workerd", "worker", "browser"],
            },
          };
        }

        // Client build: manifest 付きで dist/client に出力
        return {
          build: {
            manifest: true,
            outDir: "dist/client",
          },
        };
      },

      configResolved(resolvedConfig) {
        root = resolvedConfig.root;
      },

      resolveId(id) {
        if (id === VIRTUAL_APP_ID) return RESOLVED_VIRTUAL_APP_ID;
        if (id === VIRTUAL_SERVER_ENTRY_ID)
          return RESOLVED_VIRTUAL_SERVER_ENTRY_ID;
        if (id === VIRTUAL_CLIENT_ENTRY_ID)
          return RESOLVED_VIRTUAL_CLIENT_ENTRY_ID;
      },

      async load(id) {
        if (id === RESOLVED_VIRTUAL_APP_ID) {
          return generateAppModule();
        }
        if (id === RESOLVED_VIRTUAL_SERVER_ENTRY_ID) {
          // server build 時は client manifest を読んでアセットタグを生成
          if (!clientManifest) {
            clientManifest = await readClientManifest(root);
          }
          return generateServerEntry(useRpc, clientManifest);
        }
        if (id === RESOLVED_VIRTUAL_CLIENT_ENTRY_ID) {
          const cssImports = await extractCssImports(root);
          return generateClientEntry(cssImports);
        }
      },

      // client build 時: main.tsx → client-entry に差し替え
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          if (isSsrBuild) return;
          return html.replace(/\/src\/main\.tsx[^"]*/, VIRTUAL_CLIENT_ENTRY_ID);
        },
      },

      // client build 完了後に server build を自動実行
      async closeBundle() {
        // SSR build 側や dev では何もしない
        if (isSsrBuild || isServerBuildPhase) return;

        // dev mode（command === 'serve'）では closeBundle は呼ばれないが念のため
        const fs = await import("node:fs");
        const path = await import("node:path");
        const manifestPath = path.default.resolve(
          root,
          "dist/client/.vite/manifest.json",
        );
        if (!fs.default.existsSync(manifestPath)) return;

        console.log("\n[orbit-ssr] Client build done. Starting server build...");
        isServerBuildPhase = true;

        // マニフェストを読んで共有変数にセット
        clientManifest = JSON.parse(
          fs.default.readFileSync(manifestPath, "utf-8"),
        );

        // Rolldown は virtual module をエントリとして直接解決できないため、
        // proxy ファイルを経由して virtual module を import する
        const proxyDir = path.default.resolve(root, "node_modules/.orbit-ssr");
        fs.default.mkdirSync(proxyDir, { recursive: true });
        const proxyEntry = path.default.resolve(proxyDir, "server-entry.js");
        fs.default.writeFileSync(
          proxyEntry,
          `export { default } from "${VIRTUAL_SERVER_ENTRY_ID}";\n`,
        );

        // server build を実行（同じ vite.config を使う）
        const viteConfigPath = path.default.resolve(root, "vite.config.ts");
        await viteBuild({
          configFile: fs.default.existsSync(viteConfigPath)
            ? viteConfigPath
            : undefined,
          root,
          build: {
            ssr: proxyEntry,
          },
        });

        console.log("[orbit-ssr] Server build done → dist/server/index.js");
        isServerBuildPhase = false;
      },
    },

    {
      name: "orbit-ssr:dev-server",
      apply: "serve",

      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url;
          if (
            !url ||
            url.startsWith("/rpc") ||
            url.startsWith("/@") ||
            url.startsWith("/__") ||
            url.startsWith("/node_modules") ||
            /\.[^/]+$/.test(url)
          ) {
            return next();
          }

          try {
            const fs = await import("node:fs");
            const path = await import("node:path");
            const htmlPath = path.default.resolve(root, entryHtml);
            let html = fs.default.readFileSync(htmlPath, "utf-8");
            html = await server.transformIndexHtml(url, html);

            const { renderApp } = await server.ssrLoadModule(VIRTUAL_APP_ID);
            const { html: appHtml, dehydratedState } = await renderApp(url);

            const stateScript = `<script>window.__ORBIT_DATA__=${escapeJsonForHtml(JSON.stringify(dehydratedState))}</script>`;

            html = html.replace(
              '<div id="root"></div>',
              `<div id="root">${appHtml}</div>${stateScript}`,
            );

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
 * main.tsx から CSS の import 文を抽出する。
 * 例: import "./app.css" → "/src/app.css"
 */
async function extractCssImports(root: string): Promise<string[]> {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const candidates = ["src/main.tsx", "src/main.ts"];
  let mainContent = "";
  for (const candidate of candidates) {
    const fullPath = path.default.resolve(root, candidate);
    if (fs.default.existsSync(fullPath)) {
      mainContent = fs.default.readFileSync(fullPath, "utf-8");
      break;
    }
  }

  if (!mainContent) return [];

  const cssImports: string[] = [];
  for (const match of mainContent.matchAll(/import\s+["']([^"']+\.css)["']/g)) {
    const importPath = match[1];
    if (importPath.startsWith(".")) {
      cssImports.push(`/src/${importPath.replace(/^\.\//, "")}`);
    } else {
      cssImports.push(importPath);
    }
  }

  return cssImports;
}

/**
 * dist/client/.vite/manifest.json を読む。
 * client build 前（dev mode 等）では null を返す。
 */
async function readClientManifest(
  root: string,
): Promise<Record<string, ManifestEntry> | null> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const manifestPath = path.default.resolve(
    root,
    "dist/client/.vite/manifest.json",
  );
  if (!fs.default.existsSync(manifestPath)) return null;
  return JSON.parse(fs.default.readFileSync(manifestPath, "utf-8"));
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
function generateClientEntry(cssImports: string[]): string {
  const cssLines = cssImports.map((p) => `import "${p}";`).join("\n");
  return `
import { hydrateRoot } from "react-dom/client";
import { createElement, StrictMode } from "react";
import { routes, NotFound } from "virtual:orbit-router/routes";
import { Router } from "orbit-router";
import { createQueryClient, QueryProvider } from "orbit-query";
${cssLines}

const queryClient = createQueryClient();

if (window.__ORBIT_DATA__) {
  queryClient.hydrate(window.__ORBIT_DATA__);
}

const root = document.getElementById("root");
if (!root) throw new Error("[orbit-ssr] #root element not found");

hydrateRoot(
  root,
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
 * SSR ページレンダリング（+ オプションで orbit-rpc の RPC ルート統合）の Hono アプリ。
 */
function generateServerEntry(
  useRpc: boolean,
  manifest: Record<string, ManifestEntry> | null,
): string {
  const rpcImport = useRpc
    ? `import rpcApp from "virtual:orbit-rpc/server";\n`
    : "";
  const rpcRoute = useRpc
    ? `\n// RPC エンドポイント\napp.route("/", rpcApp);\n`
    : "";

  // マニフェストからアセットタグを生成
  let cssLinks = "";
  let jsScripts = "";
  if (manifest) {
    const assets = extractAssetsFromManifest(manifest);
    cssLinks = assets.css
      .map((f) => `<link rel="stylesheet" href="${f}">`)
      .join("\n  ");
    jsScripts = assets.js
      .map((f) => `<script type="module" src="${f}"></script>`)
      .join("\n  ");
  }

  return `
import { Hono } from "hono";
${rpcImport}import { renderApp } from "virtual:orbit-ssr/app";

/** JSON を HTML <script> 内に安全に埋め込むためのエスケープ */
function escapeJsonForHtml(json) {
  return json
    .replace(/</g, "\\\\u003c")
    .replace(/>/g, "\\\\u003e")
    .replace(/&/g, "\\\\u0026");
}

const app = new Hono();
${rpcRoute}
// SSR: すべてのページリクエスト
app.get("*", async (c) => {
  const url = new URL(c.req.url);
  const { html: appHtml, dehydratedState } = await renderApp(url.pathname + url.search);

  const stateScript = \`<script>window.__ORBIT_DATA__=\${escapeJsonForHtml(JSON.stringify(dehydratedState))}</script>\`;

  const html = \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Orbit App</title>
  ${cssLinks}
</head>
<body>
  <div id="root">\${appHtml}</div>
  \${stateScript}
  ${jsScripts}
</body>
</html>\`;

  return c.html(html);
});

export default app;
`;
}
