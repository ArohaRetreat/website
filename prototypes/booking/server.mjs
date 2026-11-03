import http from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import os from "node:os";
import { build } from "esbuild";
import {
  seed,
  command,
  snapshot,
  availability,
  expire,
  BookingError,
} from "./domain.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
function validate(schema, value) {
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new BookingError("INVALID_BODY", 400);
    if (
      (schema.required || []).some((k) => !(k in value)) ||
      Object.keys(value).some((k) => !schema.properties[k])
    )
      throw new BookingError("INVALID_FIELDS", 422);
    for (const [k, v] of Object.entries(value))
      validate(schema.properties[k], v);
  } else if (schema.type === "array") {
    if (
      !Array.isArray(value) ||
      value.length < (schema.minItems || 0) ||
      value.length > (schema.maxItems || 100) ||
      (schema.uniqueItems && new Set(value).size !== value.length)
    )
      throw new BookingError("INVALID_ARRAY", 422);
    value.forEach((v) => validate(schema.items, v));
  } else {
    if (
      schema.type === "integer"
        ? !Number.isInteger(value)
        : typeof value !== schema.type
    )
      throw new BookingError("INVALID_FIELD_TYPE", 422);
    if (
      (schema.minimum !== undefined && value < schema.minimum) ||
      (schema.maximum !== undefined && value > schema.maximum) ||
      (schema.maxLength && value.length > schema.maxLength) ||
      (schema.enum && !schema.enum.includes(value)) ||
      (schema.pattern && !new RegExp(schema.pattern).test(value))
    )
      throw new BookingError("INVALID_FIELD_VALUE", 422);
  }
}
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#163e2d"><meta name="robots" content="noindex,nofollow"><title>Your time at Aroha · Booking review</title><link rel="icon" href="/assets/brand/icon.svg"><link rel="stylesheet" href="/prototype.css"><script type="module" src="/prototype.js"></script></head><body><a class="skip" href="#main">Skip to content</a><div class="review-banner"><span class="live-dot"></span> Booking prototype <span class="banner-detail">· Sample people, prices & reservations. Nothing is booked at the retreat.</span></div><div id="app"><main class="loading">Opening a little space for you…</main></div><div id="toast" role="status" aria-live="polite"></div><dialog id="detail"></dialog><noscript>This booking prototype needs JavaScript. No reservation has been made.</noscript></body></html>`;

export async function createPrototypeServer({
  stateFile = path.join(os.tmpdir(), "aroha-booking-review-v1.json"),
} = {}) {
  let state;
  try {
    state = JSON.parse(await readFile(stateFile, "utf8"));
    if (state.schemaVersion !== 1)
      throw Error("Unknown prototype data version");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    state = seed();
  }
  const js = (
    await build({
      entryPoints: [path.join(root, "prototypes/booking/app.mjs")],
      bundle: true,
      format: "esm",
      write: false,
      target: "es2022",
    })
  ).outputFiles[0].contents;
  const schemas = JSON.parse(
    await readFile(
      path.join(root, "docs/api/aroha-booking-prototype-v1.json"),
      "utf8",
    ),
  ).components.schemas;
  const sessions = new Map(),
    rates = new Map();
  let queue = Promise.resolve();
  function transaction(fn) {
    const work = queue.then(async () => {
      const next = structuredClone(state);
      expire(next);
      const result = await fn(next);
      await mkdir(path.dirname(stateFile), { recursive: true });
      await writeFile(stateFile + ".next", JSON.stringify(next), {
        mode: 0o600,
      });
      await rename(stateFile + ".next", stateFile);
      state = next;
      return result;
    });
    queue = work.catch(() => {});
    return work;
  }
  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    const json = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    try {
      const expectedHost = `127.0.0.1:${server.address().port}`;
      if (
        req.headers.host !== expectedHost &&
        req.headers.host !== `localhost:${server.address().port}`
      )
        throw new BookingError("LOOPBACK_HOST_REQUIRED", 403);
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith("/prototype-api/")) {
        const sid = req.headers.cookie?.match(
            /(?:^|;\s*)aroha_review=([a-z0-9-]+)/,
          )?.[1],
          actorId = sessions.get(sid),
          actor = state.users.find((u) => u.id === actorId);
        if (req.method === "GET" && url.pathname === "/prototype-api/v1/state")
          return json(200, await transaction((s) => snapshot(s, actor)));
        if (
          req.method !== "POST" ||
          req.headers["x-prototype-client"] !== "aroha-review" ||
          (req.headers.origin &&
            req.headers.origin !== `http://${req.headers.host}`)
        )
          throw new BookingError("ORIGIN_DENIED", 403);
        const rateKey = sid || req.socket.remoteAddress,
          minute = Math.floor(Date.now() / 60000),
          prev = rates.get(rateKey);
        if (prev?.minute === minute && prev.count >= 120)
          throw new BookingError("RATE_LIMIT", 429);
        rates.set(rateKey, {
          minute,
          count: prev?.minute === minute ? prev.count + 1 : 1,
        });
        if (!req.headers["content-type"]?.startsWith("application/json"))
          throw new BookingError("JSON_REQUIRED", 415);
        let raw = "";
        for await (const part of req) {
          raw += part;
          if (Buffer.byteLength(raw) > 16000)
            throw new BookingError("PAYLOAD_TOO_LARGE", 413);
        }
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          throw new BookingError("INVALID_JSON", 400);
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new BookingError("INVALID_BODY", 400);
        const operation = url.pathname.replace("/prototype-api/v1/", "");
        if (!schemas[operation] || operation === "Error")
          throw new BookingError("NOT_FOUND", 404);
        validate(schemas[operation], body);
        if (url.pathname === "/prototype-api/v1/session") {
          const user = state.users.find((u) => u.id === body.persona);
          if (!user) throw new BookingError("INVALID_DEMO_PERSONA", 403);
          if (sid) sessions.delete(sid);
          const id = randomUUID();
          sessions.set(id, user.id);
          res.setHeader(
            "Set-Cookie",
            `aroha_review=${id}; HttpOnly; SameSite=Strict; Path=/`,
          );
          return json(200, snapshot(state, user));
        }
        if (url.pathname === "/prototype-api/v1/logout") {
          sessions.delete(sid);
          res.setHeader(
            "Set-Cookie",
            "aroha_review=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
          );
          return json(200, { signedOut: true });
        }
        if (!actor) throw new BookingError("SIGN_IN_REQUIRED", 401);
        if (url.pathname === "/prototype-api/v1/availability")
          return json(200, await transaction((s) => availability(s, body)));
        const result = await transaction((s) =>
          command(s, actor, operation, body, req.headers["idempotency-key"]),
        );
        return json(200, result);
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        throw new BookingError("METHOD_NOT_ALLOWED", 405);
      if (
        ["/", "/prototype/booking/", "/prototype/studio/"].includes(
          url.pathname,
        )
      ) {
        res.setHeader("Content-Type", "text/html");
        res.setHeader("Cache-Control", "no-store");
        res.end(html);
        return;
      }
      if (url.pathname === "/prototype.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(js);
        return;
      }
      if (url.pathname === "/prototype.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(
          await readFile(path.join(root, "prototypes/booking/style.css")),
        );
        return;
      }
      const assets = {
        "/assets/brand/logo-forest.svg": "vendor/natura/brand/logo-forest.svg",
        "/assets/brand/logo-white.svg": "vendor/natura/brand/logo-white.svg",
        "/assets/brand/icon.svg": "vendor/natura/brand/icon.svg",
        "/assets/fonts/Lora.woff2":
          "vendor/natura/fonts/Lora/Lora-Variable.woff2",
        "/assets/fonts/Source.woff2":
          "vendor/natura/fonts/SourceSans3/SourceSans3-Variable.woff2",
        "/assets/fonts/Allura.woff2":
          "vendor/natura/fonts/Allura/Allura-Regular.woff2",
      };
      if (/^\/assets\/retreat\/[a-zA-Z0-9_-]+\.webp$/.test(url.pathname))
        assets[url.pathname] = "website" + url.pathname;
      if (!assets[url.pathname]) throw new BookingError("NOT_FOUND", 404);
      res.setHeader(
        "Content-Type",
        url.pathname.endsWith(".svg")
          ? "image/svg+xml"
          : url.pathname.endsWith(".woff2")
            ? "font/woff2"
            : "image/webp",
      );
      res.end(await readFile(path.join(root, assets[url.pathname])));
    } catch (error) {
      json(error instanceof BookingError ? error.status : 500, {
        error: {
          code: error instanceof BookingError ? error.code : "INTERNAL_ERROR",
          requestId,
        },
      });
    }
  });
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(process.env.AROHA_REVIEW_PORT || 8782);
  const server = await createPrototypeServer();
  server.listen(port, "127.0.0.1", () =>
    console.log(
      `Aroha booking prototype: http://127.0.0.1:${port}/prototype/booking/\nHost view: http://127.0.0.1:${port}/prototype/studio/\nSynthetic local data only. Emails and live bookings are not connected.`,
    ),
  );
}
