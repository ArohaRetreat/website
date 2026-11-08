const maxBytes = 1024 * 1024;
const date = (time) => new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
}).format(time);
const button = (label, action, primary = false) =>
  `<button type="button" class="${primary ? "primary" : "secondary"}" data-id-action="${action}">${label}</button>`;

export async function mountGuestIdentity(root, { call, bookingId, onNumber = () => {} }) {
  const staff = !!bookingId;
  let state, photo, openedVersion, busy = false;
  const request = (action, input = {}) =>
    call("guest-identity/" + action, { ...(staff ? { bookingId } : {}), ...input });
  const revoke = () => {
    if (photo) URL.revokeObjectURL(photo);
    photo = undefined;
    openedVersion = undefined;
  };
  const cleanup = new MutationObserver(() => {
    if (!root.isConnected) {
      revoke();
      cleanup.disconnect();
    }
  });
  cleanup.observe(document.body, { childList: true, subtree: true });

  function draw() {
    if (!root.isConnected) return;
    const item = state?.document;
    root.innerHTML = `<section class="identity-card" data-dt-mask>
      <div class="identity-heading"><h3>${staff ? "Guest identity" : "ID for check-in"}</h3>${
        state?.guestNumber ? '<span class="identity-number">Guest #' + Number(state.guestNumber) + "</span>" : ""
      }</div>
      <p>${!state ? "Loading guest identity…" : !state.canInspect
        ? "ID review is available once the booking is confirmed."
        : item ? (item.status === "verified" ? "Verified by Aroha" : "Ready for review") + " · Expires " + date(item.expiresAt)
        : "No saved ID."}</p>
      ${state?.canInspect ? `<div class="identity-actions">
        ${item ? button(photo ? "Hide photo" : "View ID photo", "preview") : ""}
        ${item && !staff ? button("Remove ID", "remove") : ""}
        ${item && staff && openedVersion === item.version && item.status !== "verified"
          ? button("Mark as verified", "verify", true) : ""}
      </div><div data-id-preview></div>` : ""}
      ${state?.canUpload && (!staff || !item) ? `<details class="identity-upload">
        <summary>${item ? "Replace ID photo" : "Upload ID photo"}</summary>
        <form>
          <p>Optional. Use a photo of an adult’s accepted ID with the document number covered. Do not upload Aadhaar or children’s documents. Save only what the front desk needs to match the guest’s name and face. Bring an original if required for check-in.</p>
          <label class="identity-file">ID photo (JPG or PNG, up to 1 MB)<input name="photo" type="file" accept="image/jpeg,image/png" required></label>
          <label class="identity-consent"><input name="consent" type="checkbox" required><span>${staff
            ? "The guest agreed to save this photo privately for check-in for up to 90 days."
            : "I agree to save this photo privately for check-in for up to 90 days. I can remove it any time."}</span></label>
          <button type="submit" class="primary">Save ID photo</button>
        </form></details>` : ""}
      <p role="status" data-id-status></p>
    </section>`;
    if (photo) {
      const image = document.createElement("img");
      image.alt = "Private guest ID photo";
      image.src = photo;
      root.querySelector("[data-id-preview]")?.append(image);
    }
    root.querySelector("form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const { photo: photoInput, consent } = event.currentTarget.elements;
      const file = photoInput.files[0];
      const agreed = consent.checked;
      if (!file || file.size > maxBytes || !["image/jpeg", "image/png"].includes(file.type)) {
        announce("Choose a JPG or PNG photo no larger than 1 MB.");
        return;
      }
      void run(async () => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192)
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        const result = await request("upload", {
          version: item?.version ?? null, consent: agreed,
          contentType: file.type, contentBase64: btoa(binary),
        });
        revoke();
        Object.assign(state, result);
        return "ID photo saved. It is ready for review.";
      });
    });
    root.querySelectorAll("[data-id-action]").forEach((control) => {
      control.onclick = () => {
        const action = control.dataset.idAction;
        if (action === "preview" && photo) {
          revoke();
          draw();
          root.querySelector('[data-id-action="preview"]')?.focus();
          return;
        }
        if (action === "remove" && !window.confirm("Remove your saved ID photo?")) return;
        if (action === "verify" && !window.confirm("Confirm that you checked the photo against the guest and the booking?")) return;
        void run(async () => {
          const result = await request(action, { version: item.version });
          if (action === "preview") {
            if (!root.isConnected) return;
            const bytes = Uint8Array.from(atob(result.contentBase64), (c) => c.charCodeAt(0));
            photo = URL.createObjectURL(new Blob([bytes], { type: result.contentType }));
            openedVersion = item.version;
            return "ID photo opened.";
          }
          revoke();
          Object.assign(state, result);
          return action === "verify" ? "ID marked as verified." : "ID photo removed.";
        });
      };
    });
  }

  function announce(message) {
    const status = root.querySelector("[data-id-status]");
    if (status) status.textContent = message;
  }
  async function run(task) {
    if (busy) return;
    busy = true;
    const controls = Array.from(root.querySelectorAll("button,input"));
    controls.forEach((control) => { control.disabled = true; });
    announce("Working…");
    try {
      const message = await task();
      draw();
      const status = root.querySelector("[data-id-status]");
      if (status && message) {
        announce(message);
        status.tabIndex = -1;
        status.focus();
      }
    } catch (error) {
      if (error.code === "IDENTITY_VERSION_CONFLICT" || [401, 403, 404, 409].includes(error.status)) {
        revoke();
        try { state = await request("status"); } catch { state = null; }
        draw();
      }
      announce(error.code === "INVALID_ID_IMAGE"
        ? "This image could not be accepted. Choose a valid JPG or PNG up to 1 MB."
        : error.code === "IDENTITY_VERSION_CONFLICT"
          ? "The saved ID changed. Review the latest status before trying again."
          : "This action could not be completed. Check your access and try again.");
    } finally {
      busy = false;
      controls.forEach((control) => { control.disabled = false; });
    }
  }
  draw();
  await run(async () => {
    state = await request("status");
    if (root.isConnected) onNumber(state.guestNumber);
  });
}
