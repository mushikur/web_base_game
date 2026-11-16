import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../apps/server/src/http.ts";
import { SpawnStore } from "../apps/server/src/spawns.ts";
import {
  factorySpawnRegistry,
  type SpawnRegistry,
} from "../packages/shared/src/spawns.ts";

async function removeFixture(directory: string) {
  const checked = resolve(directory);
  assert.ok(checked.startsWith(resolve(tmpdir()) + sep + "neta-spawns-"));
  await rm(checked, { recursive: true, force: true });
}
test("spawn seed is atomic/create-only and invalid stored data is preserved without touching audio", async () => {
  const directory = await mkdtemp(join(tmpdir(), "neta-spawns-"));
  try {
    const audioPath = join(directory, "content.json");
    await writeFile(audioPath, "independent-existing-audio-data");
    const first = new SpawnStore(directory),
      second = new SpawnStore(directory);
    await Promise.all([first.init(), second.init()]);
    assert.deepEqual(first.published(), factorySpawnRegistry);
    assert.deepEqual(second.published(), factorySpawnRegistry);
    const spawnPath = join(directory, "spawn-content/published.json");
    await writeFile(spawnPath, "malformed-preserve-for-repair");
    const broken = new SpawnStore(directory);
    await broken.init();
    assert.throws(() => broken.published(), /নিরাপদ স্থানের/u);
    assert.equal(
      await readFile(spawnPath, "utf8"),
      "malformed-preserve-for-repair",
    );
    assert.equal(
      await readFile(audioPath, "utf8"),
      "independent-existing-audio-data",
    );
  } finally {
    await removeFixture(directory);
  }
});
test("public spawn read needs no Admin setup and survives audio publication, rollback and restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "neta-spawns-")),
    root = fileURLToPath(new URL("../", import.meta.url));
  let app = await createApp({ root, dataDirectory: directory, testMode: true }),
    base = "";
  const listen = async () => {
    await new Promise<void>((done, reject) => {
      app.server.once("error", reject);
      app.server.listen(0, "127.0.0.1", done);
    });
    const address = app.server.address();
    assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}`;
  };
  const close = () =>
    new Promise<void>((done) => app.server.close(() => done()));
  try {
    await listen();
    let response = await fetch(base + "/api/spawns");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), factorySpawnRegistry);
    assert.equal(
      (await (await fetch(base + "/api/admin/session")).json()).setupRequired,
      true,
    );
    const spawnPath = join(directory, "spawn-content/published.json"),
      before = await readFile(spawnPath, "utf8");
    const draft = structuredClone(app.store.state.draft);
    draft.tracks[0].name = "আলাদা অডিও প্রকাশনার পরীক্ষা";
    await app.store.save(draft, draft.revision);
    await app.store.publish(app.store.state.draft.revision);
    await app.store.rollback(
      app.store.state.history[0].id,
      app.store.state.draft.revision,
    );
    assert.equal(
      await readFile(spawnPath, "utf8"),
      before,
      "audio publication/rollback has no spawn write path",
    );
    response = await fetch(base + "/api/spawns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true, x: 0, z: 0 }),
    });
    assert.equal(
      response.status,
      405,
      "public players cannot publish coordinates",
    );
    await close();
    app = await createApp({ root, dataDirectory: directory, testMode: true });
    await listen();
    assert.deepEqual(
      await (await fetch(base + "/api/spawns")).json(),
      factorySpawnRegistry,
    );
    assert.equal(await readFile(spawnPath, "utf8"), before);
    await close();
    // A service-owned future publication fixture proves restart preservation;
    // this is not a claim that G's authenticated editor already exists.
    const published: SpawnRegistry = {
      ...structuredClone(factorySpawnRegistry),
      source: "admin-publication",
      revision: 2,
      publication: {
        id: "publication-fixture",
        at: "2026-11-03T01:00:00.000Z",
        by: "পরীক্ষার প্রশাসক",
      },
      locations: [structuredClone(factorySpawnRegistry.locations[0])],
    };
    await writeFile(spawnPath, JSON.stringify(published));
    app = await createApp({ root, dataDirectory: directory, testMode: true });
    await listen();
    assert.deepEqual(
      await (await fetch(base + "/api/spawns")).json(),
      published,
    );
  } finally {
    await close();
    await removeFixture(directory);
  }
});
