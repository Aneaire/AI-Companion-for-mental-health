import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";

// const ReactCompilerConfig = {
//   target: "19", // '17' | '18' | '19'
// };
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
    // ["babel-plugin-react-compiler", ReactCompilerConfig],
  ],
  test: {
    globals: true,
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@server": resolve(__dirname, "../server"),
    },
  },
  optimizeDeps: {
    include: ["@formkit/auto-animate/react"],
  },
  build: {
    typescript: {
      tsconfig: "./tsconfig.json",
      // Here, we specify to ignore errors
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
