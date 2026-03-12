import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /api/* calls to the local backend during development,
    // so you don't have to hard-code localhost URLs in your components.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        // No rewrite — backend now has /api prefix on all routes,
        // so /api/chat proxies to localhost:8000/api/chat as-is.
      },
    },
  },
});
