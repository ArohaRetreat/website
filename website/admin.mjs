import natureDefaults from "./nature-content.json";
import { tourContent } from "./field-render.mjs";
import defaultTour from "./tour-content.json";
import defaults from "./content.json";
import {
  api,
  login,
  logout,
  observeAuth,
  upload,
  auth,
  emulatorLogin,
} from "./firebase.mjs";
import { can, validateContent } from "../functions/domain.mjs";
import { esc } from "./render.mjs";
import { track, initializeMonitoring } from "./monitoring.mjs";
initializeMonitoring();
const root = document.getElementById("admin");
let session,
  draft,
  version = 0,
  tab = "story",
  dirty = false,
  busy = false,
  authGeneration = 0;
const tabs = {
  story: ["Brand & welcome", ["brand", "hero", "intro", "seo"]],
  sections: ["Page layout", ["sections"]],
  tour: ["Farm tour & films", ["tour"]],
  cottages: ["Cottages", ["cottages"]],
  experiences: ["Experiences", ["experiences"]],
  packages: ["Visit packages", ["packages"]],

  contact: ["Contact & FAQs", ["visit", "faqs"]],
  theme: ["Design & motion", ["theme"]],
  access: ["People & access", []],
  history: ["Published history", []],
};
const labels = {
  schemaVersion: "Schema version",
  tour: "Farm tour and journal",
  mapX: "Map position from left (%)",
  mapY: "Map position from top (%)",
  film: "Featured film identifier (optional)",
  src: "Video URL (empty for photographs)",
  nearby: "Nearby destination identifiers",
  stop: "Destination identifier",
  kind: "Media kind: photo or video",
  mobileImage: "Mobile hero photograph URL",
  worldImage: "Illustrated farm world",
  eveningImage: "Evening illustrated world",
  foregroundImage: "Foreground botanical artwork",
  imageAlt: "Image description for accessibility",
  image: "Photograph URL",
  images: "Interior photographs",
  primaryLabel: "Journey button label",
  secondaryLabel: "Visit button label",
  welcomeKannada: "Kannada welcome",
  mapUrl: "Directions link",
  priceNote: "Tariff information",
  overnight: "Includes an overnight stay",
  featured: "Highlight this package",
  visible: "Show this section",
  motion: "Enable journey motion",
  seo: "Search appearance",
  hero: "First impression",
  intro: "Introduction",
  brand: "Brand & welcome",
  visit: "Visit information",
};
const message = (code) =>
  ({
    "auth/popup-blocked": "Allow the Google sign-in window, then try again.",
    "auth/popup-closed-by-user":
      "Sign-in was closed. Continue when you are ready.",
    "auth/unauthorized-domain":
      "Use the official Aroha website to sign in, or ask the host to check the authorized domain.",
    INVITATION_REQUIRED:
      "This Google account has not been invited. Ask a host administrator for access.",
    ACCESS_REVOKED: "Access to this studio has been revoked.",
    API_NOT_CONFIGURED:
      "The administration API is not deployed yet. Your Google account is signed in, but no editing access has been granted.",
    FORBIDDEN: "Your role does not permit this action.",
    VERSION_CONFLICT:
      "Another editor saved a newer draft. Your work is still here. Export a backup, then reload the latest draft before trying again.",
    INVALID_SESSION: "Your session expired. Sign out and sign in again.",
    MEMBER_EXISTS:
      "This account is already a member. Change its role in the people list.",
    ALREADY_PUBLISHED: "This draft is already published.",
  })[code] || code.replaceAll("_", " ").toLowerCase();
function notice(text, error = false) {
  const el = document.getElementById("studio-status");
  if (el) {
    el.textContent = text;
    el.classList.toggle("error", error);
  } else console.info("Studio status:", text);
}
function authScreen(error = "") {
  root.innerHTML = `<main class="auth-shell"><a href="/"><img src="/assets/brand/logo-forest.svg" width="230" height="78" alt="Aroha Retreat"></a><p class="eyebrow">THE HOST STUDIO</p><h1>A little care,<br>behind the scenes.</h1><p>Shape the stories, photographs and small details that welcome your guests.</p><button class="button" id="google-login">Continue with Google <span aria-hidden="true">↗</span></button>${__AROHA_EMULATORS__ ? '<label class="field">Synthetic emulator identity<input type="email" id="emulator-email" value="owner@example.test"></label><button class="small-button" id="emulator-login">Sign in to local emulator</button>' : ""}<p class="auth-note">Access is by invitation. Signing in does not automatically make an account an administrator.</p><p class="error" role="alert">${esc(error)}</p>${auth.currentUser ? '<button class="text-link" id="signout">Use a different account</button>' : ""}<a href="/">Return to the retreat</a></main>`;
  document.getElementById("google-login").onclick = async () => {
    try {
      document.getElementById("google-login").disabled = true;
      await login();
    } catch (e) {
      authScreen(message(e.code || e.message));
    }
  };
  document.getElementById("signout")?.addEventListener("click", logout);
  if (__AROHA_EMULATORS__)
    document
      .getElementById("emulator-login")
      ?.addEventListener("click", async () => {
        try {
          await emulatorLogin(document.getElementById("emulator-email").value);
        } catch (e) {
          authScreen(message(e.message));
        }
      });
}
function title(k) {
  return (
    labels[k] ||
    k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())
  );
}
function get(path) {
  return path.split(".").reduce((v, k) => v[k], draft);
}
function set(path, value) {
  const keys = path.split("."),
    key = keys.pop();
  keys.reduce((v, k) => v[k], draft)[key] = value;
  dirty = true;
  document.getElementById("draft-state").textContent = "Unsaved changes";
}
function field(value, path, key) {
  // Keep historical schema keys for compatibility without offering controls that no longer affect the public layout.
  if (
    path.startsWith("hero.") &&
    ["worldImage", "eveningImage", "foregroundImage"].includes(key)
  )
    return "";
  const label = title(key),
    disabled = can(session.role, "edit") ? "" : "disabled";
  if (Array.isArray(value))
    return `<div class="editor-array"><div class="field-heading"><h3>${esc(label)}</h3>${disabled ? "" : `<button class="small-button" data-add="${esc(path)}">Add item +</button>`}</div>${value
      .map(
        (v, i) =>
          `<div class="array-item"><div class="array-tools"><strong>${esc(v?.name || v?.title || v?.question || "Item " + (i + 1))}</strong>${disabled ? "" : `<button class="small-button" data-move="${esc(path)}" data-index="${i}" data-direction="-1" ${i === 0 ? "disabled" : ""} aria-label="Move item up">↑</button><button class="small-button" data-move="${esc(path)}" data-index="${i}" data-direction="1" ${i === value.length - 1 ? "disabled" : ""} aria-label="Move item down">↓</button><button class="small-button remove" data-remove="${esc(path)}" data-index="${i}">${path === "sections" ? "Hide" : "Remove"}</button>`}</div>${
            typeof v === "object"
              ? Object.entries(v)
                  .map(([k, x]) => field(x, path + "." + i + "." + k, k))
                  .join("")
              : field(v, path + "." + i, "value")
          }</div>`,
      )
      .join("")}</div>`;
  if (value && typeof value === "object")
    return `<fieldset><legend>${esc(label)}</legend>${Object.entries(value)
      .map(([k, v]) => field(v, path + "." + k, k))
      .join("")}</fieldset>`;
  if (typeof value === "boolean")
    return `<label class="checkbox-field"><input type="checkbox" data-path="${esc(path)}" ${value ? "checked" : ""} ${disabled}>${esc(label)}</label>`;
  if (key === "id")
    return `<label class="field">Stable identifier<input data-path="${esc(path)}" value="${esc(value)}" ${path.startsWith("sections.") ? "readonly" : disabled}><small>Lowercase letters, numbers and hyphens. Keep existing identifiers when editing.</small></label>`;
  const videoField = key === "src" && path.startsWith("tour.media.");
  const imageField =
    key === "image" ||
    [
      "mobileImage",
      "worldImage",
      "eveningImage",
      "foregroundImage",
      "leafImage",
      "plantImage",
      "heroEveningImage",
    ].includes(key) ||
    (path.startsWith("cottages.") && path.includes(".images."));
  return `<label class="field">${esc(label)}${["description", "detail", "answer", "message", "note", "priceNote", "inclusions"].includes(key) || String(value).includes("\n") ? `<textarea rows="3" data-path="${esc(path)}" ${disabled}>${esc(value)}</textarea>` : `<input type="${typeof value === "number" ? "number" : key === "email" ? "email" : key === "mapUrl" ? "url" : "text"}" data-path="${esc(path)}" value="${esc(value)}" ${typeof value === "number" ? 'min="0" step="1"' : ""} ${disabled}>`}</label>${videoField ? `<div class="media-field">${value ? `<video controls muted playsinline preload="none" src="${esc(value)}"></video>` : ""}${disabled ? "" : `<label class="upload-button">Upload web video<input type="file" accept="video/mp4,video/webm" data-upload="${esc(path)}" data-media-type="video"></label>`}<small>Public immediately after upload. MP4 or WebM, under 40 MB. Upload an edited web version; originals stay on your device.</small></div>` : ""}${imageField ? `<div class="media-field">${value ? `<img src="${esc(value)}" alt="Selected photograph preview" loading="lazy">` : ""}${disabled ? "" : `<label class="upload-button">Upload photograph<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" data-upload="${esc(path)}"></label>`}<small>Website media is public immediately after upload. JPEG, PNG, WebP or AVIF; under 10 MB. Originals stay on your device.</small></div>` : ""}`;
}
function shell() {
  root.innerHTML = `<aside class="studio-sidebar"><a href="/" class="studio-logo"><img src="/assets/brand/logo-forest.svg" alt="Aroha Retreat" width="190" height="65"></a><p class="eyebrow">HOST STUDIO</p><nav aria-label="Studio sections">${Object.entries(
    tabs,
  )
    .filter(([k]) => k !== "access" || can(session.role, "access"))
    .map(
      ([key, [name]]) =>
        `<button data-tab="${key}" ${tab === key ? 'aria-current="page"' : ""}>${esc(name)}</button>`,
    )
    .join(
      "",
    )}</nav><div class="studio-account"><strong>${esc(session.role)}</strong><span>${esc(session.email)}</span><button class="text-link" id="signout">Sign out</button></div></aside><main class="studio-main"><header class="studio-toolbar"><div><h1>${esc(tabs[tab][0])}</h1><span id="draft-state">${dirty ? "Unsaved changes" : "Draft version " + version}</span></div><div class="toolbar-buttons"><button class="small-button" id="reload">Reload draft</button><button class="small-button" id="export">Export backup</button><button class="small-button" id="preview">Preview</button>${can(session.role, "edit") ? '<button class="button" id="save">Save draft</button>' : ""}${can(session.role, "publish") ? '<button class="button publish" id="publish">Publish</button>' : ""}</div></header><p id="studio-status" role="status" class="studio-status">Draft changes stay private until published. Uploaded media is public.</p><div id="editor"></div></main><dialog id="preview-dialog"><div class="preview-toolbar"><span>Draft preview</span><button class="small-button" id="close-preview">Close preview</button></div><iframe title="Private draft preview" src="/?preview=1"></iframe></dialog><dialog id="confirm-dialog"><form method="dialog"><h2>Publish this draft?</h2><p>This replaces the public website content. The current published revision remains in history.</p><div class="toolbar-buttons"><button class="small-button" value="cancel">Keep editing</button><button class="button" value="publish">Publish now</button></div></form></dialog>`;
  document.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        tab = b.dataset.tab;
        shell();
      }),
  );
  document.getElementById("signout").onclick = async () => {
    if (dirty && !confirm("Discard unsaved changes and sign out?")) return;
    await logout();
  };
  document.getElementById("save")?.addEventListener("click", save);
  document.getElementById("publish")?.addEventListener("click", async () => {
    if (dirty) {
      notice("Save your draft before publishing.", true);
      return;
    }
    const dialog = document.getElementById("confirm-dialog");
    dialog.showModal();
    dialog.onclose = () => {
      if (dialog.returnValue === "publish")
        task(async () => {
          const r = await api("/publish", "POST", { expectedVersion: version });
          notice("Version " + r.version + " is now published.");
          track("admin.published", { outcome: "published" });
        });
    };
  });
  document.getElementById("reload").onclick = async () => {
    if (dirty && !confirm("Discard unsaved changes and load the latest draft?"))
      return;
    await task(async () => {
      await load();
      shell();
    });
  };
  document.getElementById("export").onclick = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "aroha-draft-v" + version + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };
  document.getElementById("preview").onclick = () => {
    try {
      validateContent(draft);
      const d = document.getElementById("preview-dialog"),
        frame = d.querySelector("iframe");
      frame.onload = () =>
        frame.contentWindow.postMessage(
          { type: "aroha-preview", content: draft },
          location.origin,
        );
      d.showModal();
      frame.src = "/?preview=1";
    } catch (e) {
      notice(message(e.message), true);
    }
  };
  document.getElementById("close-preview").onclick = () =>
    document.getElementById("preview-dialog").close();
  renderEditor();
}
function renderEditor() {
  const editor = document.getElementById("editor");
  if (tab === "access") {
    access();
    return;
  }
  if (tab === "history") {
    history();
    return;
  }
  editor.innerHTML =
    tabs[tab][1].map((k) => field(draft[k], k, k)).join("") +
    (tab === "story" && can(session.role, "edit")
      ? '<details class="advanced"><summary>Restore a content backup</summary><p>Loads a JSON backup into this draft. Review and save before publishing.</p><input type="file" accept="application/json,.json" id="import-backup"></details>'
      : "");
  editor.querySelectorAll("[data-path]").forEach(
    (el) =>
      (el.oninput = () => {
        const prev = get(el.dataset.path);
        set(
          el.dataset.path,
          el.type === "checkbox"
            ? el.checked
            : typeof prev === "number"
              ? Number(el.value)
              : el.value,
        );
      }),
  );
  editor.querySelectorAll("[data-add]").forEach(
    (b) =>
      (b.onclick = () => {
        const a = get(b.dataset.add),
          sample =
            a[0] ??
            (() => {
              const templates = { ...defaults, tour: defaultTour };
              const value = b.dataset.add
                .split(".")
                .reduce((v, k) => v?.[k], templates);
              if (Array.isArray(value) && value.length) return value[0];
              if (/\.(images|nearby)$/.test(b.dataset.add)) return "";
              if (b.dataset.add.endsWith(".walk"))
                return { name: "New viewpoint", film: "" };
              return null;
            })();
        if (sample === null) {
          notice(
            "Restore a backup or an existing item to use as a template.",
            true,
          );
          return;
        }
        const item = structuredClone(sample);
        if (item && typeof item === "object" && "id" in item)
          item.id = "item-" + crypto.randomUUID().slice(0, 8);
        if (b.dataset.add === "sections") {
          notice(
            "All six section types are already available. Use their visibility controls.",
            true,
          );
          return;
        }
        a.push(item);
        dirty = true;
        document.getElementById("draft-state").textContent = "Unsaved changes";
        renderEditor();
      }),
  );
  editor.querySelectorAll("[data-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!confirm("Remove this item from the draft?")) return;
        if (b.dataset.remove === "sections")
          get(b.dataset.remove)[Number(b.dataset.index)].visible = false;
        else get(b.dataset.remove).splice(Number(b.dataset.index), 1);
        dirty = true;
        document.getElementById("draft-state").textContent = "Unsaved changes";
        renderEditor();
      }),
  );
  editor.querySelectorAll("[data-move]").forEach(
    (b) =>
      (b.onclick = () => {
        const a = get(b.dataset.move),
          i = Number(b.dataset.index),
          j = i + Number(b.dataset.direction);
        if (j < 0 || j >= a.length) return;
        [a[i], a[j]] = [a[j], a[i]];
        dirty = true;
        document.getElementById("draft-state").textContent = "Unsaved changes";
        renderEditor();
      }),
  );
  editor.querySelectorAll("[data-upload]").forEach(
    (input) =>
      (input.onchange = () =>
        task(async () => {
          const file = input.files[0];
          if (!file) return;
          const path = input.dataset.upload;
          const parentPath = path.split(".").slice(0, -1).join(".");
          const parent = get(parentPath);
          const url = await upload(
            file,
            (p) => notice("Uploading media: " + p + "%"),
            input.dataset.mediaType === "video" ? "video" : "image",
          );
          if (get(parentPath) !== parent) {
            notice(
              "The media uploaded, but this item moved during upload. Select the media again for the intended item.",
              true,
            );
            return;
          }
          set(path, url);
          renderEditor();
          notice("Media uploaded. Save the draft to keep this selection.");
        })),
  );
  document.getElementById("import-backup")?.addEventListener("change", (e) =>
    task(async () => {
      const file = e.target.files[0];
      if (!file || file.size > 200000) throw Error("INVALID_BACKUP");
      draft = validateContent(JSON.parse(await file.text()));
      draft.hero = { ...defaults.hero, ...draft.hero };
      if (!draft.tour) draft.tour = structuredClone(tourContent(draft));
      draft.tour.nature = {
        ...structuredClone(natureDefaults),
        ...draft.tour.nature,
      };
      dirty = true;
      shell();
      notice("Backup loaded into the editor. Review before saving.");
    }),
  );
}
async function task(fn) {
  if (busy) return;
  busy = true;
  document
    .querySelectorAll(".studio-toolbar button")
    .forEach((b) => (b.disabled = true));
  try {
    await fn();
  } catch (e) {
    notice(message(e.message), true);
  } finally {
    busy = false;
    document
      .querySelectorAll(".studio-toolbar button")
      .forEach((b) => (b.disabled = false));
  }
}
async function save() {
  await task(async () => {
    validateContent(draft);
    const snapshot = structuredClone(draft);
    const result = await api("/draft", "POST", {
      content: snapshot,
      expectedVersion: version,
    });
    version = result.version;
    dirty = JSON.stringify(draft) !== JSON.stringify(snapshot);
    document.getElementById("draft-state").textContent = dirty
      ? "Unsaved changes"
      : "Draft version " + version;
    notice(
      dirty
        ? "Draft saved. Your newer edits still need saving."
        : "Draft saved. The public website has not changed.",
    );
    track("admin.saved", { outcome: "saved" });
  });
}
async function load() {
  const r = await api("/draft");
  draft = structuredClone(r.draft?.content || defaults);
  if (!draft.tour) draft.tour = structuredClone(tourContent(draft));
  draft.tour.nature = {
    ...structuredClone(natureDefaults),
    ...draft.tour.nature,
  };
  draft.hero = { ...defaults.hero, ...draft.hero };
  version = r.draft?.version || 0;
  dirty = false;
}
async function access() {
  const editor = document.getElementById("editor");
  editor.innerHTML = "<p>Loading people and invitations…</p>";
  try {
    const [m, i] = await Promise.all([api("/members"), api("/invitations")]);
    if (tab !== "access") return;
    editor.innerHTML = `<section class="access-section"><h2>Invite someone to the studio</h2><p>Invitations expire after seven days. Copy the link and share it with the invited person. Their verified Google account must match the invited email.</p><form id="invite-form" class="invite-form"><label>Email address<input name="email" type="email" required maxlength="254"></label><label>Access level<select name="role">${(session.role === "superadmin" ? ["admin", "editor", "viewer"] : ["editor", "viewer"]).map((r) => `<option>${r}</option>`).join("")}</select></label><button class="button">Create invitation</button></form><p id="invite-result" role="status"></p></section><section class="access-section"><h2>People</h2><p>Super-admin identities are protected. Admins manage editors and viewers; editors cannot publish.</p><div id="people-list">${memberRows(m.members)}</div>${m.nextCursor ? `<button class="small-button" id="more-members" data-cursor="${esc(m.nextCursor)}">Load more people</button>` : ""}</section><section class="access-section"><h2>Invitations</h2><div id="invites-list">${inviteRows(i.invitations)}</div>${i.nextCursor ? `<button class="small-button" id="more-invites" data-cursor="${esc(i.nextCursor)}">Load more invitations</button>` : ""}</section>`;
    bindAccess();
    document.getElementById("invite-form").onsubmit = (e) => {
      e.preventDefault();
      task(async () => {
        const data = Object.fromEntries(new FormData(e.target));
        const result = await api("/invitations", "POST", data);
        await access();
        const p = document.getElementById("invite-result");
        p.textContent =
          "Invitation created. Share this link: " + result.inviteUrl;
      });
    };
  } catch (e) {
    editor.textContent = message(e.message);
  }
}
function memberRows(rows) {
  return (
    rows
      .map((m) => {
        const editable =
          m.role !== "superadmin" &&
          m.id !== session.uid &&
          (session.role === "superadmin" ||
            ["editor", "viewer"].includes(m.role));
        return `<div class="member-row"><div><strong>${esc(m.email)}</strong><small>${m.active ? "Active" : "Access revoked"}</small></div><select aria-label="Role for ${esc(m.email)}" data-role="${esc(m.id)}" ${editable ? "" : "disabled"}>${[
          "superadmin",
          "admin",
          "editor",
          "viewer",
        ]
          .filter(
            (r) =>
              r === m.role ||
              (r !== "superadmin" &&
                (session.role === "superadmin" || r !== "admin")),
          )
          .map((r) => `<option ${r === m.role ? "selected" : ""}>${r}</option>`)
          .join(
            "",
          )}</select>${editable ? `<button class="small-button" data-member="${esc(m.id)}" data-active="${!m.active}">${m.active ? "Revoke access" : "Restore access"}</button><button class="small-button" data-member="${esc(m.id)}" data-active="${m.active}">Save role</button>` : ""}</div>`;
      })
      .join("") || "<p>No members yet.</p>"
  );
}
function inviteRows(rows) {
  return (
    rows
      .map(
        (i) =>
          `<div class="member-row"><div><strong>${esc(i.email)}</strong><small>${esc(i.role)} · ${esc(i.status === "pending" && i.expiresAt < Date.now() ? "expired" : i.status)}</small></div>${i.status === "pending" ? `<button class="small-button" data-revoke-invite="${esc(i.id)}">Revoke invitation</button>` : ""}</div>`,
      )
      .join("") || "<p>No invitations yet.</p>"
  );
}
function bindAccess() {
  document.querySelectorAll("[data-member]").forEach(
    (b) =>
      (b.onclick = () =>
        task(async () => {
          if (!confirm("Apply this access change?")) return;
          const role = [...document.querySelectorAll("[data-role]")].find(
            (x) => x.dataset.role === b.dataset.member,
          ).value;
          await api(
            "/members/" + encodeURIComponent(b.dataset.member),
            "POST",
            { role, active: b.dataset.active === "true" },
          );
          track("admin.access-changed", { outcome: "updated" });
          await access();
        })),
  );
  document.querySelectorAll("[data-revoke-invite]").forEach(
    (b) =>
      (b.onclick = () =>
        task(async () => {
          await api("/invitations/" + b.dataset.revokeInvite, "DELETE");
          await access();
        })),
  );
  for (const [kind, path, container, renderer] of [
    ["members", "members", "people-list", memberRows],
    ["invites", "invitations", "invites-list", inviteRows],
  ]) {
    const b = document.getElementById("more-" + kind);
    if (b)
      b.onclick = () =>
        task(async () => {
          const r = await api(
            "/" + path + "?cursor=" + encodeURIComponent(b.dataset.cursor),
          );
          document
            .getElementById(container)
            .insertAdjacentHTML("beforeend", renderer(r[path]));
          if (r.nextCursor) b.dataset.cursor = r.nextCursor;
          else b.remove();
          bindAccess();
        });
  }
}
async function history(cursor = "", append = false) {
  const editor = document.getElementById("editor");
  if (!append) editor.innerHTML = "<p>Loading published history…</p>";
  try {
    const result = await api(
      "/revisions" + (cursor ? "?cursor=" + cursor : ""),
    );
    if (tab !== "history") return;
    const rows = result.revisions
      .map(
        (r) =>
          `<div class="member-row"><div><strong>Version ${r.version}</strong><small>${esc(r.publishedAt || "Publishing")}</small></div>${can(session.role, "publish") ? `<button class="small-button" data-restore="${r.version}">Restore into draft</button>` : ""}</div>`,
      )
      .join("");
    if (append)
      document
        .getElementById("history-rows")
        .insertAdjacentHTML("beforeend", rows);
    else
      editor.innerHTML =
        '<p>Restore an earlier publication into a new draft. Review it, then publish when ready.</p><div id="history-rows">' +
        (rows || "<p>No published revisions yet.</p>") +
        "</div>";
    document.getElementById("more-history")?.remove();
    if (result.nextCursor)
      editor.insertAdjacentHTML(
        "beforeend",
        '<button class="small-button" id="more-history">Load more revisions</button>',
      );
    document
      .getElementById("more-history")
      ?.addEventListener("click", () => history(result.nextCursor, true));
    editor.querySelectorAll("[data-restore]").forEach(
      (b) =>
        (b.onclick = () =>
          task(async () => {
            if (
              !confirm(
                "Replace the current draft with this revision? Export any unsaved work first.",
              )
            )
              return;
            await api("/restore", "POST", {
              revision: Number(b.dataset.restore),
              expectedVersion: version,
            });
            await load();
            shell();
            notice(
              "Revision restored into a new draft. The public site has not changed.",
            );
          })),
    );
  } catch (e) {
    editor.textContent = message(e.message);
  }
}
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
observeAuth(async (user) => {
  const generation = ++authGeneration;
  if (!user) {
    session = null;
    draft = null;
    dirty = false;
    authScreen();
    return;
  }
  try {
    const result = await api("/session", "POST", {});
    if (generation !== authGeneration) return;
    session = result.session;
    await load();
    if (generation !== authGeneration) return;
    shell();
  } catch (e) {
    if (generation === authGeneration) authScreen(message(e.message));
  }
});
