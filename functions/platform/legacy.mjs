import { platformOperation } from "./service.mjs";
import { col, fail } from "./core.mjs";
// Translate the established Studio protocol without duplicating domain authorization.
export async function legacyPlatform(db, token, req, path, body, requestId) {
  const run = (op, input = {}) =>
    platformOperation(
      db,
      token,
      op,
      input,
      req.get("Idempotency-Key") || requestId,
      { requestId },
    );
  if (path === "/draft" && req.method === "GET") {
    const r = await run("getContentDraft");
    return {
      draft: r.exists
        ? {
            content: r.content,
            version: r.version,
            updatedAt: r.updatedAt,
            updatedBy: r.updatedBy,
          }
        : null,
      requestId,
    };
  }
  if (path === "/draft" && req.method === "POST") {
    const current = await run("getContentDraft");
    if (!current.exists) {
      if (body.expectedVersion !== 0) fail("VERSION_CONFLICT", 409);
      const r = await run("createContentDraft", { content: body.content });
      return { version: r.version, requestId };
    }
    const r = await run("saveContentDraft", {
      content: body.content,
      expectedVersion: body.expectedVersion,
    });
    return { version: r.version, requestId };
  }
  if (["/publish", "/restore"].includes(path) && req.method === "POST") {
    const r = await run(
      path === "/publish" ? "publishContent" : "restoreContentDraft",
      {
        expectedVersion: body.expectedVersion,
        ...(path === "/restore" ? { revision: body.revision } : {}),
      },
    );
    return { version: r.version, requestId };
  }
  if (path === "/revisions" && req.method === "GET") {
    // Keep the established numeric revision cursor on this legacy transport.
    await run("getContentDraft");
    const n = Number(req.query.cursor);
    if (req.query.cursor && (!Number.isSafeInteger(n) || n < 0))
      fail("INVALID_CURSOR");
    let q = col(db, "revisions").orderBy("version", "desc");
    if (req.query.cursor) q = q.startAfter(n);
    const rows = (await q.limit(26).get()).docs;
    return {
      revisions: rows
        .slice(0, 25)
        .map((d) => ({
          id: d.id,
          version: d.data().version,
          publishedAt:
            d.data().publishedAt?.toDate?.().toISOString() ||
            new Date(d.data().publishedAt).toISOString(),
        })),
      nextCursor: rows.length > 25 ? rows[24].data().version : null,
      requestId,
    };
  }
  if (["/members", "/invitations"].includes(path) && req.method === "GET") {
    const type = path.slice(1);
    const r = await run(
      type === "members" ? "listMembers" : "listInvitations",
      { limit: 50, ...(req.query.cursor ? { cursor: req.query.cursor } : {}) },
    );
    return { [type]: r.items, nextCursor: r.nextCursor, requestId };
  }
  if (path === "/invitations" && req.method === "POST") {
    const r = await run("createInvitation", body);
    return { inviteUrl: r.inviteUrl, expiresInDays: 7, requestId };
  }
  const match = /^\/(members|invitations)\/([A-Za-z0-9:_-]{1,128})$/.exec(path);
  if (
    match &&
    ((match[1] === "members" && req.method === "POST") ||
      (match[1] === "invitations" && req.method === "DELETE"))
  ) {
    const type = match[1],
      id = match[2];
    if (type === "members" && id === token.uid) fail("INVALID_MEMBER", 400);
    const r = await run(type === "members" ? "getMember" : "getInvitation", {
      id,
    });
    await run(type === "members" ? "updateMember" : "revokeInvitation", {
      ...body,
      id,
      expectedVersion: body.expectedVersion ?? r.version,
    });
    return { ok: true, requestId };
  }
  return undefined;
}
