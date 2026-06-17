/**
 * Tiny static file server for the portable .exe build.
 * Serves dist/web (embedded via pkg, or folder next to the .exe).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = Number(process.env.FANTASY_BUILD_PORT) || 3847;
const HOST = "127.0.0.1";

function resolveWebRoot() {
  const besideExe = path.join(path.dirname(process.execPath), "web");
  if (fs.existsSync(besideExe)) return besideExe;

  const embedded = path.join(__dirname, "dist", "web");
  if (fs.existsSync(embedded)) return embedded;

  const devOut = path.join(__dirname, "..", "out");
  if (fs.existsSync(devOut)) return devOut;

  return besideExe;
}

const WEB_ROOT = resolveWebRoot();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function openBrowser(url) {
  if (process.platform === "win32") {
    exec(`start "" "${url}"`, { windowsHide: true });
  } else if (process.platform === "darwin") {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

function handler(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath.endsWith("/")) urlPath += "index.html";

  let filePath = path.join(WEB_ROOT, urlPath);

  if (!filePath.startsWith(WEB_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      return sendFile(res, path.join(filePath, "index.html"));
    }
    if (!err && stat.isFile()) {
      return sendFile(res, filePath);
    }

    // SPA / client-side routes: fall back to index.html
    const fallback = path.join(WEB_ROOT, "index.html");
    if (fs.existsSync(fallback)) {
      return sendFile(res, fallback);
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });
}

function main() {
  if (!fs.existsSync(WEB_ROOT)) {
    console.error("");
    console.error("  Game files not found.");
    console.error("  Expected a 'web' folder next to this program, or an embedded build.");
    console.error("");
    if (process.platform === "win32") {
      require("readline")
        .createInterface({ input: process.stdin, output: process.stdout })
        .question("Press Enter to exit...", () => process.exit(1));
    } else {
      process.exit(1);
    }
    return;
  }

  const server = http.createServer(handler);
  server.listen(PORT, HOST, () => {
    const url = `http://${HOST}:${PORT}/`;
    console.log("");
    console.log("  Fantasy Build");
    console.log(`  ${url}`);
    console.log("");
    console.log("  Keep this window open while you play.");
    console.log("  Close it or press Ctrl+C to quit.");
    console.log("");
    setTimeout(() => openBrowser(url), 500);
  });

  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.error(`  Port ${PORT} is in use. Close the other Fantasy Build window and try again.`);
    } else {
      console.error("  Server error:", e.message);
    }
    process.exit(1);
  });
}

main();
