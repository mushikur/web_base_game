import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SectorCache,
  distanceToSector,
  type SectorRegion,
} from "../apps/game/src/sectorPolicy.ts";
import { SectorResources } from "../apps/game/src/sectorResources.ts";
import { acquireSectorResources } from "../apps/game/src/sectorSceneResources.ts";

const regions: SectorRegion[] = Array.from({ length: 5 }, (_, i) => ({
  id: `area-${i}`,
  minX: i * 100 - 10,
  maxX: i * 100 + 10,
  minZ: -10,
  maxZ: 10,
  encounter: true,
}));
function fixture() {
  const facts = new Map<
    string,
    { visible: boolean; active: boolean; disposed: number }
  >();
  const cache = new SectorCache(regions, (id) => {
    const fact = { visible: false, active: false, disposed: 0 };
    facts.set(id, fact);
    return {
      setVisible: (visible: boolean) => (fact.visible = visible),
      setActive: (active: boolean) => (fact.active = active),
      dispose: () => fact.disposed++,
    };
  });
  return { cache, facts };
}

test("streaming constructs no city at startup and measures nearest region edge", () => {
  const { cache, facts } = fixture();
  assert.equal(cache.resources.size, 0);
  assert.equal(distanceToSector({ x: 15, z: 14 }, regions[0]), Math.sqrt(41));
  const changes = cache.update({ x: 0, z: 0 });
  assert.deepEqual(changes.loaded, ["area-0"]);
  assert.equal(facts.get("area-0")!.active, true);
  assert.equal(facts.has("area-4"), false);
});

test("activation and geometry use hysteresis without repeatedly reconstructing", () => {
  const { cache } = fixture();
  cache.update({ x: 0, z: 0 });
  cache.update({ x: 47, z: 0 });
  assert.equal(cache.status.find((s) => s.id === "area-0")!.state, "active");
  cache.update({ x: 52, z: 0 });
  assert.equal(cache.status.find((s) => s.id === "area-0")!.state, "visible");
  cache.update({ x: 80, z: 0 });
  assert.equal(cache.status.find((s) => s.id === "area-0")!.state, "visible");
  cache.update({ x: 90, z: 0 });
  assert.equal(cache.status.find((s) => s.id === "area-0")!.state, "sleeping");
  cache.update({ x: 80, z: 0 });
  assert.equal(cache.status.find((s) => s.id === "area-0")!.state, "sleeping");
  cache.update({ x: 70, z: 0 });
  assert.equal(cache.status.find((s) => s.id === "area-0")!.generation, 1);
  assert.equal(cache.status.find((s) => s.id === "area-0")!.state, "visible");
});

test("pinned ambulance routes survive distance while distant encounter AI sleeps", () => {
  const { cache, facts } = fixture();
  cache.update({ x: 0, z: 0 }, ["area-4"]);
  assert.equal(facts.get("area-4")!.visible, true);
  assert.equal(facts.get("area-4")!.active, false);
  cache.update({ x: -300, z: 0 }, ["area-4"]);
  assert.equal(cache.resources.has("area-4"), true);
  assert.equal(facts.get("area-4")!.disposed, 0);
  const changes = cache.update({ x: -300, z: 0 });
  assert.ok(changes.released.includes("area-4"));
  assert.equal(facts.get("area-4")!.disposed, 1);
});

test("cold release is exactly once and reload is a new generation without domain mutation", () => {
  const { cache, facts } = fixture();
  const mission = { completed: true, reward: 13 };
  cache.update({ x: 0, z: 0 });
  const original = facts.get("area-0")!;
  cache.update({ x: 300, z: 0 });
  cache.update({ x: 300, z: 0 });
  assert.equal(original.disposed, 1);
  cache.update({ x: 0, z: 0 });
  assert.equal(cache.status.find((s) => s.id === "area-0")!.generation, 2);
  assert.deepEqual(mission, { completed: true, reward: 13 });
  const reloaded = facts.get("area-0")!;
  cache.dispose();
  cache.dispose();
  assert.equal(reloaded.disposed, 1);
  assert.equal(cache.resources.size, 0);
  assert.throws(() => cache.update({ x: 0, z: 0 }), /বন্ধ সেক্টর/);
});

test("at most two overlapping encounters run and invalid configuration is rejected", () => {
  const overlap = regions.map((r) => ({ ...r, minX: -10, maxX: 10 }));
  const cache = new SectorCache(overlap, () => ({
    setActive() {},
    setVisible() {},
    dispose() {},
  }));
  cache.update({ x: 0, z: 0 }, ["area-4"]);
  assert.equal(cache.status.filter((s) => s.state === "active").length, 2);
  assert.equal(cache.status.find((s) => s.id === "area-4")!.state, "active");
  assert.throws(() => cache.update({ x: NaN, z: 0 }), /অবস্থান/);
  assert.throws(
    () =>
      new SectorCache([regions[0], regions[0]], () => ({
        setActive() {},
        setVisible() {},
        dispose() {},
      })),
    /সীমা/,
  );
});

test("sector resources preserve shared vehicle materials and never adopt foreign hub resources", () => {
  const resources = new SectorResources<string>();
  const disposed: string[] = [];
  resources.register("cloth", () => disposed.push("cloth"));
  resources.register("sign", () => disposed.push("sign"));
  resources.register("palette", () => disposed.push("palette"), true);
  resources.retain("committee", ["cloth", "sign", "palette", "hub-original"]);
  resources.retain("office", ["cloth", "palette"]);
  resources.release("committee");
  assert.deepEqual(disposed, ["sign"]);
  assert.equal(resources.size, 2);
  resources.release("committee");
  resources.release("office");
  assert.deepEqual(disposed, ["sign", "cloth"]);
  assert.equal(resources.size, 1);
  resources.dispose();
  resources.dispose();
  assert.deepEqual(disposed, ["sign", "cloth", "palette"]);
});

test("warm cache has a hard bound and resources dispose before their owner is forgotten", () => {
  const closelySpaced = regions.map((r, i) => ({
    ...r,
    minX: i * 15,
    maxX: i * 15 + 5,
  }));
  const released: string[] = [];
  const cache = new SectorCache(
    closelySpaced,
    (id) => ({
      setActive() {},
      setVisible() {},
      dispose: () => released.push(id),
    }),
    {
      prefetch: 65,
      visibleUntil: 78,
      active: 34,
      activeUntil: 40,
      release: 200,
      warmLimit: 2,
      activeLimit: 2,
    },
  );
  cache.update({ x: 30, z: 0 });
  assert.equal(cache.resources.size, 5);
  cache.update({ x: 155, z: 0 });
  assert.equal(cache.status.filter((s) => s.state === "sleeping").length, 2);
  assert.equal(released.length, 3);
  cache.dispose();
  assert.equal(new Set(released).size, 5);
  assert.equal(released.length, 5);
});

test("environment and traffic share a scene lease without destroying each other's live palette", () => {
  const scene = {} as Parameters<typeof acquireSectorResources>[0];
  const environment = acquireSectorResources(scene),
    traffic = acquireSectorResources(scene);
  assert.equal(environment.pool, traffic.pool);
  let disposed = 0;
  const palette = {} as never;
  environment.pool.register(palette, () => disposed++, true);
  environment.release();
  environment.release();
  assert.equal(disposed, 0);
  traffic.release();
  traffic.release();
  assert.equal(disposed, 1);
  const next = acquireSectorResources(scene);
  assert.notEqual(next.pool, traffic.pool);
  next.release();
});
