import { environment } from "../environment.mjs";
import { renderInvoicePdf } from "./invoice-pdf.mjs";
import { operationSpan } from "../telemetry.mjs";

export async function invoicePdf(
  invoice,
  { designVersion = invoice.documentDesignVersion || invoice.documentTemplateVersion || "legacy" } = {},
) {
  if (invoice.environment !== environment.name) throw Error("INVOICE_ENVIRONMENT_MISMATCH");
  if (!["legacy", "pdf-v4", "pdf-v4-financial", "pdf-v4-loyalty"].includes(designVersion))
    throw Error("UNKNOWN_DOCUMENT_TEMPLATE");
  const buffer = await operationSpan("invoice.generate", () => renderInvoicePdf(invoice, { designVersion }));
  if (buffer.length > 1048576) throw Error("INVOICE_DOCUMENT_TOO_LARGE");
  return { buffer };
}
