import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Track JSON lives in the repo-level data/ folder.
  server: { fs: { allow: ["../.."] }, port: 5173 },
});
