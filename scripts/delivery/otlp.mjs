import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { trace, ROOT_CONTEXT } = require("@opentelemetry/api");
const { TracerProvider } = require("@opentelemetry/sdk-trace");
const { LoggerProvider } = require("@opentelemetry/sdk-logs");
const {
  MeterProvider,
  MetricReader,
  AggregationTemporality,
} = require("@opentelemetry/sdk-metrics");
const { resourceFromAttributes } = require("@opentelemetry/resources");
const {
  ProtobufTraceSerializer,
  ProtobufLogsSerializer,
  ProtobufMetricsSerializer,
} = require("@opentelemetry/otlp-transformer");
export function telemetry(service, version, environment, {namespace="delivery"} = {}) {
  if(!["delivery","testing"].includes(namespace))throw Error("INVALID_TELEMETRY_NAMESPACE");
  const resource = resourceFromAttributes({
    "service.name": service,
    "service.namespace": "aroha-retreat",
    "service.version": version,
    "deployment.environment.name": environment,
  });
  const spans = [],
    logs = [];
  const tp = new TracerProvider({
    resource,
    spanProcessors: [
      {
        onStart() {},
        onEnd(s) {
          spans.push(s);
        },
        forceFlush: async () => {},
        shutdown: async () => {},
      },
    ],
  });
  const lp = new LoggerProvider({
    resource,
    processors: [
      {
        onEmit(r) {
          logs.push(r);
        },
        forceFlush: async () => {},
        shutdown: async () => {},
      },
    ],
  });
  class Reader extends MetricReader {
    constructor() {
      super({
        aggregationTemporalitySelector: () => AggregationTemporality.DELTA,
      });
    }
    async onForceFlush() {}
    async onShutdown() {}
  }
  const reader = new Reader(),
    mp = new MeterProvider({ resource, readers: [reader] });
  const tracer = tp.getTracer("aroha-"+namespace, "1.0.0"),
    logger = lp.getLogger("aroha-"+namespace, "1.0.0"),
    meter = mp.getMeter("aroha-"+namespace, "1.0.0");
  const count = meter.createCounter("aroha."+namespace+".outcomes"),
    duration = meter.createHistogram("aroha."+namespace+".duration", { unit: "s" });
  return {
    beginSpan(name, attributes, parent) {
      const span = tracer.startSpan(name, { attributes }, parent ? trace.setSpanContext(ROOT_CONTEXT,parent) : ROOT_CONTEXT);
      return { context: span.spanContext(), end: () => span.end() };
    },
    span(name, attributes, start, end, parent) {
      const s = tracer.startSpan(
        name,
        { attributes, startTime: new Date(start) },
        parent ? trace.setSpanContext(ROOT_CONTEXT, parent) : undefined,
      );
      if (
        ["failure", "failed", "timed_out", "failed-or-partial"].includes(
          attributes["sdlc.status"],
        )
      )
        s.setStatus({ code: 2 });
      s.end(new Date(end));
      return s.spanContext();
    },
    log(attributes, parent) {
      logger.emit({
        severityNumber: 9,
        severityText: "INFO",
        body: namespace+".outcome",
        attributes,
        context: parent
          ? trace.setSpanContext(ROOT_CONTEXT, parent)
          : undefined,
      });
    },
    metric(kind, status, seconds = 0) {
      const attrs = { kind, status, environment };
      count.add(1, attrs);
      if (Number.isFinite(seconds) && seconds >= 0)
        duration.record(seconds, attrs);
    },
    async batches() {
      const { resourceMetrics } = await reader.collect();
      return [
        {
          signal: "traces",
          body: ProtobufTraceSerializer.serializeRequest(spans),
          decode: ProtobufTraceSerializer.deserializeResponse,
          rejectKey: "rejectedSpans",
        },
        {
          signal: "logs",
          body: ProtobufLogsSerializer.serializeRequest(logs),
          decode: ProtobufLogsSerializer.deserializeResponse,
          rejectKey: "rejectedLogRecords",
        },
        {
          signal: "metrics",
          body: ProtobufMetricsSerializer.serializeRequest(resourceMetrics),
          decode: ProtobufMetricsSerializer.deserializeResponse,
          rejectKey: "rejectedDataPoints",
        },
      ];
    },
    async shutdown() {
      await Promise.all([tp.shutdown(), lp.shutdown(), mp.shutdown()]);
    },
  };
}
