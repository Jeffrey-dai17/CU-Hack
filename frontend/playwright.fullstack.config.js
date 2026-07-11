import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const frontendDirectory = fileURLToPath(new URL(".", import.meta.url));
const repositoryDirectory = fileURLToPath(new URL("..", import.meta.url));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export default defineConfig({
  testDir: "./e2e-fullstack",
  outputDir: "./test-results/fullstack",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    browserName: "chromium",
    channel: "msedge",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "node backend/testSupport/fullStackServer.cjs",
      cwd: repositoryDirectory,
      url: "http://localhost:3000/api/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `${npmCommand} run dev`,
      cwd: frontendDirectory,
      env: { VITE_API_BASE_URL: "http://localhost:3000/api" },
      url: "http://localhost:5173",
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
