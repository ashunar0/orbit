import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { orbitRouter } from "orbit-router";

export default defineConfig({
  plugins: [react(), orbitRouter()],
});
