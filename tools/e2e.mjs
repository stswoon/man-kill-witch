#!/usr/bin/env node
// Runs Playwright e2e on a free port with a unique output directory and a hard
// timeout. Stale e2e servers/artifacts from earlier runs are cleaned first, so a
// crashed run cannot block the next one with "port 4173 is already used".
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { rm, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const BASE_PORT = Number(process.env.PW_PORT ?? 4173);
const PORT_TRIES = Number(process.env.PW_PORT_TRIES ?? 20);
const TIMEOUT_MS = Number(process.env.PW_TIMEOUT_MS ?? 10 * 60_000);
const WORKERS = process.env.PW_WORKERS ?? "1";
const STALE_RUN_MS = Number(process.env.PW_STALE_RUN_MS ?? 2 * 60 * 60_000);
const STALE_SERVER_MS = Number(process.env.PW_STALE_SERVER_MS ?? 15 * 60_000);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const OUTPUT = join(ROOT, "test-results", `run-${stamp}-${process.pid}`);

const PAST_MS = (ms) => Date.now() - ms;

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    const done = (free) => {
      server.removeAllListeners();
      resolve(free);
    };
    server.once("error", () => done(false));
    server.once("listening", () => server.close(() => done(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function pickPort() {
  for (let port = BASE_PORT; port < BASE_PORT + PORT_TRIES; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`no free e2e port in ${BASE_PORT}..${BASE_PORT + PORT_TRIES - 1}`);
}

async function removeOldRuns() {
  const roots = [join(ROOT, "test-results"), join(ROOT, ".temp")];
  for (const root of roots) {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("pw-") && !entry.name.startsWith("run-")) continue;
      const path = join(root, entry.name);
      try {
        const info = await stat(path);
        if (info.mtimeMs < PAST_MS(STALE_RUN_MS)) await rm(path, { recursive: true, force: true });
      } catch {
        // Another process may be removing it concurrently; ignore.
      }
    }
  }
}

// Only e2e servers on ports 4173..4192 that are already stale are killed.
// Dev servers on 5173/5174 are never touched.
function killStaleServers() {
  if (process.platform !== "win32") return;
  try {
    const script = [
      "$cutoff=(Get-Date).AddMilliseconds(-" + STALE_SERVER_MS + ");",
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" |",
      "Where-Object { $_.CommandLine -match 'tools[\\\\/]serve\\.mjs' -and $_.CommandLine -match '\\b41(7[3-9]|8[0-9]|9[0-2])\\b' -and $_.CreationDate -lt $cutoff } |",
      "ForEach-Object { taskkill /PID $_.ProcessId /T /F 2>$null }",
    ].join(" ");
    execFileSync("powershell", ["-NoProfile", "-Command", script], { stdio: "ignore" });
  } catch {
    // Cleanup is best-effort; a stale server on the chosen port is skipped by pickPort().
  }
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    // Already gone.
  }
}

async function main() {
  await removeOldRuns();
  killStaleServers();
  const port = await pickPort();
  const env = {
    ...process.env,
    PW_PORT: String(port),
    PW_OUTPUT: OUTPUT,
    PW_WORKERS: WORKERS,
  };
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const args = ["playwright", "test", ...process.argv.slice(2)];
  console.log(`[e2e] port=${port} workers=${WORKERS} output=${OUTPUT}`);
  const child = spawn(npx, args, { cwd: ROOT, env, stdio: "inherit", windowsHide: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    console.error(`[e2e] timeout after ${TIMEOUT_MS} ms; killing the run`);
    killTree(child);
  }, TIMEOUT_MS);
  const stop = () => killTree(child);
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const code = await new Promise((resolve) => {
    child.once("error", (err) => {
      console.error(`[e2e] failed to start Playwright: ${err.message}`);
      resolve(1);
    });
    child.once("exit", (value) => resolve(value ?? 1));
  });
  clearTimeout(timer);
  if (timedOut) process.exitCode = 124;
  else process.exitCode = code;
}

main().catch((err) => {
  console.error(`[e2e] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
