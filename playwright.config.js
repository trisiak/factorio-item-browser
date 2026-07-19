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

// Chromium launch options are shared by the default and the tour projects.
const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
    : {};

module.exports = defineConfig({
    testDir: "./e2e",
    timeout: 60000,
    expect: { timeout: 20000 },
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: `http://127.0.0.1:${PORT}/factorio-item-browser`,
        trace: "on-first-retry",
        // On CI, record a screenshot at the end of every test so the uploaded HTML
        // report doubles as a visual gallery of the rendered UI (green runs included),
        // not just a pass/fail log. Off locally to avoid cluttering test-results/.
        screenshot: process.env.CI ? "on" : "off",
        ...(proxied
            ? {
                  proxy: { server: `https=${process.env.HTTPS_PROXY}` },
                  ignoreHTTPSErrors: true,
              }
            : {}),
    },
    projects: [
        {
            // The functional suite. The curated visual tour is kept out of it so the
            // default `npm run test:e2e` (and the CI job) stays a fast pass/fail check.
            name: "chromium",
            testIgnore: /tour\.spec\.ts/,
            use: { browserName: "chromium", ...launchOptions },
        },
        {
            // Opt-in visual tour: `npm run test:e2e:tour`. Walks the key UX surfaces and
            // writes full-page screenshots (see e2e/tour.spec.ts). Not wired into CI on
            // push — run it on demand when a change needs visual review.
            name: "tour",
            testMatch: /tour\.spec\.ts/,
            use: { browserName: "chromium", ...launchOptions },
        },
    ],
    webServer: {
        command: "npm run e2e:serve",
        url: `http://127.0.0.1:${PORT}/factorio-item-browser/`,
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
    },
});
