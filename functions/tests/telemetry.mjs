import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
test("OTLP emits separate protobuf traces, logs and bounded metrics without enquiry content", async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (x) => chunks.push(x));
    req.on("end", () => {
      requests.push({
        path: req.url,
        type: req.headers["content-type"],
        authorization: req.headers.authorization,
        body: Buffer.concat(chunks),
      });
      res.writeHead(200, { "Content-Type": "application/x-protobuf" });
      res.end();
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  process.env.FUNCTIONS_EMULATOR = "true";
  process.env.OTEL_TEST_ENDPOINT = "http://127.0.0.1:" + server.address().port;
  process.env.DYNATRACE_PLATFORM_TOKEN = "synthetic-test-token";
  const { traceRequest, recordSummary, domainSpan, shutdownTelemetry, recordBusinessEvent, traceBookingDelivery } =
    await import("../telemetry.mjs");
  try {
    await traceRequest(
      { path: "/api/v1/draft", method: "POST", get: () => "" },
      { statusCode: 200 },
      async () => {
        await domainSpan("firestore.content.saved", async () => {});
        const {BookingError}=await import("../booking/domain.mjs");
        await assert.rejects(()=>domainSpan("firestore.booking.create",async()=>{throw new BookingError("AVAILABILITY_CHANGED",409);}),e=>e.code==="AVAILABILITY_CHANGED");
        recordBusinessEvent({"event.id":"synthetic-event","event.type":"booking.form_step","event.authority":"client-reported","booking.step":"review","booking.outcome":"failed","booking.kind":"private","contact.phone":"+12025550123","name":"PRIVATE_CONTACT_SHOULD_NOT_EXPORT"});
        recordSummary({
          operation: "content.saved",
          status: 200,
          requestId: "synthetic-request-123",
          errorCode: "",
          message: "PRIVATE_ENQUIRY_SHOULD_NOT_EXPORT",
        });
      },
    );
    await traceBookingDelivery(async()=>({delivered:1,failed:0}));
    await assert.rejects(()=>traceBookingDelivery(async()=>{throw Object.assign(Error("PRIVATE_WORKER_FAILURE"),{code:4});}));
    for (const path of ["/v1/traces", "/v1/logs", "/v1/metrics"]) {
      const req = requests.find((x) => x.path === path);
      assert.ok(req, path + " was not exported");
      assert.match(req.type, /application\/x-protobuf/);
      assert.equal(req.authorization, "Bearer synthetic-test-token");
      assert.ok(req.body.length > 0);
      assert.ok(!req.body.includes(Buffer.from("+12025550123")));
      assert.ok(!req.body.includes(Buffer.from("PRIVATE_CONTACT_SHOULD_NOT_EXPORT")));
      assert.ok(
        !req.body.includes(Buffer.from("PRIVATE_ENQUIRY_SHOULD_NOT_EXPORT")),
      );
    }
    assert.ok(requests.filter(x=>x.path==="/v1/traces").some(x=>x.body.includes(Buffer.from("AVAILABILITY_CHANGED"))));
    assert.ok(requests.filter(x=>x.path==="/v1/logs").some(x=>x.body.includes(Buffer.from("booking.events.delivery_failed"))));
    assert.ok(requests.every(x=>!["+12025550123","PRIVATE_WORKER_FAILURE"].some(v=>x.body.includes(Buffer.from(v)))));
    assert.ok(requests.filter(x=>x.path==="/v1/metrics").some(x=>x.body.includes(Buffer.from("aroha.booking.delivery.runs"))));
    const metrics = requests.find((x) => x.path === "/v1/metrics").body;
    assert.ok(metrics.includes(Buffer.from("aroha.api.requests")));
    assert.ok(!metrics.includes(Buffer.from("synthetic-request-123")));
    const traces = requests.find((x) => x.path === "/v1/traces").body;
    assert.ok(traces.includes(Buffer.from("firestore.content.saved")));
    assert.ok(traces.includes(Buffer.from("aroha-api")));
  } finally {
    await shutdownTelemetry();
    await new Promise((r) => server.close(r));
    delete process.env.DYNATRACE_PLATFORM_TOKEN;
  }
});
