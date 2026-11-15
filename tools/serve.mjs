#!/usr/bin/env node
// Minimal static server for the built build/ folder.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = process.argv[2] ?? "build";
const START_PORT = Number(process.argv[3] ?? 5173);
// Playwright pins the URL, so it asks the server to fail on a busy port
// instead of silently moving to the next one.
const STRICT_PORT = process.argv.includes("--strict");
const MAX_PORT_TRIES = 20;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".css": "text/css; charset=utf-8",
};

async function handle(req, res) {
  try {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    let path = normalize(join(ROOT, url === "/" ? "index.html" : url));
    if (!path.startsWith(normalize(ROOT))) { res.writeHead(403).end(); return; }
    const info = await stat(path);
    if (info.isDirectory()) path = join(path, "index.html");
    const data = await readFile(path);
    if (res.writableEnded || res.destroyed) return;
    res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    res.end(data);
  } catch (err) {
    // A browser that closes a page mid-download aborts the socket; that is not
    // a server failure, and an unhandled rejection here would kill the process
    // in the middle of a Playwright run.
    if (res.writableEnded || res.destroyed) return;
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    void err;
  }
}

const server = createServer((req, res) => {
  void handle(req, res).catch(() => res.destroy());
});

// Broken pipes from cancelled requests must not take the server down.
server.on("clientError", (_err, socket) => socket.destroy());

// If the port is busy (e.g. another dev server is already running), take the next one.
function listen(port, triesLeft) {
  const onError = (err) => {
    server.off("listening", onListening);
    if (!STRICT_PORT && err.code === "EADDRINUSE" && triesLeft > 0 && port < 65535) {
      console.warn(`port ${port} is busy, trying ${port + 1}`);
      listen(port + 1, triesLeft - 1);
      return;
    }
    console.error(err.message);
    process.exitCode = 1;
  };
  const onListening = () => {
    server.off("error", onError);
    server.on("error", (err) => console.error(err.message));
    console.log(`http://localhost:${port}`);
  };
  server.once("error", onError);
  server.once("listening", onListening);
  server.listen(port);
}

listen(START_PORT, MAX_PORT_TRIES);
