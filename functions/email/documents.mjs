import { getStorage } from "firebase-admin/storage";
import { createHash } from "node:crypto";
import { environment } from "../environment.mjs";
import { renderInvoicePdf } from "./invoice-pdf.mjs";
import { operationSpan } from "../telemetry.mjs";
export async function invoicePdf(
  invoice,
  {
    bucket = getStorage().bucket(
      process.env.FUNCTIONS_EMULATOR
        ? "demo-aroha.appspot.com"
        : "aroha-retreat.firebasestorage.app",
    ),
  } = {},
) {
  if (invoice.environment !== environment.name)
    throw Error("INVOICE_ENVIRONMENT_MISMATCH");
  const object = `billing/${environment.name}/${encodeURIComponent(invoice.owner)}/${invoice.id}.pdf`,
    file = bucket.file(object);
  try {
    const [m] = await file.getMetadata();
    if (
      m.metadata?.snapshotHash !== invoice.snapshotHash ||
      Number(m.size) > 1048576
    )
      throw Error("INVOICE_DOCUMENT_MISMATCH");
    return { buffer: (await file.download())[0], object };
  } catch (e) {
    if (Number(e.code) !== 404) throw e;
  }
  const buffer = await operationSpan("invoice.generate", () =>
    renderInvoicePdf(invoice),
  );
  if (buffer.length > 1048576) throw Error("INVOICE_DOCUMENT_TOO_LARGE");
  try {
    await file.save(buffer, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: "application/pdf",
        cacheControl: "private,no-store",
        metadata: {
          snapshotHash: invoice.snapshotHash,
          sha256: createHash("sha256").update(buffer).digest("hex"),
          environment: environment.name,
        },
      },
    });
    return { buffer, object };
  } catch (e) {
    if (Number(e.code) !== 412) throw e;
    const [m] = await file.getMetadata();
    if (
      m.metadata?.snapshotHash !== invoice.snapshotHash ||
      Number(m.size) > 1048576
    )
      throw Error("INVOICE_DOCUMENT_MISMATCH");
    return { buffer: (await file.download())[0], object };
  }
}
