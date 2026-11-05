// Invoked only inside demo emulators by test-preproduction.mjs --review.
import { spawnSync } from "node:child_process";
import { createServer, request } from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { resolve, extname } from "node:path";
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  !process.env.FIREBASE_STORAGE_EMULATOR_HOST
)
  throw Error("EMULATORS_REQUIRED");
for (const [command, args, env] of [
  [
    process.execPath,
    ["scripts/build-website.mjs"],
    { ...process.env, AROHA_ENVIRONMENT: "pre-prod", AROHA_EMULATORS: "1" },
  ],
  [
    process.execPath,
    ["scripts/delivery/run-node-tests.mjs", "preprod-integration"],
    process.env,
  ],
]) {
  const r = spawnSync(command, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
await build({
  stdin: {
    contents: `import {emulatorLogin} from './website/firebase-auth.mjs';import {finishGuestSignIn} from './website/guest-signin-return.mjs';document.querySelector('form').onsubmit=async e=>{e.preventDefault();const email=document.querySelector('select').value;await emulatorLogin(email);finishGuestSignIn();};`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: "esm",
  outfile: "dist-preprod/review-login.js",
  define: {
    __AROHA_EMULATORS__: "true",
    __AROHA_ENVIRONMENT__: JSON.stringify("pre-prod"),
  },
});
const collector = createServer(async (req, res) => {
  for await (const chunk of req) {
  }
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({ data: { id: "synthetic-browser-review" }, error: null }),
  );
});
collector.listen(17881, "127.0.0.1");
const root = resolve("dist-preprod"),
  types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".woff2": "font/woff2",
    ".webp": "image/webp",
    ".png": "image/png",
    ".mp4": "video/mp4",
  };
const server = createServer(async (req, res) => {
  if (req.url === "/review-sign-in/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      '<!doctype html><title>Local synthetic sign-in</title><h1>LOCAL EMULATOR REVIEW ONLY</h1><p>No real Google account, booking or email.</p><form><label>Synthetic account <select><option>guest@example.test</option><option>owner@example.test</option></select></label><button>Sign in to emulator</button></form><script type="module" src="/review-login.js"></script>',
    );
    return;
  }
  if (req.url.startsWith("/api/v1/")) {
    const proxy = request(
      {
        hostname: "127.0.0.1",
        port: 5001,
        path: "/demo-aroha/asia-south2/arohaApi" + req.url,
        method: req.method,
        headers: req.headers,
      },
      (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      },
    );
    proxy.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(proxy);
    return;
  }
  try {
    const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      ),
      file = resolve(
        root,
        "." + pathname + (pathname.endsWith("/") ? "index.html" : ""),
      );
    if (!file.startsWith(root + "/")) throw Error("INVALID_PATH");
    const bytes = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(8770, "127.0.0.1", () =>
  console.log(
    "Isolated emulator browser review: http://127.0.0.1:8770/book/ — synthetic guest@example.test / owner@example.test only.",
  ),
);
function stop() {
  server.close();
  collector.close();
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
