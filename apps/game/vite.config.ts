import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react()],
  publicDir: fileURLToPath(new URL("../../public", import.meta.url)),
  build: { target: "es2022", chunkSizeWarningLimit: 1800 },
  server: { fs: { allow: ["../.."] }, proxy:{"/api":"http://127.0.0.1:4300","/uploads":"http://127.0.0.1:4300","/game-objects":"http://127.0.0.1:4300"} },
  preview:{proxy:{"/api":"http://127.0.0.1:4300","/uploads":"http://127.0.0.1:4300","/game-objects":"http://127.0.0.1:4300"}},
});
