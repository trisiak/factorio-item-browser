/**
 * Static server simulating GitHub Pages for the e2e tests: serves build/ under the
 * project-site path prefix and answers every unknown path with 404.html (status 404),
 * which is exactly how the deployed SPA fallback behaves.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const BUILD = path.join(__dirname, "..", "build");
const PORT = parseInt(process.env.E2E_PORT || "8129", 10);
const PREFIX = "/factorio-item-browser";

const MIME = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".webmanifest": "application/manifest+json",
    ".ico": "image/x-icon",
    ".png": "image/png",
};

if (!fs.existsSync(path.join(BUILD, "404.html"))) {
    console.error("build/404.html is missing - run the production build first (see the e2e:serve script).");
    process.exit(1);
}

http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = null;
    let status = 200;

    if (urlPath.startsWith(PREFIX)) {
        const relative = urlPath.slice(PREFIX.length).replace(/^\//, "") || "index.html";
        const candidate = path.join(BUILD, relative);
        if (candidate.startsWith(BUILD) && fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
            file = candidate;
        }
    }
    if (!file) {
        file = path.join(BUILD, "404.html");
        status = 404;
    }

    res.writeHead(status, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
    console.log(`e2e server: http://127.0.0.1:${PORT}${PREFIX}/ (build: ${BUILD})`);
});
