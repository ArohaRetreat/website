export const INGEST_ORIGIN = "https://indiacs.live.dynatrace.com";
export async function request(
  path,
  body,
  token,
  {
    origin = INGEST_ORIGIN,
    fetchImpl = fetch,
    contentType = "application/json",
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = {},
) {
  if (!token || !path.startsWith("/api/v2/") || !/^https:\/\/[a-z0-9-]+\.live\.dynatrace\.com$/.test(origin))
    throw Error("DELIVERY_CONFIGURATION");
  for (let attempt = 1; attempt <= 3; attempt++) {
    let response;
    try {
      response = await fetchImpl(origin + path, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": contentType,
        },
        body,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      if (attempt === 3)
        return {
          accepted: false,
          status: 0,
          attempts: attempt,
          reason: "NETWORK",
        };
      await sleep(attempt * 1000);
      continue;
    }
    let bytes;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      if (attempt === 3)
        return {
          accepted: false,
          status: response.status,
          attempts: attempt,
          reason: "RESPONSE_READ_FAILED",
        };
      await sleep(attempt * 1000);
      continue;
    }
    if (bytes.length > 1024 * 1024)
      return {
        accepted: false,
        status: response.status,
        attempts: attempt,
        reason: "RESPONSE_LIMIT",
      };
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      await sleep(attempt * 1000);
      continue;
    }
    return {
      accepted: response.ok,
      status: response.status,
      attempts: attempt,
      bytes,
    };
  }
}
export async function exportDelivery(
  events,
  otel,
  token,
  marker = null,
  options = {},
) {
  const receipts = {};
  // Bodies stay private in memory. Receipts contain only status/counts, never headers/error text.
  for (let offset = 0; offset < events.length; offset += 200) {
    const part = await request(
      "/api/v2/bizevents/ingest",
      JSON.stringify(events.slice(offset, offset + 200)),
      token,
      options,
    );
    const previous = receipts.bizevents;
    receipts.bizevents = {
      accepted: (previous?.accepted ?? true) && part.accepted,
      status: part.status,
      records: (previous?.records ?? 0) + Math.min(200, events.length - offset),
      attempts: (previous?.attempts ?? 0) + part.attempts,
    };
  }
  for (const batch of await otel.batches()) {
    const r = await request(
      "/api/v2/otlp/v1/" + batch.signal,
      batch.body,
      token,
      { ...options, contentType: "application/x-protobuf" },
    );
    let rejected = 0,
      decoded = true;
    if (r.accepted) {
      try {
        const result = batch.decode(r.bytes);
        rejected = Number(result?.partialSuccess?.[batch.rejectKey] ?? 0);
        if (!Number.isFinite(rejected)) decoded = false;
      } catch {
        decoded = false;
      }
    }
    receipts[batch.signal] = {
      accepted: r.accepted && decoded && rejected === 0,
      status: r.status,
      rejected,
      decoded,
      attempts: r.attempts,
    };
  }
  if (marker) {
    const r = await request(
      "/api/v2/events/ingest",
      JSON.stringify(marker),
      token,
      options,
    );
    let created = false;
    if (r.accepted) {
      try {
        const result = JSON.parse(new TextDecoder().decode(r.bytes));
        created =
          result.eventIngestResults?.length > 0 &&
          result.eventIngestResults.every((x) => x.status === "OK");
      } catch {}
    }
    receipts.marker = {
      accepted: r.accepted && created,
      status: r.status,
      attempts: r.attempts,
    };
  }
  await otel.shutdown();
  return {
    accepted: Object.values(receipts).every((x) => x.accepted),
    signals: receipts,
  };
}
