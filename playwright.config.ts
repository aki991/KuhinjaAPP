import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    ...devices["Pixel 7"],
    deviceScaleFactor: 1,
    browserName: "chromium",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_EXECUTABLE_PATH ||
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    },
    baseURL: "http://localhost:5188",
    trace: "retain-on-failure",
  },
  reporter: "list",
});
