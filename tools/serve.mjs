#!/usr/bin/env node
// Minimal static server for the web/ folder.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = process.argv[2] ?? "web";
const START_PORT = Number(process.argv[3] ?? 5173);
const MAX_PORT_TRIES = 20;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".css": "text/css; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    let path = normalize(join(ROOT, url === "/" ? "index.html" : url));
    if (!path.startsWith(normalize(ROOT))) { res.writeHead(403).end(); return; }
    let info;
    try {
      info = await stat(path);
    } catch {
      path = join(ROOT, "public", url); // Vite-style public/ fallback
      info = await stat(path);
    }
    if (info.isDirectory()) path = join(path, "index.html");
    const data = await readFile(path);
    res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
  }
});

// If the port is busy (e.g. another dev server is already running), take the next one.
function listen(port, triesLeft) {
  const onError = (err) => {
    server.off("listening", onListening);
    if (err.code === "EADDRINUSE" && triesLeft > 0 && port < 65535) {
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
