import { activeTelemetryConfig } from "./observability-config.mjs";
import { AggregationTemporality } from "@opentelemetry/sdk-metrics";
// Switch transport on export without replacing global tracing/context providers.
export class RuntimeExporter {
  constructor(create, path, fallback) {
    this.create = create;
    this.path = path;
    this.fallback = fallback;
    this.retired = new Set();
  }
  delegate() {
    const p = activeTelemetryConfig() || this.fallback,
      key = p.otlpEndpoint + "|" + p.configVersion + "|" + p.token;
    if (this.current?.key !== key) {
      if (this.current) {
        this.current.retired = true;
        this.retired.add(this.current);
        this.release(this.current);
      }
      this.current = {
        key,
        pending: 0,
        exporter: this.create({
          url: p.otlpEndpoint.replace(/\/$/, "") + this.path,
          headers: { Authorization: "Bearer " + p.token },
          timeoutMillis: 1200,
        }),
      };
    }
    return this.current;
  }
  release(slot) {
    if (slot.retired && slot.pending === 0) {
      this.retired.delete(slot);
      void Promise.resolve(slot.exporter.shutdown()).catch(() => {});
    }
  }
  export(items, callback) {
    const slot = this.delegate();
    slot.pending++;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      slot.pending--;
      this.release(slot);
      callback(result);
    };
    try {
      slot.exporter.export(items, finish);
    } catch (error) {
      finish({ code: 1, error });
    }
  }
  selectAggregationTemporality() {
    return AggregationTemporality.DELTA;
  }
  forceFlush() {
    return Promise.allSettled(
      [this.current, ...this.retired]
        .filter(Boolean)
        .map((x) => x.exporter.forceFlush?.()),
    );
  }
  async shutdown() {
    await Promise.allSettled(
      [this.current, ...this.retired]
        .filter(Boolean)
        .map((x) => x.exporter.shutdown()),
    );
    this.retired.clear();
    this.current = undefined;
  }
}
