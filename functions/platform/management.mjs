import {
  col,
  bounded,
  fail,
  version,
  page,
  digest,
  queryPage,
} from "./core.mjs";
import { sharedCollectionName, environment } from "../environment.mjs";
import { validateContent, emailKey, mayManage } from "../domain.mjs";
import { validModuleAccess } from "../access.mjs";
const time = (v) =>
  v?.toMillis?.() ?? (typeof v === "number" ? v : Date.parse(v || "") || null);
const memberView = (m) => ({
  id: m.id,
  email: m.email,
  role: m.role,
  active: m.active,
  version: m.version || 0,
  ...(m.websiteAccess === undefined ? {} : { websiteAccess: m.websiteAccess }),
  ...(m.bookingAccess === undefined ? {} : { bookingAccess: m.bookingAccess }),
  updatedAt: time(m.updatedAt),
});
const inviteView = (v) => ({
  id: v.id,
  email: v.email,
  role: v.role,
  status: v.status,
  expiresAt: v.expiresAt,
  version: v.version || 0,
  ...(v.websiteAccess === undefined ? {} : { websiteAccess: v.websiteAccess }),
  ...(v.bookingAccess === undefined ? {} : { bookingAccess: v.bookingAccess }),
  updatedAt: time(v.updatedAt),
});
const owners = () =>
  new Set(
    (process.env.SUPER_ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
export async function managementHandler({ tx, db, ctx, input }) {
  const op = ctx.operation,
    write = ![
      "listMembers",
      "getMember",
      "listInvitations",
      "getInvitation",
    ].includes(op);
  if (environment.preprod && write) fail("PREPROD_ACCESS_READ_ONLY", 403);
  const members = db.collection(sharedCollectionName("members")),
    invitations = db.collection(sharedCollectionName("invitations"));
  if (op === "listMembers")
    return queryPage(tx, db, ctx, op, input, members, memberView);
  if (op === "listInvitations")
    return queryPage(tx, db, ctx, op, input, invitations, inviteView);
  if (op === "createInvitation") {
    if (!validModuleAccess(input)) fail("INVALID_MODULE_ACCESS");
    const email = emailKey(input.email);
    if (!mayManage(ctx.member.role, "viewer", input.role))
      fail("FORBIDDEN", 403);
    if (owners().has(email)) fail("PROTECTED_OWNER", 409);
    if ((await tx.get(members.where("email", "==", email).limit(1))).size)
      fail("MEMBER_EXISTS", 409);
    const ref = invitations.doc(digest(email)),
      old = (await tx.get(ref)).data();
    if (old?.status === "pending" && old.expiresAt > ctx.now)
      fail("INVITATION_EXISTS", 409);
    const item = {
      id: ref.id,
      email,
      role: input.role,
      status: "pending",
      expiresAt: ctx.now + 7 * 86400000,
      invitedBy: ctx.uid,
      version: (old?.version || 0) + 1,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      ...(input.websiteAccess === undefined
        ? {}
        : { websiteAccess: input.websiteAccess }),
      ...(input.bookingAccess === undefined
        ? {}
        : { bookingAccess: input.bookingAccess }),
    };
    tx.set(ref, item);
    return { ...inviteView(item), inviteUrl: environment.origin + "/admin/" };
  }
  const isMember = ["getMember", "updateMember", "revokeMember"].includes(op),
    ref = (isMember ? members : invitations).doc(input.id),
    doc = (await tx.get(ref)).data();
  if (!doc) fail("NOT_FOUND", 404);
  if (op === "getMember") return memberView({ id: ref.id, ...doc });
  if (op === "getInvitation") return inviteView({ id: ref.id, ...doc });
  version(doc.version || 0, input.expectedVersion);
  if (isMember) {
    const nextRole = input.role || doc.role;
    if (
      input.id === ctx.uid ||
      owners().has(doc.email) ||
      !mayManage(ctx.member.role, doc.role, nextRole)
    )
      fail("FORBIDDEN", 403);
    if (!validModuleAccess(input)) fail("INVALID_MODULE_ACCESS");
    const next = {
      ...doc,
      role: nextRole,
      active: op === "revokeMember" ? false : (input.active ?? doc.active),
      version: (doc.version || 0) + 1,
      updatedAt: ctx.now,
      ...(input.websiteAccess === undefined
        ? {}
        : { websiteAccess: input.websiteAccess }),
      ...(input.bookingAccess === undefined
        ? {}
        : { bookingAccess: input.bookingAccess }),
    };
    tx.set(ref, next);
    return memberView({ id: ref.id, ...next });
  }
  if (!mayManage(ctx.member.role, doc.role, doc.role)) fail("FORBIDDEN", 403);
  if (doc.status !== "pending") fail("INVITATION_NOT_PENDING", 409);
  const next = {
    ...doc,
    status: "revoked",
    version: (doc.version || 0) + 1,
    updatedAt: ctx.now,
  };
  tx.set(ref, next);
  return inviteView({ id: ref.id, ...next });
}
export async function contentHandler({ tx, db, ctx, input }) {
  const op = ctx.operation,
    draftRef = col(db, "content").doc("draft"),
    pubRef = col(db, "public").doc("site"),
    counterRef = col(db, "content").doc("version_counter");
  if (op === "listContentRevisions") {
    return queryPage(
      tx,
      db,
      ctx,
      op,
      input,
      col(db, "revisions"),
      (r) => ({
        id: r.id,
        version: r.version,
        publishedAt: time(r.publishedAt),
        createdAt: time(r.publishedAt),
      }),
      { orderField: "version", descending: true },
    );
  }
  const d = (await tx.get(draftRef)).data();
  if (op === "getContentDraft")
    return {
      id: "draft",
      exists: !!d,
      version: d?.version || 0,
      content: d?.content || null,
      updatedAt: time(d?.updatedAt),
      updatedBy: d?.updatedBy || null,
    };
  const [published, counter] = await Promise.all([
    tx.get(pubRef),
    tx.get(counterRef),
  ]);
  const latest = Math.max(
    d?.version || 0,
    published.data()?.version || 0,
    counter.data()?.version || 0,
  );
  if (op === "createContentDraft") {
    if (d) fail("DRAFT_ALREADY_EXISTS", 409);
    validateContent(input.content);
    const result = {
      content: input.content,
      version: latest + 1,
      updatedAt: ctx.now,
      updatedBy: ctx.uid,
    };
    tx.set(draftRef, result);
    tx.set(counterRef, { version: result.version });
    return { id: "draft", ...result };
  }
  version(d?.version || 0, input.expectedVersion);
  if (op === "saveContentDraft") {
    if (!d) fail("NO_DRAFT", 404);
    validateContent(input.content);
    const result = {
      content: input.content,
      version: latest + 1,
      updatedAt: ctx.now,
      updatedBy: ctx.uid,
    };
    tx.set(draftRef, result);
    tx.set(counterRef, { version: result.version });
    return { id: "draft", ...result };
  }
  if (op === "discardContentDraft") {
    if (!d) fail("NO_DRAFT", 404);
    tx.set(col(db, "draft_archives").doc(), {
      ...d,
      archivedAt: ctx.now,
      archivedBy: ctx.uid,
    });
    tx.delete(draftRef);
    tx.set(counterRef, { version: latest });
    return { id: "draft", archived: true, version: d.version };
  }
  if (op === "publishContent") {
    if (!d) fail("NO_DRAFT", 404);
    validateContent(d.content);
    if (published.data()?.version === d.version) fail("ALREADY_PUBLISHED", 409);
    const revisionRef = col(db, "revisions").doc(String(d.version));
    if ((await tx.get(revisionRef)).exists) fail("REVISION_EXISTS", 409);
    tx.create(revisionRef, {
      ...d,
      publishedAt: ctx.now,
      publishedBy: ctx.uid,
    });
    tx.set(pubRef, {
      content: d.content,
      version: d.version,
      publishedAt: ctx.now,
    });
    return { id: "site", version: d.version };
  }
  if (op === "restoreContentDraft") {
    const old = (
      await tx.get(col(db, "revisions").doc(String(input.revision)))
    ).data();
    if (!old) fail("NOT_FOUND", 404);
    validateContent(old.content);
    if (d)
      tx.set(col(db, "draft_archives").doc(), {
        ...d,
        archivedAt: ctx.now,
        archivedBy: ctx.uid,
      });
    const result = {
      content: old.content,
      version: latest + 1,
      updatedAt: ctx.now,
      updatedBy: ctx.uid,
      restoredFrom: input.revision,
    };
    tx.set(draftRef, result);
    tx.set(counterRef, { version: result.version });
    return { id: "draft", ...result };
  }
  fail("NOT_FOUND", 404);
}
