import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { orbitRouter } from "orbit-router";

export default defineConfig({
  plugins: [tailwindcss(), react(), orbitRouter()],
});
