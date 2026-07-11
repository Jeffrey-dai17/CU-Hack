import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "localhost",
    port: 5173,
    strictPort: true,
  },
  test: {
    include: ["src/**/*.test.{js,jsx}"],
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        pretendToBeVisual: true,
        url: "http://localhost:5173/",
      },
    },
    setupFiles: ["./src/test/setup.js"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/test/**"],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 80,
      },
    },
  },
});
