import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST
)
  throw Error("Emulators required; production testing is forbidden");
const project = "demo-aroha",
  base = "http://127.0.0.1:5001/" + project + "/asia-south2/arohaApi/api/v1";
const content = JSON.parse(
  await readFile(new URL("../../website/content.json", import.meta.url)),
);
content.tour = JSON.parse(
  await readFile(new URL("../../website/tour-content.json", import.meta.url)),
);
content.tour.nature = JSON.parse(
  await readFile(new URL("../../website/nature-content.json", import.meta.url)),
);
async function google(email, verified = true) {
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: email,
        email,
        email_verified: verified,
        name: "Synthetic emulator guest",
        iss: "https://accounts.google.com",
        aud: project,
      }),
    ).toString("base64url"),
    "",
  ].join(".");
  const r = await fetch(
    "http://" +
      process.env.FIREBASE_AUTH_EMULATOR_HOST +
      "/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=emulator",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: "id_token=" + jwt + "&providerId=google.com",
        requestUri: "http://localhost",
        returnSecureToken: true,
      }),
    },
  );
  const data = await r.json();
  assert.ok(r.ok, JSON.stringify(data));
  return data;
}
async function call(token, path, method = "GET", body) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  return { status: r.status, ...data };
}
test("complete content and membership lifecycle with independent rule denials", async () => {
  const env = await initializeTestEnvironment({
    projectId: project,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile(
        new URL("../../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: await readFile(
        new URL("../../storage.rules", import.meta.url),
        "utf8",
      ),
    },
  });
  try {
    await env.clearFirestore();
    assert.equal((await call(null, "/draft")).status, 401);
    const outsider = await google("outsider@example.test");
    assert.equal(
      (await call(outsider.idToken, "/session", "POST", {})).status,
      403,
    );
    const owner = await google("owner@example.test");
    const ownerSession = await call(owner.idToken, "/session", "POST", {});
    assert.equal(ownerSession.status, 200, JSON.stringify(ownerSession));
    assert.equal(ownerSession.session.role, "superadmin");
    const invite = await call(owner.idToken, "/invitations", "POST", {
      email: "editor@example.test",
      role: "editor",
    });
    assert.equal(invite.status, 200);
    const wrongEmail = await google("wrong@example.test");
    assert.equal(
      (await call(wrongEmail.idToken, "/session", "POST", {})).status,
      403,
    );
    const editor = await google("editor@example.test");
    const editorSession = await call(editor.idToken, "/session", "POST", {});
    assert.equal(
      editorSession.session?.role,
      "editor",
      JSON.stringify(editorSession),
    );
    const editToken = editor.idToken;
    let r = await call(editToken, "/draft", "POST", {
      content,
      expectedVersion: 0,
    });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.version, 1);
    assert.equal(
      (await call(editToken, "/draft", "POST", { content, expectedVersion: 0 }))
        .status,
      409,
    );
    assert.equal(
      (await call(editToken, "/publish", "POST", { expectedVersion: 1 }))
        .status,
      403,
    );
    assert.equal(
      (
        await call(editToken, "/invitations", "POST", {
          email: "other@example.test",
          role: "admin",
        })
      ).status,
      403,
    );
    assert.equal(
      (await call(owner.idToken, "/publish", "POST", { expectedVersion: 1 }))
        .status,
      200,
    );
    const anon = env.unauthenticatedContext();
    await assertSucceeds(getDoc(doc(anon.firestore(), "aroha_public/site")));
    await assertFails(getDoc(doc(anon.firestore(), "aroha_content/draft")));
    await assertFails(
      setDoc(doc(anon.firestore(), "aroha_public/site"), { content }),
    );
    const client = env.authenticatedContext(editor.localId, {
      email: "editor@example.test",
      email_verified: true,
    });
    await assertFails(
      setDoc(doc(client.firestore(), "aroha_members/" + editor.localId), {
        role: "superadmin",
        active: true,
      }),
    );
    await assertFails(
      setDoc(doc(client.firestore(), "aroha_content/draft"), { content }),
    );
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    await assertFails(
      uploadBytes(ref(anon.storage(), "media/no-auth.png"), png, {
        contentType: "image/png",
      }),
    );
    await assertSucceeds(
      uploadBytes(ref(client.storage(), "media/allowed.png"), png, {
        contentType: "image/png",
      }),
    );
    await assertSucceeds(
      uploadBytes(ref(client.storage(), "media/walk.mp4"), png, {
        contentType: "video/mp4",
      }),
    );
    await assertFails(
      uploadBytes(ref(anon.storage(), "media/anonymous.mp4"), png, {
        contentType: "video/mp4",
      }),
    );
    await assertFails(
      uploadBytes(ref(client.storage(), "media/raw.mov"), png, {
        contentType: "video/quicktime",
      }),
    );
    await assertFails(
      uploadBytes(ref(client.storage(), "media/script.svg"), png, {
        contentType: "image/svg+xml",
      }),
    );
    r = await call(owner.idToken, "/restore", "POST", {
      revision: 1,
      expectedVersion: 1,
    });
    assert.equal(r.version, 2);
    assert.equal((await call(owner.idToken, "/draft")).draft.version, 2);
    const members = await call(owner.idToken, "/members");
    assert.ok(members.members.some((x) => x.id === editor.localId));
    assert.equal(
      (
        await call(owner.idToken, "/members/" + owner.localId, "POST", {
          role: "viewer",
          active: false,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(owner.idToken, "/members/" + editor.localId, "POST", {
          role: "superadmin",
          active: true,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call(owner.idToken, "/members/" + editor.localId, "POST", {
          role: "editor",
          active: false,
        })
      ).status,
      200,
    );
    assert.equal((await call(editToken, "/draft")).status, 403);
    assert.equal((await call(editToken, "/session", "POST", {})).status, 403);
    await assertFails(
      uploadBytes(ref(client.storage(), "media/revoked.png"), png, {
        contentType: "image/png",
      }),
    );
    assert.equal(
      (
        await call(owner.idToken, "/invitations", "POST", {
          email: "cancel@example.test",
          role: "viewer",
        })
      ).status,
      200,
    );
    const invites = await call(owner.idToken, "/invitations"),
      cancel = invites.invitations.find(
        (x) => x.email === "cancel@example.test",
      );
    assert.equal(
      (await call(owner.idToken, "/invitations/" + cancel.id, "DELETE")).status,
      200,
    );
    const cancelled = await google("cancel@example.test");
    assert.equal(
      (await call(cancelled.idToken, "/session", "POST", {})).status,
      403,
    );
    assert.ok(
      (await call(owner.idToken, "/revisions")).revisions.some(
        (x) => x.version === 1,
      ),
    );
  } finally {
    await env.cleanup();
  }
});
