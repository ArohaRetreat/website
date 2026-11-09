import {studioTable} from "./studio-table.mjs";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]);
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value / 100);
const issuedDate = (value) => new Date(value).toLocaleDateString("en-IN", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
});
const titles = { receipt: "Payment receipt", checkout_statement: "Checkout statement", loyalty_invoice: "Booking invoice", invoice: "Booking invoice" };
const canDownload = (doc) => !["void", "superseded"].includes(doc.status);

export async function downloadBookingDocument(call, id, documentId) {
  const result = await call("downloadDocument", { id, documentId });
  const bytes = Uint8Array.from(atob(result.contentBase64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function showDocument(record, call, trigger) {
  const dialog = document.createElement("dialog");
  dialog.className = "financial-preview";
  dialog.setAttribute("data-dt-mask", "");
  dialog.setAttribute("aria-labelledby", "financial-preview-title");
  const title = titles[record.kind] || "Booking document";
  const fields = [
    ["Document", record.number],
    ["Booking", record.reference],
    ["Issued", issuedDate(record.createdAt)],
    ["Booking total at issue", money(record.totalPaise)],
    ...(record.kind === "receipt" && Number.isSafeInteger(record.paymentPaise) ? [["Payment received", money(record.paymentPaise)]] : []),
    ["Balance at issue", money(record.balanceDuePaise)],
    ["Status", record.status === "void" ? "Void" : record.status === "superseded" ? "Replaced" : "Issued"],
  ];
  dialog.innerHTML = `<header><div><small>AROHA RETREAT</small><h2 id="financial-preview-title">${title}</h2></div><button type="button" data-close aria-label="Close document preview">×</button></header>
    <dl>${fields.map(([label, value]) => `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl>
    ${Number.isSafeInteger(record.currentBalanceDuePaise) ? `<p class="current-balance"><strong>Current booking balance</strong><span>${money(record.currentBalanceDuePaise)}</span></p>` : ""}
    <p>The PDF uses the details recorded when this document was issued.</p><p data-message role="status"></p>
    ${canDownload(record) ? '<button type="button" class="primary button" data-export>Download PDF</button>' : ""}`;
  document.body.append(dialog);
  dialog.querySelector("[data-close]").onclick = () => dialog.close();
  dialog.querySelector("[data-export]")?.addEventListener("click", (event) => {
    void download(event.currentTarget, dialog.querySelector("[data-message]"), call, record);
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (trigger.isConnected) trigger.focus();
  }, { once: true });
  dialog.showModal();
}
async function download(button, message, call, record) {
  button.disabled = true;
  message.textContent = "Preparing your PDF…";
  try {
    await downloadBookingDocument(call, record.bookingId, record.id);
    message.textContent = "PDF ready.";
  } catch {
    message.textContent = "This PDF could not be generated. Refresh the document list and try again.";
  } finally {
    button.disabled = false;
  }
}

export async function mountBookingDocuments(target, { call, staff = false, customerId, chooseGuest } = {}) {
  const operation = staff ? "listStudioDocuments" : "listMyDocuments";
  let page = { items: [], nextCursor: null };
  const cursors = [undefined];
  let position = 0;
  let generation = 0;
  let guest;
  target.classList.add("financial-documents");
  target.innerHTML = `${chooseGuest ? `<div class="table-filter">
    <button type="button" class="outline-button" data-filter-guest>Filter by guest</button>
    <span data-guest-filter-label>All guests</span>
    <button type="button" class="text-button" data-clear-guest hidden>Clear filter</button>
  </div>` : ""}<p role="status" data-documents-status></p><div data-documents-list></div><div class="document-navigation" data-documents-pagination></div>`;
  const status = target.querySelector("[data-documents-status]");
  const list = target.querySelector("[data-documents-list]");
  const pagination = target.querySelector("[data-documents-pagination]");
  function filter(person) {
    guest = person;
    target.querySelector("[data-guest-filter-label]").textContent = guest?.name || "All guests";
    target.querySelector("[data-clear-guest]").hidden = !guest;
    cursors.length = 1;
    list.replaceChildren();
    pagination.replaceChildren();
    void load(0);
  }
  target.querySelector("[data-filter-guest]")?.addEventListener("click", () => chooseGuest(filter));
  target.querySelector("[data-clear-guest]")?.addEventListener("click", () => {
    filter(null);
    target.querySelector("[data-filter-guest]").focus();
  });
  function draw() {
    const rows = page.items.map((record, index) => {
      const label = titles[record.kind] || "Booking document";
      const receipt = record.kind === "receipt";
      const amount = receipt ? record.paymentPaise : record.totalPaise;
      const statusText = record.status === "void" ? "Void" : record.status === "superseded" ? "Replaced" : "Issued";
      return `<tr>
        <th scope="row"><button type="button" class="text-button table-key" data-preview="${index}" aria-label="View ${escape(record.number)}">${escape(record.number)}</button><small>${label}</small></th>
        <td>${escape(record.reference)}</td><td>${escape(issuedDate(record.createdAt))}</td>
        <td><span class="table-status ${statusText === "Issued" ? "current" : ""}">${statusText}</span></td>
        <td class="table-number">${Number.isSafeInteger(amount) ? money(amount) : "—"}<small>${receipt ? "Payment" : "Booking total"}</small></td>
        <td class="table-actions">
          ${canDownload(record) ? `<button type="button" class="outline-button" data-export="${index}" aria-label="Download PDF for ${escape(record.number)}">Download PDF</button>` : ""}
        </td>
      </tr>`;
    }).join("");
    list.innerHTML = rows ? studioTable("Booking documents", [
      ["Document"], ["Booking"], ["Issued (IST)"], ["Status"], ["Amount", "table-number"], ["Actions", "table-actions"],
    ], rows) : `<p class="financial-empty">${page.nextCursor ? "No available documents on this page." : staff ? "No issued documents match this view." : "Your invoice and receipt will appear here when payment is verified."}</p>`;
    list.querySelectorAll("[data-preview]").forEach((button) => {
      button.onclick = () => showDocument(page.items[Number(button.dataset.preview)], call, button);
    });
    list.querySelectorAll("[data-export]").forEach((button) => {
      button.onclick = () => void download(button, status, call, page.items[Number(button.dataset.export)]);
    });
    pagination.innerHTML = position || page.nextCursor ? `<button type="button" data-prev ${position ? "" : "disabled"}>Previous</button><span>Page ${position + 1} · ${page.items.length} documents</span><button type="button" data-next ${page.nextCursor ? "" : "disabled"}>Next</button>` : "";
    pagination.querySelector("[data-prev]")?.addEventListener("click", () => void load(position - 1));
    pagination.querySelector("[data-next]")?.addEventListener("click", () => void load(position + 1, page.nextCursor));
  }
  async function load(next, cursor = cursors[next]) {
    const request = ++generation;
    pagination.querySelectorAll("button").forEach((b) => b.disabled = true);
    status.textContent = "Loading documents…";
    const id = guest?.id || customerId;
    try {
      const response = await call(operation, { ...(id ? { id } : {}), limit: 12, ...(cursor ? { cursor } : {}) });
      if (!target.isConnected || request !== generation) return;
      page = response;
      cursors[next] = cursor;
      position = next;
      status.textContent = "";
      draw();
    } catch (error) {
      if (!target.isConnected || request !== generation) return;
      status.textContent = error.code === "CURSOR_EXPIRED" ? "This page expired. Reload the document list." : "Documents could not load.";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Reload documents";
      retry.onclick = () => void load(0);
      pagination.replaceChildren(retry);
    }
  }
  await load(0);
}
