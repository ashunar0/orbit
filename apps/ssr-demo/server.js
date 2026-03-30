import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer as createViteServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer() {
  const app = express();

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*all", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      // index.html を読み込んで Vite の HTML 変換を通す
      let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
      template = await vite.transformIndexHtml(url, template);

      // サーバーエントリをロード
      const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");

      // SSR レンダリング
      const { html: appHtml, dehydratedState } = render(url);

      // dehydrated state を埋め込む
      const dehydratedScript = `<script>window.__ORBIT_DATA__ = ${JSON.stringify(dehydratedState)}</script>`;

      // HTML にアプリの出力を注入
      const html = template
        .replace("<!--app-head-->", dehydratedScript)
        .replace("<!--app-html-->", appHtml);

      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  app.listen(5174, () => {
    console.log("SSR server running at http://localhost:5174");
  });
}

createServer();
