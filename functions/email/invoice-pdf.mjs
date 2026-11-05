import { visitWindow } from "./visit-window.mjs";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
const fontPath = (n) =>
  fileURLToPath(
    new URL("../assets/invoice-fonts/" + n + ".ttf", import.meta.url),
  );
const money = (n) =>
  "INR " +
  (n / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export async function renderInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
        size: "A4",
        margin: 48,
        info: {
          Title: "Invoice " + invoice.number,
          Author: invoice.issuer.name,
          CreationDate: new Date(invoice.createdAt),
          ModDate: new Date(invoice.createdAt),
        },
      }),
      chunks = [];
    doc.on("data", (b) => chunks.push(b));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    try {
      doc.registerFont("Source", fontPath("ArohaInvoiceSans"));
      doc.registerFont("Kannada", fontPath("ArohaInvoiceKannada"));
      const text = (s, x, y, opts = {}) =>
        doc
          .font(/[\u0c80-\u0cff]/.test(String(s)) ? "Kannada" : "Source")
          .text(String(s), x, y, opts);
      doc.rect(0, 0, 595.28, 132).fill("#163e2d");
      doc.fillColor("#fffdf6").fontSize(29);
      text(invoice.issuer.name, 48, 37, {
        width: 499,
        height: 40,
        ellipsis: true,
      });
      doc.fontSize(12);
      text("Your time at Aroha", 49, 81);
      doc.fillColor("#163e2d").fontSize(22);
      text("Invoice", 48, 159);
      doc.fontSize(11);
      text(invoice.number, 360, 166, { width: 185, align: "right" });
      let y = 204;
      if (invoice.test) {
        doc.roundedRect(48, y, 499, 38, 5).fill("#f6dfaa");
        doc.fillColor("#563d12").fontSize(12);
        text("TEST DOCUMENT - DO NOT PAY", 60, y + 11);
        y += 58;
      }
      doc.fillColor("#163e2d").fontSize(10);
      text("ISSUED TO", 48, y);
      text("ISSUED ON", 360, y);
      doc.fontSize(13);
      const nameFont = /[\u0c80-\u0cff]/.test(invoice.guestName)
        ? "Kannada"
        : "Source";
      doc.font(nameFont);
      const nameHeight = doc.heightOfString(invoice.guestName, { width: 285 });
      text(invoice.guestName, 48, y + 20, { width: 285 });
      doc.fontSize(11);
      text(
        new Date(invoice.createdAt).toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
        }),
        360,
        y + 20,
      );
      y += Math.max(64, nameHeight + 42);
      doc.fillColor("#52634e").fontSize(10);
      text(
        "Booking " + invoice.reference + "  |  " + visitWindow(invoice),
        48,
        y,
        { width: 499 },
      );
      y += 32;
      doc.rect(48, y, 499, 28).fill("#edf0e6");
      doc.fillColor("#163e2d").fontSize(11);
      text("Description", 60, y + 7);
      text("Amount", 414, y + 7, { width: 120, align: "right" });
      y += 40;
      for (const line of invoice.lineItems) {
        const f = /[\u0c80-\u0cff]/.test(line.label) ? "Kannada" : "Source";
        doc.font(f).fontSize(11);
        const h = Math.max(
          24,
          doc.heightOfString(line.label, { width: 340 }) + 12,
        );
        if (y + h > 650) {
          doc.addPage();
          y = 58;
        }
        text(line.label, 60, y, { width: 340 });
        text(money(line.amount), 410, y, { width: 124, align: "right" });
        doc
          .moveTo(48, y + h - 5)
          .lineTo(547, y + h - 5)
          .strokeColor("#dbe1d4")
          .stroke();
        y += h;
      }
      if (y > 570) {
        doc.addPage();
        y = 58;
      }
      y += 16;
      doc.fontSize(11);
      text("Subtotal", 325, y);
      text(money(invoice.subtotal), 410, y, { width: 124, align: "right" });
      y += 23;
      text("Discount", 325, y);
      text("- " + money(invoice.discount), 410, y, {
        width: 124,
        align: "right",
      });
      y += 30;
      doc.roundedRect(308, y - 8, 239, 43, 5).fill("#163e2d");
      doc.fillColor("#fffdf6").fontSize(13);
      text("Amount payable", 320, y + 5);
      text(money(invoice.balanceDue), 420, y + 5, {
        width: 115,
        align: "right",
      });
      y += 60;
      doc.fillColor("#52634e").fontSize(10);
      text(
        invoice.test
          ? "This is a test invoice for an isolated pre-production booking. No payment is requested."
          : invoice.issuer.paymentInstructions,
        48,
        y,
        { width: 499 },
      );
      y = doc.y + 18;
      text(
        "Payment status: unpaid. This document does not confirm receipt of payment.",
        48,
        y,
        { width: 499 },
      );
      if (invoice.issuer.address) {
        y = doc.y + 18;
        text(invoice.issuer.address, 48, y, { width: 499 });
      }
      if (invoice.issuer.registrationNumber) {
        y = doc.y + 12;
        if (y > 735) { doc.addPage(); y = 58; }
        text("Establishment registration: " + invoice.issuer.registrationNumber, 48, y, {width:499});
      }
      doc.end();
    } catch (e) {
      doc.destroy();
      reject(e);
    }
  });
}
