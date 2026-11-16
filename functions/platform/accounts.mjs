import { DomainError } from "../domain.mjs";

const MAX_PAGE = 50;
const EXPORT_BATCH = 1000;
const MAX_EXPORT_ROWS = 25_000;
const MAX_EXPORT_BYTES = 8 * 1024 * 1024;
const MAX_EXPORT_PAGES = 26;

const fail = (code, status = 422) => { throw new DomainError(code, status); };
const timestamp = (value) => {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};
const accountView = (record) => ({
  uid: record.uid,
  name: (record.displayName || "").slice(0, 160),
  email: record.email || "",
  providers: [...new Set((record.providerData || []).map(({ providerId }) => providerId))].sort(),
  createdAt: timestamp(record.metadata?.creationTime),
  lastSignInAt: timestamp(record.metadata?.lastSignInTime),
  disabled: record.disabled === true,
});

export function authAccountDirectory(auth, { testerEmails } = {}) {
  // The two environments share Auth. Pre-production reads only configured testers.
  const testers = testerEmails ? [...testerEmails].sort() : null;

  async function list(limit, cursor) {
    if (testers) {
      if (cursor && !/^test\.(?:[1-9]\d{0,5})$/.test(cursor)) fail("CURSOR_EXPIRED", 400);
      const offset = cursor ? Number(cursor.slice(5)) : 0;
      const batchSize = Math.min(limit, 100);
      if (offset && offset >= testers.length) fail("CURSOR_EXPIRED", 400);
      const emails = testers.slice(offset, offset + batchSize);
      const records = emails.length ? (await auth.getUsers(emails.map((email) => ({ email })))).users : [];
      const next = offset + batchSize;
      return {
        items: records.map(accountView).sort((a, b) => a.uid.localeCompare(b.uid)),
        nextCursor: next < testers.length ? "test." + next : null,
      };
    }
    if (cursor && !/^auth\.[!-~]+$/.test(cursor)) fail("CURSOR_EXPIRED", 400);
    try {
      const { users, pageToken } = await auth.listUsers(limit, cursor?.slice(5));
      return { items: users.map(accountView), nextCursor: pageToken ? "auth." + pageToken : null };
    } catch (error) {
      if (cursor && ["auth/invalid-page-token", "auth/invalid-argument", "auth/argument-error"].includes(error.code))
        fail("CURSOR_EXPIRED", 400);
      throw error;
    }
  }

  async function find(query) {
    const email = query.toLowerCase();
    const byEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(query);
    if (testers && !byEmail) {
      let cursor;
      do {
        const batch = await list(100, cursor);
        const match = batch.items.find((row) => row.uid === query);
        if (match) return [match];
        cursor = batch.nextCursor;
      } while (cursor);
      return [];
    }
    if (testers && !testers.includes(email)) return [];
    if (!byEmail && (query.includes("@") || query.length > 128)) fail("INVALID_ACCOUNT_QUERY");
    const result = await auth.getUsers([byEmail ? { email } : { uid: query }]);
    return result.users.map(accountView);
  }

  return { list, find };
}

export async function listAuthAccounts(directory, input) {
  if (!input || Array.isArray(input) || typeof input !== "object" ||
      Object.keys(input).some((key) => !["limit", "cursor", "query"].includes(key)))
    fail("INVALID_FIELDS");
  const { limit = 25, cursor, query } = input;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE) fail("INVALID_LIMIT");
  if (cursor !== undefined && (typeof cursor !== "string" || !cursor.length || cursor.length > 1800))
    fail("CURSOR_EXPIRED", 400);
  if (query !== undefined) {
    if (cursor !== undefined || typeof query !== "string" || !query.trim() ||
        query.length > 254 || /[\x00-\x1f\x7f]/.test(query)) fail("INVALID_ACCOUNT_QUERY");
    return { items: await directory.find(query.trim()), nextCursor: null };
  }
  return directory.list(limit, cursor);
}

function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^(?:\s*[=+\-@＝＋－＠]|[\t\r\n])/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export async function exportAuthAccounts(directory, deadline = Date.now() + 18_000) {
  const lines = ["\ufeffName,Email,Providers,Created (UTC),Last sign-in (UTC),User UID,Status\r\n"];
  let cursor, count = 0, bytes = Buffer.byteLength(lines[0]);
  for (let page = 0; page < MAX_EXPORT_PAGES; page++) {
    if (Date.now() >= deadline) fail("ACCOUNT_EXPORT_TIMEOUT", 504);
    const batch = await directory.list(EXPORT_BATCH, cursor);
    if (Date.now() >= deadline) fail("ACCOUNT_EXPORT_TIMEOUT", 504);
    if (count + batch.items.length > MAX_EXPORT_ROWS) fail("ACCOUNT_EXPORT_TOO_LARGE", 413);
    for (const row of batch.items) {
      const line = [row.name, row.email, row.providers.join(", "), row.createdAt, row.lastSignInAt,
        row.uid, row.disabled ? "Disabled" : "Active"].map(csvCell).join(",") + "\r\n";
      bytes += Buffer.byteLength(line);
      if (bytes > MAX_EXPORT_BYTES) fail("ACCOUNT_EXPORT_TOO_LARGE", 413);
      lines.push(line);
    }
    count += batch.items.length;
    if (!batch.nextCursor) return { csv: lines.join(""), count };
    cursor = batch.nextCursor;
  }
  fail("ACCOUNT_EXPORT_TOO_LARGE", 413);
}
