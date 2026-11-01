export class DomainError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export function classifyError(error) {
  if (error instanceof DomainError)
    return { code: error.code, status: error.status };
  return (
    {
      4: { code: "DEPENDENCY_TIMEOUT", status: 504 },
      8: { code: "DEPENDENCY_QUOTA", status: 503 },
      10: { code: "TRANSACTION_ABORTED", status: 409 },
      14: { code: "DEPENDENCY_UNAVAILABLE", status: 503 },
      "deadline-exceeded": { code: "DEPENDENCY_TIMEOUT", status: 504 },
      "resource-exhausted": { code: "DEPENDENCY_QUOTA", status: 503 },
      unavailable: { code: "DEPENDENCY_UNAVAILABLE", status: 503 },
    }[error?.code] || { code: "INTERNAL_ERROR", status: 500 }
  );
}
export const roles = ["superadmin", "admin", "editor", "viewer"];
export function can(role, operation) {
  return (
    {
      read: roles,
      edit: ["superadmin", "admin", "editor"],
      publish: ["superadmin", "admin"],
      access: ["superadmin", "admin"],
    }[operation]?.includes(role) ?? false
  );
}
export function mayManage(actor, target, next) {
  if (!roles.includes(target) || !roles.includes(next)) return false;
  return actor === "superadmin"
    ? target !== "superadmin" && next !== "superadmin"
    : actor === "admin" &&
        ["editor", "viewer"].includes(target) &&
        ["editor", "viewer"].includes(next);
}
export function emailKey(email) {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(email)
  )
    throw new DomainError("INVALID_EMAIL");
  return email.trim().toLowerCase();
}
export function expectedVersion(input, current) {
  if (!Number.isSafeInteger(input) || input < 0)
    throw new DomainError("INVALID_VERSION");
  if (input !== current) throw new DomainError("VERSION_CONFLICT", 409);
}
const text = (v, max = 3000) => {
  if (typeof v !== "string" || v.length > max)
    throw new DomainError("INVALID_CONTENT");
  return v;
};
const obj = (v, keys, optional = []) => {
  if (
    !v ||
    Array.isArray(v) ||
    typeof v !== "object" ||
    Object.keys(v).some((k) => !keys.includes(k) && !optional.includes(k)) ||
    keys.some((k) => !(k in v))
  )
    throw new DomainError("INVALID_CONTENT");
};
const arr = (v, max, fn) => {
  if (!Array.isArray(v) || v.length > max)
    throw new DomainError("INVALID_CONTENT");
  v.forEach(fn);
};
const id = (v) => {
  text(v, 48);
  if (!/^[a-z][a-z0-9-]*$/.test(v)) throw new DomainError("INVALID_ID");
};
const bool = (v) => {
  if (typeof v !== "boolean") throw new DomainError("INVALID_CONTENT");
};
export function imageUrl(v) {
  text(v, 1500);
  if (
    v === "" ||
    /^\/assets\/retreat\/[a-zA-Z0-9_.-]+\.(webp|jpe?g|png|avif)$/.test(v)
  )
    return v;
  let u;
  try {
    u = new URL(v);
  } catch {
    throw new DomainError("INVALID_IMAGE_URL");
  }
  if (
    u.protocol !== "https:" ||
    u.hostname !== "firebasestorage.googleapis.com" ||
    !u.pathname.startsWith("/v0/b/aroha-retreat.firebasestorage.app/o/media%2F")
  )
    throw new DomainError("INVALID_IMAGE_URL");
  return v;
}
export function videoUrl(v) {
  text(v, 1500);
  if (v === "" || /^\/assets\/retreat\/[a-zA-Z0-9_.-]+\.(mp4|webm)$/.test(v))
    return v;
  try {
    const u = new URL(v);
    if (
      u.protocol === "https:" &&
      u.hostname === "firebasestorage.googleapis.com" &&
      u.pathname.startsWith(
        "/v0/b/aroha-retreat.firebasestorage.app/o/media%2F",
      )
    )
      return v;
  } catch {}
  throw new DomainError("INVALID_VIDEO_URL");
}
export function validateTour(t) {
  obj(
    t,
    ["eyebrow", "title", "description", "mapNote", "stops", "media"],
    ["nature"],
  );
  if (t.nature !== undefined) validateNature(t.nature);
  for (const key of ["eyebrow", "title", "description", "mapNote"])
    text(t[key], 1500);
  arr(t.stops, 20, (s) => {
    obj(
      s,
      [
        "id",
        "name",
        "title",
        "description",
        "detail",
        "image",
        "imageAlt",
        "film",
        "mapX",
        "mapY",
        "nearby",
        "target",
      ],
      ["walk", "onMap"],
    );
    id(s.id);
    text(s.name, 80);
    text(s.title, 200);
    text(s.description, 600);
    text(s.detail);
    image(s);
    text(s.film, 48);
    if (s.onMap !== undefined) bool(s.onMap);
    if (s.walk !== undefined)
      arr(s.walk, 12, (w) => {
        obj(w, ["name", "film"]);
        text(w.name, 100);
        id(w.film);
      });
    for (const k of ["mapX", "mapY"])
      if (!Number.isFinite(s[k]) || s[k] < 0 || s[k] > 100)
        throw new DomainError("INVALID_MAP_POSITION");
    arr(s.nearby, 8, id);
    if (!["cottages", "experiences", "packages", "visit"].includes(s.target))
      throw new DomainError("INVALID_TARGET");
  });
  unique(t.stops);
  arr(t.media, 100, (m) => {
    obj(m, ["id", "kind", "name", "description", "image", "src", "stop"]);
    id(m.id);
    id(m.stop);
    text(m.name, 250);
    text(m.description, 1500);
    imageUrl(m.image);
    if (!["photo", "video"].includes(m.kind))
      throw new DomainError("INVALID_MEDIA_KIND");
    videoUrl(m.src);
    if ((m.kind === "photo" && m.src !== "") || (m.kind === "video" && !m.src))
      throw new DomainError("INVALID_MEDIA_SOURCE");
    if (!t.stops.some((s) => s.id === m.stop))
      throw new DomainError("INVALID_TOUR_REFERENCE");
  });
  unique(t.media);
  for (const s of t.stops) {
    if (
      s.walk?.some(
        (w) => !t.media.some((m) => m.id === w.film && m.kind === "video"),
      )
    )
      throw new DomainError("INVALID_TOUR_REFERENCE");
    if (s.film && !t.media.some((m) => m.id === s.film && m.kind === "video"))
      throw new DomainError("INVALID_TOUR_REFERENCE");
    if (s.nearby.some((id) => !t.stops.some((x) => x.id === id)))
      throw new DomainError("INVALID_TOUR_REFERENCE");
  }
  return t;
}
export function validateNature(n) {
  obj(
    n,
    [
      "enabled",
      "welcome",
      "welcomeTitle",
      "welcomeLabel",
      "leafImage",
      "plantImage",
      "eyebrow",
      "title",
      "description",
      "items",
    ],
    ["heroEveningImage", "heroEveningAlt"],
  );
  bool(n.enabled);
  bool(n.welcome);
  for (const k of ["welcomeTitle", "welcomeLabel", "eyebrow", "title"])
    text(n[k], 240);
  text(n.description, 2000);
  imageUrl(n.leafImage);
  imageUrl(n.plantImage);
  if (n.heroEveningImage !== undefined) imageUrl(n.heroEveningImage);
  if (n.heroEveningAlt !== undefined) text(n.heroEveningAlt, 250);
  arr(n.items, 5, (x) => {
    obj(x, ["value", "name", "description"]);
    text(x.value, 80);
    text(x.name, 150);
    text(x.description, 1200);
  });
  return n;
}
function image(v) {
  imageUrl(v.image);
  text(v.imageAlt, 250);
}
function unique(v) {
  if (new Set(v.map((x) => x.id)).size !== v.length)
    throw new DomainError("DUPLICATE_ID");
}
export function validateContent(c) {
  obj(
    c,
    [
      "schemaVersion",
      "brand",
      "hero",
      "intro",
      "sections",
      "journey",
      "cottages",
      "experiences",
      "packages",
      "gallery",
      "visit",
      "faqs",
      "theme",
      "seo",
    ],
    ["tour"],
  );
  if (c.schemaVersion !== 1 || JSON.stringify(c).length > 180000)
    throw new DomainError("INVALID_SCHEMA");
  if (c.tour !== undefined) validateTour(c.tour);
  obj(c.brand, ["name", "kannada", "tagline", "welcome", "welcomeKannada"]);
  Object.values(c.brand).forEach((v) => text(v, 240));
  obj(
    c.hero,
    [
      "eyebrow",
      "title",
      "description",
      "image",
      "imageAlt",
      "primaryLabel",
      "secondaryLabel",
      "mobileImage",
    ],
    ["worldImage", "eveningImage", "foregroundImage"],
  );
  Object.entries(c.hero)
    .filter(([k]) => k !== "image")
    .forEach(([, v]) => text(v, 1500));
  image(c.hero);
  imageUrl(c.hero.mobileImage);
  for (const key of ["worldImage", "eveningImage", "foregroundImage"]) {
    if (key in c.hero) imageUrl(c.hero[key]);
  }
  obj(c.intro, ["eyebrow", "title", "description", "image", "imageAlt"]);
  Object.entries(c.intro)
    .filter(([k]) => k !== "image")
    .forEach(([, v]) => text(v, 3000));
  image(c.intro);
  arr(c.sections, 6, (s) => {
    obj(s, ["id", "title", "eyebrow", "visible"]);
    if (
      ![
        "journey",
        "cottages",
        "experiences",
        "packages",
        "gallery",
        "visit",
      ].includes(s.id)
    )
      throw new DomainError("INVALID_SECTION");
    text(s.title, 200);
    text(s.eyebrow, 120);
    bool(s.visible);
  });
  unique(c.sections);
  arr(c.journey, 12, (s) => {
    obj(s, [
      "id",
      "name",
      "title",
      "description",
      "image",
      "imageAlt",
      "target",
    ]);
    id(s.id);
    text(s.name, 80);
    text(s.title, 200);
    text(s.description);
    image(s);
    if (!["cottages", "experiences", "packages", "visit"].includes(s.target))
      throw new DomainError("INVALID_TARGET");
  });
  unique(c.journey);
  arr(c.cottages, 12, (s) => {
    obj(s, [
      "id",
      "name",
      "description",
      "image",
      "imageAlt",
      "images",
      "detail",
    ]);
    id(s.id);
    text(s.name, 100);
    text(s.description);
    text(s.detail);
    image(s);
    arr(s.images, 12, imageUrl);
  });
  unique(c.cottages);
  arr(c.experiences, 24, (s) => {
    obj(s, ["id", "name", "description", "icon"]);
    id(s.id);
    text(s.name, 100);
    text(s.description);
    if (!["leaf", "sun", "heart", "bowl", "water", "fire"].includes(s.icon))
      throw new DomainError("INVALID_ICON");
  });
  unique(c.experiences);
  arr(c.packages, 12, (s) => {
    obj(s, [
      "id",
      "name",
      "subtitle",
      "price",
      "unit",
      "overnight",
      "featured",
      "description",
      "inclusions",
      "note",
    ]);
    id(s.id);
    ["name", "subtitle", "unit", "description", "note"].forEach((k) =>
      text(s[k], 1200),
    );
    if (!Number.isSafeInteger(s.price) || s.price < 0 || s.price > 10000000)
      throw new DomainError("INVALID_PRICE");
    bool(s.overnight);
    bool(s.featured);
    arr(s.inclusions, 20, (v) => text(v, 300));
  });
  unique(c.packages);
  arr(c.gallery, 36, (s) => {
    obj(s, ["image", "imageAlt"]);
    image(s);
  });
  obj(c.visit, [
    "description",
    "phone",
    "email",
    "mapUrl",
    "note",
    "enquiryLabel",
    "priceNote",
  ]);
  Object.values(c.visit).forEach((v) => text(v));
  if (!/^\d{10,15}$/.test(c.visit.phone))
    throw new DomainError("INVALID_PHONE");
  emailKey(c.visit.email);
  try {
    if (new URL(c.visit.mapUrl).protocol !== "https:") throw Error();
  } catch {
    throw new DomainError("INVALID_MAP_URL");
  }
  arr(c.faqs, 30, (s) => {
    obj(s, ["question", "answer"]);
    text(s.question, 300);
    text(s.answer);
  });
  obj(c.theme, ["forest", "ivory", "leaf", "bronze", "motion"]);
  ["forest", "ivory", "leaf", "bronze"].forEach((k) => {
    if (!/^#[0-9a-f]{6}$/i.test(c.theme[k]))
      throw new DomainError("INVALID_COLOR");
  });
  bool(c.theme.motion);
  obj(c.seo, ["title", "description"]);
  text(c.seo.title, 150);
  text(c.seo.description, 320);
  return c;
}
export function enquiryText(c, f) {
  const p = c.packages.find((p) => p.id === f.package);
  if (!p) throw new DomainError("CHOOSE_PACKAGE");
  const guests = Number(f.guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > 100)
    throw new DomainError("INVALID_GUESTS");
  const day = (v) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  if (!day(f.checkin)) throw new DomainError("CHOOSE_DATE");
  if (p.overnight && (!day(f.checkout) || f.checkout <= f.checkin))
    throw new DomainError("INVALID_CHECKOUT");
  const cottage = c.cottages.find((x) => x.id === f.cottage);
  if (p.overnight && f.cottage && !cottage)
    throw new DomainError("INVALID_COTTAGE");
  text(f.name, 100);
  text(f.phone, 30);
  text(f.message, 1000);
  if (!f.name.trim() || !/^\+?[\d\s()-]{7,25}$/.test(f.phone))
    throw new DomainError("CONTACT_DETAILS_REQUIRED");
  return `Hello Aroha! I would like to enquire about ${p.name}.\nDate: ${f.checkin}${p.overnight ? " to " + f.checkout : ""}\nGuests: ${guests}${p.overnight ? "\nPreferred cottage: " + (cottage?.name || "Please advise") : ""}\nName: ${f.name}\nPhone: ${f.phone}${f.message ? "\nMessage: " + f.message : ""}\nPlease confirm availability and the current tariff.`;
}
