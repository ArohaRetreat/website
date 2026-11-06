// New financial documents retain the frozen PDF-v4 visual geometry; the original invoice renderer is unchanged.
import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
const asset = (n) =>
  fileURLToPath(new URL("./assets/pdf-v4/" + n, import.meta.url));
const W = 595.276,
  H = 841.89,
  G = "#163e2d",
  INK = "#233e2d",
  M = "#67705e",
  GOLD = "#d8b45e",
  PAPER = "#fffdf7",
  LINE = "#d4d7c7";
const money = (n) =>
  "INR " +
  (n / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const date = (n) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(n));
const time = (n) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Kolkata",
  }).format(new Date(n)) + " IST";
export async function renderPaymentDocumentPdf(invoice) {
  const receipt = invoice.documentKind === "receipt";
  const creditInvoice = invoice.documentKind === "loyalty_invoice";
  const title = creditInvoice
    ? "Booking invoice"
    : receipt
      ? "Payment receipt"
      : "Checkout statement";
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
        size: "A4",
        margin: 0,
        bufferPages: true,
        info: {
          Title: title + " " + invoice.number,
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
      for (const [name, file] of [
        ["Source", "SourceSans3-Regular.ttf"],
        ["SourceBold", "SourceSans3-Semibold.ttf"],
        ["Lora", "Lora-Regular.ttf"],
        ["LoraBold", "Lora-Semibold.ttf"],
      ])
        doc.registerFont(name, asset(file));
      doc.registerFont(
        "Kannada",
        fileURLToPath(
          new URL(
            "../assets/invoice-fonts/ArohaInvoiceKannada.ttf",
            import.meta.url,
          ),
        ),
      );
      const font = (s, f) =>
        /[\u0c80-\u0cff]/.test(String(s)) ? "Kannada" : f;
      const text = (x, y, s, size = 10, f = "Source", col = INK, opts = {}) =>
        doc
          .font(font(s, f))
          .fontSize(size)
          .fillColor(col)
          .text(String(s), x, y, {
            lineGap: 2,
            width: 507,
            height: 40,
            ...opts,
          });
      const right = (
        x,
        y,
        s,
        size = 10,
        f = "Source",
        col = INK,
        opts = {},
      ) => {
        const width = opts.width || x - 44;
        return text(x - width, y, s, size, f, col, {
          ...opts,
          width,
          align: "right",
        });
      };
      const caps = (x, y, s, col = M, size = 8) =>
        text(x, y, s, size, "SourceBold", col, { characterSpacing: 0.8 });
      const box = (x, y, w, h, col, r = 0) => {
        doc.fillColor(col);
        (r ? doc.roundedRect(x, y, w, h, r) : doc.rect(x, y, w, h)).fill();
      };
      const line = (y) =>
        doc
          .moveTo(44, y)
          .lineTo(551, y)
          .lineWidth(0.65)
          .strokeColor(LINE)
          .stroke();
      const paper = () => box(0, 0, W, H, PAPER);
      const continuation = () => {
        doc.addPage();
        paper();
        box(0, 0, W, 86, G);
        doc.image(asset("logo-white.png"), 44, 22, { width: 122 });
        right(551, 32, invoice.number, 10, "SourceBold", "#fff9ea");
        caps(44, 110, "YOUR ARRANGEMENTS · CONTINUED");
        return 143;
      };
      const ensure = (y, h) => (y + h > 641 ? continuation() : y);
      paper();
      box(0, 0, W, 210, G);
      for (let i = 0; i < 4; i++)
        doc
          .moveTo(275, 210 - i * 5)
          .bezierCurveTo(369, 100 - i * 9, 455, 259 - i * 7, 620, 151 - i * 7)
          .lineWidth(0.6)
          .strokeColor("#52755a")
          .stroke();
      doc.circle(533, 175, 16).fill(GOLD);
      doc.image(asset("logo-white.png"), 44, 30, { width: 146 });
      right(551, 35, invoice.number, 10, "SourceBold", "#f4eddc");
      right(
        551,
        55,
        date(invoice.createdAt).toUpperCase(),
        8,
        "Source",
        "#b7c8af",
      );
      caps(
        44,
        100,
        title.toUpperCase() + " · " + invoice.reference,
        "#dfc685",
        9,
      );
      text(43, 125, "Good days,", 31, "Lora", "#fff9ea", { height: 40 });
      text(43, 161, "thoughtfully arranged.", 31, "Lora", "#fff9ea", {
        height: 44,
      });
      box(0, 210, W, 25, "#a65336");
      caps(
        44,
        218,
        invoice.test
          ? "PRE-PRODUCTION TEST / NOT VALID FOR PAYMENT"
          : creditInvoice
            ? "CONFIRMED VISIT / LOYALTY CREDITS APPLIED"
            : receipt
              ? "VERIFIED MANUAL PAYMENT / RECEIPT"
              : "CHECKOUT STATEMENT / ACTUAL PAID AND OUTSTANDING",
        "#fff8eb",
        7,
      );
      caps(44, 256, "PREPARED FOR");
      doc.font(font(invoice.guestName, "Lora")).fontSize(18);
      const nameHeight = doc.heightOfString(invoice.guestName, {
        width: 285,
        lineGap: 2,
      });
      text(44, 275, invoice.guestName, 18, "Lora", INK, {
        width: 285,
        height: nameHeight + 3,
      });
      const emailY = Math.max(301, 275 + nameHeight + 4);
      doc.font("Source").fontSize(10);
      const emailHeight = doc.heightOfString(invoice.guestEmail || "", {
        width: 285,
        lineGap: 2,
      });
      text(44, emailY, invoice.guestEmail || "", 10, "Source", M, {
        width: 285,
        height: emailHeight + 3,
      });
      const dateTop = Math.max(328, emailY + emailHeight + 8);
      caps(355, 256, "THE VISIT");
      text(
        355,
        276,
        {
          event: "Exclusive retreat",
          private: "Private family stay",
          individual: "Individual stay",
          day: "Day visit",
        }[invoice.kind] || "Your visit at Aroha",
        12,
        "SourceBold",
        INK,
        { width: 196 },
      );
      text(
        355,
        299,
        invoice.visitSummary || "Arrangements with your hosts",
        9,
        "Source",
        M,
        { width: 196, height: 28 },
      );
      const start =
          invoice.startsAt || Date.parse(invoice.arrival + "T11:00:00+05:30"),
        end =
          invoice.endsAt || Date.parse(invoice.departure + "T11:00:00+05:30");
      const instructions = invoice.test
        ? "Test document only. No payment is requested."
        : invoice.issuer.paymentInstructions;
      doc.font("Source").fontSize(8);
      const nh = doc.heightOfString(instructions, { width: 507, lineGap: 2 });
      const shortInstructions = nh <= 14;
      box(44, dateTop, 507, 68, "#faf6ec");
      box(44, dateTop, 3, 68, GOLD);
      for (const [x, label, n] of [
        [61, invoice.kind === "event" ? "FROM" : "CHECK IN", start],
        [323, invoice.kind === "event" ? "UNTIL" : "CHECK OUT", end],
      ]) {
        caps(x, dateTop + 12, label, M, 7);
        text(x, dateTop + 28, date(n), 15, "Lora", INK, { width: 215 });
        text(x, dateTop + 51, time(n), 9, "Source", M, { width: 215 });
      }
      if (shortInstructions)
        text(44, dateTop + 76, instructions, 8, "Source", M, { height: 14 });
      caps(44, dateTop + 93, "YOUR ARRANGEMENTS");
      right(551, dateTop + 93, "AMOUNT · INR", 8, "SourceBold", M);
      line(dateTop + 112);
      let y = dateTop + 127;
      for (const item of invoice.lineItems) {
        const label = String(item.label),
          f = font(label, "SourceBold");
        doc.font(f).fontSize(12);
        const height = Math.max(
          45,
          doc.heightOfString(label, { width: 335, lineGap: 3 }) + 22,
        );
        y = ensure(y, height);
        text(44, y, label, 12, "SourceBold", INK, {
          width: 335,
          height: height - 8,
          lineGap: 3,
        });
        right(
          551,
          y + 2,
          money(item.amount).replace(/^INR /, ""),
          16,
          "Lora",
          INK,
          { width: 160 },
        );
        line(y + height);
        y += height + 17;
      }
      y = ensure(y, invoice.loyaltyCredits ? 175 : 118);
      if (invoice.loyaltyCredits) {
        text(44, y, "Price benefit", 10, "Source", M);
        right(551, y, "−" + money(invoice.priceBenefitDiscount || 0), 11);
        y += 22;
        text(
          44,
          y,
          `${invoice.loyaltyCredits} loyalty credits applied`,
          10,
          "Source",
          M,
        );
        right(551, y, "−" + money(invoice.loyaltyDiscount), 11);
        y += 22;
      }
      text(44, y, "Visit charges", 11, "SourceBold");
      right(551, y, money(invoice.total), 13, "SourceBold");
      y += 25;
      if (receipt) {
        text(44, y, "This verified payment", 10, "Source", M);
        right(551, y, money(invoice.paymentAmount), 11);
        y += 22;
      }
      text(44, y, "Total recorded payments at issue", 10, "Source", M);
      right(551, y, money(invoice.amountPaid || 0), 11);
      y += 30;
      box(44, y, 507, 56, G, 4);
      caps(
        61,
        y + 15,
        "BALANCE DUE · " +
          (invoice.balanceDue === 0
            ? invoice.loyaltyCredits
              ? "SETTLED"
              : "PAID"
            : "UNPAID"),
        "#d2dfc3",
        8,
      );
      right(534, y + 10, money(invoice.balanceDue), 25, "Lora", "#fff8e8");
      y += 63;
      text(
        45,
        y,
        creditInvoice
          ? "Loyalty credits reduce the visit amount. No payment has been recorded by this invoice."
          : receipt
            ? "Records a verified manual payment. No online transfer was initiated."
            : "Amounts reflect the payment ledger when this statement was issued.",
        8,
        "Source",
        M,
        { height: 18 },
      );
      y += 14;
      if (!shortInstructions) {
        y = ensure(y, nh + 10);
        text(44, y, instructions, 8, "Source", M, { height: nh + 8 });
        y += nh + 16;
      }
      const address =
        invoice.issuer.address +
        (invoice.issuer.registrationNumber
          ? " · Establishment registration: " +
            invoice.issuer.registrationNumber
          : "");
      doc.font("Source").fontSize(6.5);
      const longAddress =
        doc.heightOfString(address, { width: 445, lineGap: 1 }) > 20;
      if (longAddress) {
        doc.font("Source").fontSize(9);
        const h = doc.heightOfString(address, { width: 507, lineGap: 2 });
        y = ensure(y, h + 16);
        text(44, y, address, 9, "Source", M, { height: h + 4 });
        y += h + 16;
      }
      if (y > 653) continuation();
      box(44, 653, 507, 134, "#e6ba66", 5);
      caps(61, 670, "A LITTLE AROHA, TO TAKE WITH YOU.", "#65492a", 7);
      text(61, 692, "Keep the smile.", 25, "Lora", "#283e2a", { width: 340 });
      text(62, 726, "The dates belong on paper.", 11, "Source", "#4f563a", {
        width: 340,
      });
      text(
        62,
        743,
        "The memories are yours to keep.",
        11,
        "Source",
        "#4f563a",
        { width: 340 },
      );
      text(
        62,
        767,
        "With a smile from Hrudhi, your nature guide.",
        8,
        "Source",
        "#5c6246",
        { width: 340 },
      );
      doc.image(asset("hrudhi-guide-v1.png"), 435, 635.5, {
        width: 101,
        height: 151.5,
      });
      const pages = doc.bufferedPageRange();
      for (let n = 0; n < pages.count; n++) {
        doc.switchToPage(n);
        caps(44, 803, "AROHA RETREAT / KANAKAPURA", M, 7);
        right(551, 803, "Come as guests. Return as family.", 8, "Source", M);
        text(
          44,
          818,
          longAddress
            ? invoice.issuer.registrationNumber
              ? "Establishment registration: " +
                invoice.issuer.registrationNumber
              : "Issuer details shown above."
            : address,
          6.5,
          "Source",
          M,
          { width: 445, height: 20, lineGap: 1 },
        );
        right(
          551,
          820,
          String(n + 1).padStart(2, "0") +
            " / " +
            String(pages.count).padStart(2, "0"),
          7,
          "Source",
          M,
        );
      }
      doc.end();
    } catch (e) {
      doc.destroy();
      reject(e);
    }
  });
}
