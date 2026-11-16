import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, audioFormat } from "../apps/server/src/http.ts";
import type { AudioContent } from "../packages/shared/src/audio.ts";
test("MP3 validation requires a framed stream instead of an incidental sync sequence", () => {
  const frame = (bitrateHeader = 0x90, size = 417) => {
    const data = Buffer.alloc(size);
    data.set([0xff, 0xfb, bitrateHeader, 0], 0);
    return data;
  };
  const stream = Buffer.concat([frame(), frame(0xa0, 522)]);
  assert.equal(audioFormat(stream, "original.mp3").mime, "audio/mpeg");
  const id3 = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 5]);
  assert.equal(
    audioFormat(
      Buffer.concat([id3, Buffer.from("title"), stream]),
      "tagged.mp3",
    ).mime,
    "audio/mpeg",
  );
  const executable = Buffer.alloc(64);
  executable.write("MZ");
  executable.set([0xff, 0xfb, 0x90, 0], 16);
  assert.throws(() => audioFormat(executable, "unsafe.mp3"));
  assert.throws(() =>
    audioFormat(
      Buffer.concat([Buffer.from("leading junk"), stream]),
      "junk.mp3",
    ),
  );
  assert.throws(() => audioFormat(stream.subarray(0, 500), "truncated.mp3"));
});
test("audio administration authenticates, validates uploads and persists real publish/rollback", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url)),
    directory = await mkdtemp(join(tmpdir(), "neta-audio-api-"));
  let app = await createApp({ root, dataDirectory: directory, testMode: true }),
    base = "",
    cookie = "";
  const listen = async () => {
    await new Promise<void>((done, reject) => {
      app.server.once("error", reject);
      app.server.listen(0, "127.0.0.1", done);
    });
    const address = app.server.address();
    assert.ok(address && typeof address !== "string");
    base = "http://127.0.0.1:" + address.port;
  };
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = {},
  ) =>
    fetch(base + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    await listen();
    let response = await request("/api/admin/content");
    assert.equal(response.status, 401);
    response = await request("/api/admin/setup", "POST", {
      password: "synthetic-test-only-password-123",
    });
    assert.equal(response.status, 200);
    cookie = response.headers.get("set-cookie")!.split(";")[0];
    const publicBefore = (await (
      await request("/api/content")
    ).json()) as AudioContent;
    response = await request("/api/admin/setup", "POST", {
      password: "another-test-only-password",
    });
    assert.equal(response.status, 409);
    response = await request(
      "/api/admin/publish",
      "POST",
      { revision: 1 },
      { Origin: "https://unrelated.invalid" },
    );
    assert.equal(response.status, 403);
    const params = new URLSearchParams({
      name: "পরীক্ষার মৌলিক শব্দ",
      license: "নিজস্ব পরীক্ষার শব্দ",
      attribution: "এই প্রকল্পের মৌলিক অডিও",
      filename: "fixture.exe",
    });
    response = await fetch(base + "/api/admin/assets?" + params, {
      method: "POST",
      headers: { Cookie: cookie, "X-Audio-Rights": "confirmed" },
      body: Buffer.from("MZ-not-audio"),
    });
    assert.equal(response.status, 400);
    const wav = await readFile(join(root, "public/assets/audio/pickup.wav"));
    params.set("filename", "fixture.wav");
    response = await fetch(base + "/api/admin/assets?" + params, {
      method: "POST",
      headers: { Cookie: cookie, "X-Audio-Rights": "confirmed" },
      body: wav,
    });
    assert.equal(response.status, 201);
    const asset = await response.json();
    assert.equal(
      (await fetch(base + asset.url)).status,
      404,
      "unpublished upload is not public",
    );
    response = await request(asset.url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("vary"), "Cookie");
    const editor = await (await request("/api/admin/content")).json();
    let draft = editor.draft as AudioContent;
    draft.tracks[0].volume = 0.12;
    draft.cues[0].enabled = false;
    response = await request("/api/admin/content", "PUT", {
      content: draft,
      revision: draft.revision,
    });
    assert.equal(response.status, 200);
    draft = await response.json();
    assert.equal(
      (await (await fetch(base + "/api/content")).json()).tracks[0].volume,
      publicBefore.tracks[0].volume,
      "saving must not publish",
    );
    response = await request("/api/admin/publish", "POST", {
      revision: draft.revision,
    });
    assert.equal(response.status, 200);
    const published = await response.json();
    assert.equal(published.tracks[0].volume, 0.12);
    response = await fetch(base + asset.url, {
      headers: { Range: "bytes=0-43" },
    });
    assert.equal(response.status, 206);
    assert.equal((await response.arrayBuffer()).byteLength, 44);
    assert.equal(response.headers.get("content-type"), "audio/wav");
    assert.match(response.headers.get("cache-control") ?? "", /public/);
    response = await request("/api/admin/assets/import-bundled", "POST");
    assert.equal(response.status, 200);
    const imported = await response.json();
    assert.equal(imported.tracks[0].volume, 0.12);
    assert.equal(
      imported.cues[0].enabled,
      false,
      "bundled imports must preserve edited/disabled content",
    );
    response = await request("/api/admin/content", "PUT", {
      content: draft,
      revision: draft.revision,
    });
    assert.equal(
      response.status,
      409,
      "stale writes must not overwrite newer publication",
    );
    params.set("name", "এখনও প্রকাশ না করা কণ্ঠ");
    response = await fetch(base + "/api/admin/assets?" + params, {
      method: "POST",
      headers: { Cookie: cookie, "X-Audio-Rights": "confirmed" },
      body: wav,
    });
    assert.equal(response.status, 201);
    const unpublishedAsset = await response.json();
    const pendingEditor = await (await request("/api/admin/content")).json();
    pendingEditor.draft.tracks[0].name = "ফিরিয়ে আনার জন্য সংরক্ষিত খসড়া";
    pendingEditor.draft.tracks[0].volume = 0.11;
    response = await request("/api/admin/content", "PUT", {
      content: pendingEditor.draft,
      revision: pendingEditor.draft.revision,
    });
    assert.equal(response.status, 200);
    const pendingDraft = await response.json();
    const history = await (await request("/api/admin/content")).json();
    response = await request("/api/admin/rollback", "POST", {
      id: history.history[0].id,
      revision: pendingDraft.revision,
    });
    assert.equal(response.status, 200);
    const reverted = await response.json();
    assert.equal(reverted.tracks[0].volume, publicBefore.tracks[0].volume);
    assert.ok(reverted.revision > published.revision);
    assert.ok(
      reverted.revision > pendingDraft.revision,
      "rollback must advance beyond the latest draft token",
    );
    assert.equal(
      reverted.assets.some((a: { id: string }) => a.id === unpublishedAsset.id),
      false,
      "rollback must not publish an unpublished upload",
    );
    assert.equal((await fetch(base + unpublishedAsset.url)).status, 404);
    const rolledEditor = await (await request("/api/admin/content")).json();
    assert.ok(
      rolledEditor.draft.assets.some(
        (a: { id: string }) => a.id === unpublishedAsset.id,
      ),
      "unpublished upload must remain selectable",
    );
    const snapshot = rolledEditor.draftSnapshots.find(
      (s: { revision: number }) => s.revision === pendingDraft.revision,
    );
    assert.ok(snapshot, "rollback must durably retain the previous draft");
    response = await request("/api/admin/restore-draft", "POST", {
      id: snapshot.id,
      revision: rolledEditor.draft.revision,
    });
    assert.equal(response.status, 200);
    const restoredDraft = await response.json();
    assert.equal(restoredDraft.tracks[0].name, pendingDraft.tracks[0].name);
    assert.equal(restoredDraft.tracks[0].volume, 0.11);
    assert.ok(restoredDraft.revision > reverted.revision);
    assert.equal(
      (await (await request("/api/content")).json()).revision,
      reverted.revision,
      "draft restore must not publish",
    );
    assert.equal(
      (
        await request("/api/admin/restore-draft", "POST", {
          id: snapshot.id,
          revision: rolledEditor.draft.revision,
        })
      ).status,
      409,
      "stale restores must not overwrite a newer draft",
    );
    await new Promise<void>((done) => app.server.close(() => done()));
    app = await createApp({ root, dataDirectory: directory, testMode: true });
    await listen();
    cookie = "";
    assert.equal(
      (await (await request("/api/admin/session")).json()).setupRequired,
      false,
    );
    assert.equal(
      (await (await request("/api/content")).json()).revision,
      reverted.revision,
    );
    response = await request("/api/admin/login", "POST", {
      password: "synthetic-test-only-password-123",
    });
    assert.equal(response.status, 200);
    cookie = response.headers.get("set-cookie")!.split(";")[0];
    const persistedEditor = await (await request("/api/admin/content")).json();
    assert.equal(persistedEditor.draft.revision, restoredDraft.revision);
    assert.equal(
      persistedEditor.draft.tracks[0].name,
      pendingDraft.tracks[0].name,
    );
    assert.ok(
      persistedEditor.draftSnapshots.some(
        (s: { id: string }) => s.id === snapshot.id,
      ),
      "draft snapshot must survive server restart",
    );
    const stored = await readFile(join(directory, "admin.json"), "utf8");
    assert.ok(
      !stored.includes("synthetic-test-only-password-123"),
      "password must only persist as a salted hash",
    );
  } finally {
    await new Promise<void>((done) => app.server.close(() => done()));
    const checked = resolve(directory);
    assert.ok(checked.startsWith(resolve(tmpdir()) + sep + "neta-audio-api-"));
    await rm(checked, { recursive: true, force: true });
  }
});
