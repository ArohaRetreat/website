import { createHash } from "node:crypto";
// Native runner events only. No assertions, test names, output or fixture data leave CI.
export default async function* report(source) {
  let ordinal = 0;
  for await (const { type, data } of source) {
    if (
      !["test:pass", "test:fail"].includes(type) ||
      data.details?.type === "suite"
    )
      continue;
    const caseId = createHash("sha256")
      .update(
        [data.file || "", data.name || "", data.nesting || 0, ordinal].join(
          "\0",
        ),
      )
      .digest("hex");
    yield JSON.stringify({
      schema: 1,
      kind: "test",
      id: caseId,
      ordinal: ordinal++,
      completedAt: new Date().toISOString(),
      status:
        data.skip || data.todo
          ? "skipped"
          : type === "test:pass"
            ? "passed"
            : "failed",
      durationMs: Math.max(0, Number(data.details?.duration_ms) || 0),
    }) + "\n";
  }
}
