import { classifyError } from "./domain.mjs";
import {
  context,
  trace,
  propagation,
  SpanStatusCode,
  SpanKind,
} from "@opentelemetry/api";
import { TracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  AggregationTemporality,
} from "@opentelemetry/sdk-metrics";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
let providers, logger, counter, duration, tracer, manager;
const endpoint = () =>
  process.env.FUNCTIONS_EMULATOR && process.env.OTEL_TEST_ENDPOINT
    ? process.env.OTEL_TEST_ENDPOINT
    : "https://indiacs.live.dynatrace.com/api/v2/otlp";
function initialize() {
  if (providers || !process.env.DYNATRACE_PLATFORM_TOKEN) return;
  const resource = resourceFromAttributes({
    "service.name": "aroha-api",
    "service.namespace": "aroha-retreat",
    "service.version": "0.1.0",
    "deployment.environment.name": process.env.FUNCTIONS_EMULATOR
      ? "emulator"
      : "production",
    "cloud.provider": "gcp",
    "cloud.platform": "gcp_cloud_run",
    "cloud.region": "asia-south2",
    "faas.name": "arohaApi",
    "faas.version": (process.env.K_REVISION || "local").slice(0, 128),
  });
  const opts = (path) => ({
    url: endpoint().replace(/\/$/, "") + path,
    headers: {
      Authorization: "Bearer " + process.env.DYNATRACE_PLATFORM_TOKEN,
    },
    timeoutMillis: 1200,
  });
  const limits = {
    maxQueueSize: 256,
    maxExportBatchSize: 64,
    scheduledDelayMillis: 1000,
    exportTimeoutMillis: 1200,
  };
  const tp = new TracerProvider({
    resource,
    spanLimits: {
      attributeCountLimit: 32,
      attributeValueLengthLimit: 160,
      eventCountLimit: 16,
    },
    spanProcessors: [
      new BatchSpanProcessor({
        exporter: new OTLPTraceExporter(opts("/v1/traces")),
        ...limits,
      }),
    ],
  });
  manager = new AsyncLocalStorageContextManager().enable();
  context.setGlobalContextManager(manager);
  trace.setGlobalTracerProvider(tp);
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  tracer = tp.getTracer("aroha-api", "0.1.0");
  const lp = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter(opts("/v1/logs")),
        ...limits,
      }),
    ],
  });
  logger = lp.getLogger("aroha-api", "0.1.0");
  const mp = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          ...opts("/v1/metrics"),
          temporalityPreference: AggregationTemporality.DELTA,
        }),
        exportIntervalMillis: 60000,
        exportTimeoutMillis: 1500,
      }),
    ],
  });
  const meter = mp.getMeter("aroha-api", "0.1.0");
  counter = meter.createCounter("aroha.api.requests", {
    description: "Completed API requests",
  });
  duration = meter.createHistogram("aroha.api.duration", {
    unit: "s",
    advice: {
      explicitBucketBoundaries: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
    },
  });
  providers = { traces: tp, logs: lp, metrics: mp };
}
function route(req) {
  const p = req.path.replace(/^\/api\/v1/, "");
  for (const s of [
    "session",
    "draft",
    "publish",
    "restore",
    "revisions",
    "members",
    "invitations",
  ])
    if (p === "/" + s || p.startsWith("/" + s + "/")) return s;
  return "unknown";
}
export async function flushTelemetry() {
  if (!providers) return;
  const entries = Object.entries(providers);
  const result = await Promise.allSettled(
    entries.map(([, p]) => p.forceFlush({ timeoutMillis: 1800 })),
  );
  const failed = entries
    .filter((_, i) => result[i].status === "rejected")
    .map(([name]) => name);
  if (failed.length)
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        code: "TELEMETRY_EXPORT_FAILED",
        signals: failed,
      }),
    );
}
export function recordSummary(summary) {
  const attrs = {
    operation: summary.operation,
    "http.response.status_code": summary.status,
    "request.id": summary.requestId,
    "error.type": summary.errorCode || "none",
  };
  trace.getActiveSpan()?.setAttributes(attrs);
  logger?.emit({
    severityNumber: summary.status >= 500 ? 17 : 9,
    severityText: summary.status >= 500 ? "ERROR" : "INFO",
    body: summary.operation,
    attributes: attrs,
    context: context.active(),
  });
}
export async function traceRequest(req, res, handler) {
  initialize();
  if (!tracer) return handler();
  const path = route(req),
    start = performance.now(),
    parent = propagation.extract(context.active(), {
      traceparent: String(req.get("traceparent") || "").slice(0, 256),
      tracestate: String(req.get("tracestate") || "").slice(0, 512),
    });
  return tracer.startActiveSpan(
    req.method + " " + path,
    {
      kind: SpanKind.SERVER,
      attributes: {
        "http.request.method": ["GET", "POST", "DELETE"].includes(req.method)
          ? req.method
          : "OTHER",
        "http.route": "/api/v1/" + path,
      },
    },
    parent,
    async (span) => {
      try {
        return await handler();
      } finally {
        const status = res.statusCode || 200,
          attrs = {
            route: path,
            status_class: Math.floor(status / 100) + "xx",
          };
        counter.add(1, attrs);
        duration.record((performance.now() - start) / 1000, attrs);
        span.setAttribute("http.response.status_code", status);
        if (status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
        await flushTelemetry();
      }
    },
  );
}
export async function domainSpan(name, handler) {
  if (!tracer) return handler();
  return tracer.startActiveSpan(
    name,
    { attributes: { "db.system.name": "gcp.firestore" } },
    async (span) => {
      try {
        return await handler();
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.setAttribute("error.type", classifyError(error).code);
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
export async function shutdownTelemetry() {
  if (providers)
    await Promise.allSettled(Object.values(providers).map((p) => p.shutdown()));
  manager?.disable();
}
