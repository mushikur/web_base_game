import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createApp } from "../apps/server/src/http.ts";
import { validateGameCatalog } from "../apps/server/src/gameCatalog.ts";
import { prepareGameAsset } from "../apps/server/src/gameCatalogAssets.ts";
import { defaultGameCatalog } from "../packages/shared/src/catalog.ts";
import {
  newCombatRecord,
  recordCombatHit,
} from "../packages/shared/src/combat.ts";
import { createNewspaper } from "../apps/game/src/newspaper.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = join(root, "public/assets/models/dhaka-character-phase01.glb");
const adminPath = "/api/admin/game-catalog";

test("phase 04 validates Bengali content and the configured scores and newspaper reach game rules", () => {
  const draft = defaultGameCatalog();
  draft.branding.title = "ঢাকার চায়ের পথ";
  draft.items.egg.score = 17;
  draft.newspaper.name = "ঢাকার দৈনিক";
  const value = validateGameCatalog(draft, []);
  const record = newCombatRecord();
  assert.equal(
    recordCombatHit(record, "egg", "leader", 0, value.items.egg.score).reward,
    17,
  );
  assert.equal(
    recordCombatHit(record, "egg", "civilian", 1, value.items.egg.score).reward,
    0,
  );
  assert.equal(
    createNewspaper(["promise-junction"], record, "", new Date(), value).name,
    "ঢাকার দৈনিক",
  );
  for (const name of ["English", "বাংলা Mixed", "ঢাকা हिन्दी"]) {
    draft.branding.title = name;
    assert.throws(() => validateGameCatalog(draft, []), /বাংলা/);
  }
});

test("phase 04 admits the actual compatible rig and refuses corrupted, static and external-resource GLB", async () => {
  const glb = await readFile(fixture);
  assert.equal((await prepareGameAsset("model", glb, root)).extension, "glb");
  const jsonEnd = 20 + glb.readUInt32LE(12);
  const model = JSON.parse(glb.subarray(20, jsonEnd).toString());
  const repack = (value: unknown) => {
    const raw = Buffer.from(JSON.stringify(value));
    const json = Buffer.concat([
      raw,
      Buffer.alloc((4 - (raw.length % 4)) % 4, 0x20),
    ]);
    const header = Buffer.from(glb.subarray(0, 20));
    header.writeUInt32LE(20 + json.length + glb.length - jsonEnd, 8);
    header.writeUInt32LE(json.length, 12);
    return Buffer.concat([header, json, glb.subarray(jsonEnd)]);
  };
  await assert.rejects(prepareGameAsset("model", Buffer.from("invalid"), root));
  await assert.rejects(
    prepareGameAsset(
      "model",
      repack({ ...model, animations: model.animations.slice(0, 1) }),
      root,
    ),
    /অ্যানিমেশন/,
  );
  await assert.rejects(
    prepareGameAsset(
      "model",
      repack({
        ...model,
        images: [{ uri: "https://example.invalid/private" }],
      }),
      root,
    ),
    /ফাইলের বাইরের/,
  );
});

test("phase 04 catalog auth, uploads, preview, publish, rollback and restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "neta-catalog-"));
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  let base = "",
    cookie = "";
  const start = async () => {
    app = await createApp({ root, dataDirectory: directory, testMode: true });
    app.server.listen(0, "127.0.0.1");
    await once(app.server, "listening");
    const address = app.server.address();
    assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}`;
  };
  const close = async () => {
    if (app?.server.listening)
      await new Promise<void>((done) => {
        app!.server.close(() => done());
      });
  };
  const send = (
    path: string,
    method = "GET",
    body?: unknown,
    authenticated = true,
  ) =>
    fetch(base + path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        ...(authenticated && cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
    });
  try {
    await start();
    const initial = await (await send("/api/game-catalog")).json();
    assert.equal((await send(adminPath + "/preview")).status, 401);
    const setup = await send("/api/admin/setup", "POST", {
      password: "phase04-automated-fixture-pass",
    });
    assert.equal(setup.status, 200);
    cookie = setup.headers.get("set-cookie")!.split(";")[0];
    const params = new URLSearchParams({
      kind: "image",
      name: "গলির প্রতীক",
      attribution: "পরীক্ষার নিজস্ব ছবি",
      revision: "1",
    });
    const png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#396154" },
    })
      .png()
      .toBuffer();
    const upload = await fetch(base + adminPath + "/upload?" + params, {
      method: "POST",
      headers: { Cookie: cookie, "X-Game-Rights": "confirmed" },
      body: new Uint8Array(png),
    });
    assert.equal(upload.status, 201);
    const { draft } = await upload.json();
    const [asset] = draft.assets;
    assert.equal((await send(asset.url, "GET", undefined, false)).status, 404);
    assert.equal(
      (await send(asset.url)).headers.get("content-type"),
      "image/webp",
    );
    draft.branding = {
      ...draft.branding,
      title: "পাড়ার চায়ের খবর".normalize("NFC"),
      logo: asset.id,
    };
    draft.items.egg.quantity = 9;
    const stale = await send(adminPath, "PUT", { revision: 1, content: draft });
    assert.equal(stale.status, 409);
    const saved = await send(adminPath, "PUT", {
      revision: draft.revision,
      content: draft,
    });
    assert.equal(saved.status, 200);
    const state = await saved.json();
    assert.equal(
      (await (await send("/api/game-catalog")).json()).branding.title,
      initial.branding.title,
    );
    const preview = await (await send(adminPath + "/preview")).json();
    assert.equal(preview.branding.title, draft.branding.title);
    assert.equal(preview.items.egg.quantity, 9);
    const published = await send(adminPath + "/publish", "POST", {
      revision: state.draft.revision,
    });
    assert.equal(published.status, 200);
    const next = await published.json();
    assert.equal((await send(asset.url, "GET", undefined, false)).status, 200);
    assert.equal(
      (await (await send("/api/game-catalog")).json()).branding.title,
      draft.branding.title,
    );
    const rollback = await send(adminPath + "/rollback", "POST", {
      id: next.history[0].id,
      revision: next.draft.revision,
    });
    assert.equal(rollback.status, 200);
    const restored = await rollback.json();
    assert.equal(restored.draft.branding.title, draft.branding.title);
    assert.ok(restored.audit.length >= 4);
    await close();
    await start();
    assert.equal(
      (await (await send("/api/game-catalog")).json()).branding.title,
      initial.branding.title,
    );
    assert.equal((await send(asset.url, "GET", undefined, false)).status, 404);
  } finally {
    await close();
    await rm(directory, { recursive: true, force: true });
  }
});
