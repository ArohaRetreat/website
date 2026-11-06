const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n / 100);
export async function mountStayPanel(
  target,
  { booking, manager = false, staff = manager, call, onMutation = () => {} },
) {
  target.classList.add("stay-panel");
  target.innerHTML = '<p role="status">Loading payments and documents…</p>';
  const id = booking.id;
  let summary,
    payments,
    documents,
    feedback,
    feedbackUnavailable = false;
  const load = async () => {
    [summary, payments, documents] = await Promise.all([
      call("getFinancialSummary", { id }),
      call("listPayments", { id }),
      call("listDocuments", { id }),
    ]);
    if (booking.status === "completed" && (!staff || manager))
      try {
        feedback = await call("getReservationFeedback", { id });
      } catch (e) {
        if (
          e.code === "ACTUAL_CHECKOUT_REQUIRED" ||
          e.message === "ACTUAL_CHECKOUT_REQUIRED"
        )
          feedbackUnavailable = true;
        else if (e.code !== "NOT_FOUND" && e.message !== "NOT_FOUND") throw e;
      }
  };
  try {
    await load();
  } catch {
    if (target.isConnected)
      target.innerHTML =
        '<p role="status">Payments and documents could not load. Reopen this booking to try again.</p>';
    return;
  }
  if (!target.isConnected) return;
  const render = () => {
    target.innerHTML = `<section class="reviewpanel"><h3>Payments & documents</h3><dl class="detail-price"><div><dt>Visit total</dt><dd>${money(summary.totalPaise)}</dd></div><div><dt>Recorded payments</dt><dd>${money(summary.paidPaise)}</dd></div><div><dt>Balance due</dt><dd>${money(summary.balanceDuePaise)}</dd></div></dl>${["cancelled","declined","expired"].includes(booking.status)?`<p>This booking is ${esc(booking.status)}. No balance is payable against its inactive invoice.${summary.requiresPaymentReview?" Recorded payments need a host review; no refund has been initiated.":""}</p>`:""}<p>No online payment is collected here. These entries record payments verified by your host.</p>${payments.items.map((p) => `<article><p>${esc(p.kind === "reversal" ? "Payment reversal" : p.method)} · ${money(p.amountPaise)} · ${new Date(p.createdAt).toLocaleDateString("en-IN")}</p>${manager && p.kind === "payment" && !payments.items.some((r) => r.reverses === p.id) ? `<form data-reverse="${esc(p.id)}"><p>This corrects the recorded payment and voids its receipt. It does not transfer a refund.</p><label>Reason for reversal<input name="reason" required maxlength="500"></label><button class="text-button" type="submit">Reverse this recorded payment</button></form>` : ""}</article>`).join("")}${payments.nextCursor ? '<button type="button" data-more-payments>More payment entries</button>' : ""}${manager && ["confirmed", "checked_in", "completed"].includes(booking.status) && summary.balanceDuePaise > 0 ? `<details><summary>Record a verified payment</summary><form data-payment><label>Amount (₹)<input name="amount" inputmode="decimal" type="number" min="0.01" step="0.01" max="${summary.balanceDuePaise / 100}" required></label><label>Method<select name="method"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank transfer</option></select></label><label>Payment reference (required for UPI or bank)<input name="reference" maxlength="120"></label><label>Received at<input name="receivedAt" type="datetime-local" required></label><label><input name="verified" type="checkbox" required> I have verified that this payment was received.</label><button class="button" type="submit">Record payment & issue receipt</button></form></details>` : ""}<div>${documents.items.map((d) => `<p>${esc(d.number)} · ${esc(d.kind.replaceAll("_", " "))} · ${esc(d.status)} ${!["void", "superseded"].includes(d.status) ? `<button class="text-button" data-document="${esc(d.id)}">Download PDF</button>` : ""}</p>`).join("") || "<p>No financial documents yet.</p>"}${documents.nextCursor ? '<button type="button" data-more-documents>More documents</button>' : ""}</div></section>${booking.status === "completed" && (!staff || manager) && !feedbackUnavailable ? `<section class="reviewpanel"><h3>Private feedback</h3><p>Visible only to the guest and authorised booking managers.</p>${feedback?.withdrawn ? "<p>Your feedback has been withdrawn.</p>" : manager || (feedback && Date.now() - feedback.createdAt > 7 * 86400000) ? (feedback ? `<p>${esc(feedback.rating)} / 5</p><p>${esc(feedback.comment)}</p>` : "<p>No feedback submitted yet.</p>") : `<form data-feedback><label>Rating<select name="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${feedback?.rating === n ? "selected" : ""}>${n} / 5</option>`).join("")}</select></label><label>Your feedback<textarea name="comment" maxlength="3000" required>${esc(feedback?.comment)}</textarea></label>${!feedback ? '<label><input name="consent" type="checkbox" required> Share privately with Aroha’s booking managers.</label>' : ""}<button class="button" type="submit">${feedback ? "Save feedback" : "Send private feedback"}</button></form>${feedback ? '<button class="text-button" data-withdraw>Withdraw my feedback</button>' : ""}`}</section>` : ""}<p role="status" data-stay-message></p>`;
    const message = (t) => {
      target.querySelector("[data-stay-message]").textContent = t;
    };
    // A response timeout keeps the same key and frozen payload for a safe retry.
    const mutate = (element, operation, input) => {
      let pending, key;
      return async (e) => {
        e.preventDefault();
        if (element.dataset.busy || element.dataset.completed) return;
        pending ??= input();
        key ??= crypto.randomUUID();
        element.dataset.busy = "1";
        const controls = [
          ...element.querySelectorAll("input,textarea,select,button"),
        ];
        controls.forEach((c) => (c.disabled = true));
        try {
          await call(operation, pending, key);
          element.dataset.completed = "1";
          pending = null;
          key = null;
          try {
            await load();
          } catch {
            message(
              "The change was saved. Reopen this booking to refresh its details.",
            );
            return;
          }
          try {
            await onMutation();
          } catch {}
          if (target.isConnected) render();
        } catch (error) {
          message(
            error.status && error.status < 500
              ? "The change was not saved. Refresh this booking and check your access or details."
              : "The response was interrupted. Retry to resolve the same change.",
          );
          if (error.status && error.status < 500) {
            pending = null;
            key = null;
          } else
            controls
              .filter((c) => c.tagName !== "BUTTON")
              .forEach((c) => (c.dataset.keepDisabled = "1"));
        } finally {
          delete element.dataset.busy;
          controls
            .filter(
              (c) => !c.dataset.keepDisabled && !element.dataset.completed,
            )
            .forEach((c) => (c.disabled = false));
        }
      };
    };
    const paymentForm = target.querySelector("[data-payment]");
    if (paymentForm) {
      paymentForm.elements.method.onchange = () => {
        paymentForm.elements.reference.required =
          paymentForm.elements.method.value !== "cash";
      };
      paymentForm.elements.receivedAt.value = new Date(
        Date.now() - new Date().getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16);
      paymentForm.onsubmit = mutate(paymentForm, "recordPayment", () => ({
        id,
        amountPaise: Math.round(
          Number(paymentForm.elements.amount.value) * 100,
        ),
        method: paymentForm.elements.method.value,
        ...(paymentForm.elements.reference.value.trim()
          ? { reference: paymentForm.elements.reference.value.trim() }
          : {}),
        receivedAt: new Date(paymentForm.elements.receivedAt.value).getTime(),
        verified: paymentForm.elements.verified.checked,
        expectedVersion: summary.version,
      }));
    }
    target.querySelectorAll("[data-reverse]").forEach(
      (form) =>
        (form.onsubmit = mutate(form, "reversePayment", () => ({
          id,
          paymentId: form.dataset.reverse,
          reason: form.elements.reason.value,
          expectedVersion: summary.version,
        }))),
    );
    const feedbackForm = target.querySelector("[data-feedback]");
    if (feedbackForm)
      feedbackForm.onsubmit = mutate(
        feedbackForm,
        feedback ? "editMyFeedback" : "submitFeedback",
        () => ({
          id,
          rating: Number(feedbackForm.elements.rating.value),
          comment: feedbackForm.elements.comment.value,
          ...(feedback
            ? { expectedVersion: feedback.version }
            : { consent: feedbackForm.elements.consent.checked }),
        }),
      );
    const withdraw = target.querySelector("[data-withdraw]");
    if (withdraw)
      withdraw.onclick = mutate(withdraw, "withdrawMyFeedback", () => ({
        id,
        expectedVersion: feedback.version,
      }));
    target.querySelectorAll("[data-document]").forEach(
      (button) =>
        (button.onclick = async () => {
          button.disabled = true;
          try {
            const r = await call("downloadDocument", {
              id,
              documentId: button.dataset.document,
            });
            const bytes = Uint8Array.from(atob(r.contentBase64), (c) =>
              c.charCodeAt(0),
            );
            const url = URL.createObjectURL(
              new Blob([bytes], { type: "application/pdf" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = r.filename;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch {
            message(
              "This document could not be downloaded. Refresh the booking and try again.",
            );
          } finally {
            button.disabled = false;
          }
        }),
    );
    for (const [selector, operation, data] of [
      ["[data-more-payments]", "listPayments", payments],
      ["[data-more-documents]", "listDocuments", documents],
    ]) {
      const button = target.querySelector(selector);
      if (button)
        button.onclick = async () => {
          button.disabled = true;
          try {
            const next = await call(operation, { id, cursor: data.nextCursor });
            data.items.push(...next.items);
            data.nextCursor = next.nextCursor;
            render();
          } catch {
            message("More records could not load. Try again.");
            button.disabled = false;
          }
        };
    }
  };
  render();
}
