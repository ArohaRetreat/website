import { getAuth } from "firebase-admin/auth";
import { randomUUID, createHash } from "node:crypto";
import { collectionName } from "../environment.mjs";
import { BookingError } from "./domain.mjs";
import { validEmail } from "../email/config.mjs";
import { contactDetails } from "./contact.mjs";
const fail = (c, s = 409) => {
  throw new BookingError(c, s);
};
export const customerProfiles = (db) =>
  db.collection(collectionName("booking_profiles"));
const links = (db) => db.collection(collectionName("booking_customer_links"));
const emailKey = (db, email) =>
  db
    .collection(collectionName("booking_customer_keys"))
    .doc(createHash("sha256").update(email).digest("hex"));
export const normalizedEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
async function exactProfiles(tx, db, email, limit) {
  const snapshots = await Promise.all(
    ["email", "searchEmail"].map((field) =>
      tx.get(customerProfiles(db).where(field, "==", email).limit(limit)),
    ),
  );
  const docs = [
    ...new Map(snapshots.flatMap((s) => s.docs).map((d) => [d.id, d])).values(),
  ];
  return { size: docs.length, docs };
}

export const customerSearchFields = (p) => ({
  searchName: String(p.contact?.name || p.name || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase(),
  searchEmail: normalizedEmail(p.email),
  searchPhone: String(p.contact?.phone || "").replace(/[^+0-9]/g, ""),
});
export async function customerBinding(tx, db, token) {
  const own = { ownerIds: [token.uid], customerId: token.uid };
  if (
    token.email_verified !== true ||
    token.firebase?.sign_in_provider !== "google.com"
  )
    return own;
  const link = (await tx.get(links(db).doc(token.uid))).data();
  if (!link?.active) return own;
  const profile = (
    await tx.get(customerProfiles(db).doc(link.customerId))
  ).data();
  if (!profile || profile.linkedUid !== token.uid) return own;
  return {
    ownerIds: [...new Set([token.uid, link.customerId])],
    customerId: link.customerId,
    bindingVersion: link.version,
  };
}
export async function readCustomerBinding(db, token) {
  return db.runTransaction((tx) => customerBinding(tx, db, token));
}
export async function claimCustomer({ tx, db, ctx }) {
  const token = ctx.token;
  if (
    token.email_verified !== true ||
    token.firebase?.sign_in_provider !== "google.com"
  )
    fail("VERIFIED_GOOGLE_ACCOUNT_REQUIRED", 403);
  const email = normalizedEmail(token.email);
  if (!validEmail(email)) fail("INVALID_EMAIL", 422);
  const own = (await tx.get(customerProfiles(db).doc(token.uid))).data();
  if (own?.erasedAt) fail("PROFILE_RECREATE_REQUIRED");
  const current = (await tx.get(links(db).doc(token.uid))).data();
  if (current?.active) {
    const linked = (
      await tx.get(customerProfiles(db).doc(current.customerId))
    ).data();
    if (linked?.linkedUid !== token.uid || linked.erasedAt)
      fail("CUSTOMER_LINK_REVIEW_REQUIRED");
    return {
      linked: true,
      customerId: current.customerId,
      version: current.version,
    };
  }
  const keyRef = emailKey(db, email),
    key = (await tx.get(keyRef)).data();
  const matches = key
    ? {
        size: 1,
        docs: [await tx.get(customerProfiles(db).doc(key.customerId))],
      }
    : await exactProfiles(tx, db, email, 4);
  if (key && (!matches.docs[0].exists || matches.docs[0].data().erasedAt))
    fail("CUSTOMER_LINK_REVIEW_REQUIRED");
  if (matches.size >= 4) fail("CUSTOMER_LINK_REVIEW_REQUIRED");
  const candidates = matches.docs.filter(
    (d) => d.exists && d.id !== token.uid && !d.data().erasedAt,
  );
  if (!candidates.length) {
    if (!own) {
      const p = {
        id: token.uid,
        name: String(token.name || "Guest").slice(0, 80),
        email,
        completedStays: 0,
        activeIds: [],
        createdAt: ctx.now,
      };
      tx.set(customerProfiles(db).doc(token.uid), {
        ...p,
        ...customerSearchFields(p),
      });
    }
    if (!key) tx.set(keyRef, { customerId: token.uid, createdAt: ctx.now });
    return { linked: false, customerId: token.uid, version: 0 };
  }
  if (candidates.length !== 1) fail("CUSTOMER_LINK_REVIEW_REQUIRED");
  const match = candidates[0],
    p = match.data();
  if (normalizedEmail(p.email) !== email) fail("CUSTOMER_LINK_REVIEW_REQUIRED");
  if (
    !["host_manual", "host_recorded"].includes(p.identitySource) ||
    (p.linkedUid && p.linkedUid !== token.uid)
  )
    fail("CUSTOMER_LINK_REVIEW_REQUIRED");
  const next = {
    active: true,
    customerId: match.id,
    uid: token.uid,
    version: (current?.version || 0) + 1,
    claimedAt: ctx.now,
    emailHash: createHash("sha256").update(email).digest("hex"),
  };
  tx.set(match.ref, {
    ...p,
    linkedUid: token.uid,
    linkedAt: ctx.now,
    identityVersion: (p.identityVersion || 0) + 1,
    ...customerSearchFields(p),
  });
  tx.set(links(db).doc(token.uid), next);
  if (!key) tx.set(keyRef, { customerId: match.id, createdAt: ctx.now });
  return { linked: true, customerId: match.id, version: next.version };
}
export async function resolveManualCustomer(tx, db, input, now) {
  const email = normalizedEmail(input.email),
    contact = contactDetails({ name: input.name, phone: input.phone });
  if (!validEmail(email)) fail("INVALID_EMAIL", 422);
  // A single private exact lookup, never a directory scan or an Auth account creation.
  const keyRef = emailKey(db, email),
    key = (await tx.get(keyRef)).data();
  const matches = key
    ? {
        size: 1,
        docs: [await tx.get(customerProfiles(db).doc(key.customerId))],
      }
    : await exactProfiles(tx, db, email, 3);
  if (matches.size > 1) fail("CUSTOMER_LINK_REVIEW_REQUIRED");
  const found = matches.docs[0],
    p = found?.data();
  if (key && !p) fail("CUSTOMER_LINK_REVIEW_REQUIRED");
  if (p?.erasedAt) fail("PROFILE_RECREATE_REQUIRED");
  if (p && normalizedEmail(p.email) !== email)
    fail("CUSTOMER_LINK_REVIEW_REQUIRED");
  if (
    p &&
    (p.linkedUid ||
      !["host_manual", "host_recorded"].includes(p.identitySource))
  ) {
    let account;
    try {
      account = await getAuth().getUser(p.linkedUid || found.id);
    } catch (e) {
      if (e.code === "auth/user-not-found")
        fail("CUSTOMER_LINK_REVIEW_REQUIRED");
      throw e;
    }
    if (
      account.disabled ||
      !account.emailVerified ||
      normalizedEmail(account.email) !== email
    )
      fail("CUSTOMER_LINK_REVIEW_REQUIRED");
  }
  if (p)
    return {
      profile: p,
      ref: found.ref,
      contact,
      email,
      create: false,
      keyRef,
      createIndex: !key,
    };
  const id = "customer-" + randomUUID(),
    profile = {
      id,
      name: contact.name,
      email,
      contact,
      contactVersion: 1,
      identitySource: "host_manual",
      identityVersion: 1,
      completedStays: 0,
      activeIds: [],
      createdAt: now,
      updatedAt: now,
    };
  return {
    profile: { ...profile, ...customerSearchFields(profile) },
    ref: customerProfiles(db).doc(id),
    contact,
    email,
    create: true,
    keyRef,
    createIndex: true,
  };
}
export async function customerOwnerContext(tx, db, owner, existing) {
  const p = existing ?? (await tx.get(customerProfiles(db).doc(owner))).data();
  if (!p) fail("INVALID_GUEST", 422);
  const uid = p.linkedUid || owner,
    link = (await tx.get(links(db).doc(uid))).data();
  const profiles = new Map([[owner, p]]);
  if (link?.active) {
    const linked =
      link.customerId === owner
        ? p
        : (await tx.get(customerProfiles(db).doc(link.customerId))).data();
    if (linked?.linkedUid === uid) {
      profiles.set(link.customerId, linked);
      if (uid !== owner) {
        const account = (await tx.get(customerProfiles(db).doc(uid))).data();
        if (account) profiles.set(uid, account);
      }
    }
  }
  return {
    ownerIds: [...profiles.keys()],
    profiles,
    completedStays: [...profiles.values()].reduce(
      (n, v) => n + (v.completedStays || 0),
      0,
    ),
  };
}
