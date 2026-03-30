import { defineConfig } from "vite";
import { orbitRpc } from "orbit-rpc";

export default defineConfig({
  plugins: [orbitRpc()],
  build: {
    ssr: "worker.ts",
    outDir: "dist",
    rollupOptions: {
      output: {
        entryFileNames: "worker.js",
      },
    },
  },
  ssr: {
    // Workers にはバンドルに全部含める（外部化しない）
    noExternal: true,
  },
});
