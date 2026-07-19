// @ts-check
const { defineConfig } = require("@playwright/test");

/**
 * The e2e suite runs against the production build, served by e2e/server.js the way
 * GitHub Pages serves the real site (path prefix + 404.html SPA fallback), and fetches
 * live FactorioLab data — so it also acts as a canary for upstream data-format drift.
 *
 * In sandboxed environments where outbound HTTPS goes through an agent proxy
 * (HTTPS_PROXY set), the browser is pointed at it for https:// only, so the local
 * http:// test server stays direct.
 */
const PORT = 8129;
const proxied = !!process.env.HTTPS_PROXY && !process.env.CI;

module.exports = defineConfig({
    testDir: "./e2e",
    timeout: 60000,
    expect: { timeout: 20000 },
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: `http://127.0.0.1:${PORT}/factorio-item-browser`,
        trace: "on-first-retry",
        ...(proxied
            ? {
                  proxy: { server: `https=${process.env.HTTPS_PROXY}` },
                  ignoreHTTPSErrors: true,
              }
            : {}),
    },
    projects: [
        {
            name: "chromium",
            use: {
                browserName: "chromium",
                ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
                    ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
                    : {}),
            },
        },
    ],
    webServer: {
        command: "npm run e2e:serve",
        url: `http://127.0.0.1:${PORT}/factorio-item-browser/`,
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
    },
});
