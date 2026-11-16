import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chooseSafeSpawn,
  factorySpawnRegistry,
  parseSpawnRegistry,
  safeSpawnPoint,
  type SpawnEnvironment,
  type SpawnRegistry,
} from "../packages/shared/src/spawns.ts";
import { streetPuddles } from "../packages/shared/src/street-surfaces.ts";
const empty: SpawnEnvironment = {
  bounds: { minX: -21.4, maxX: 21.4, minZ: -18.8, maxZ: 22.5 },
  obstacles: [],
  water: [],
  occupants: [],
};
test("footprint clearance rejects navigation edges, obstruction corners, water overlap and invalid geometry", () => {
  assert.ok(safeSpawnPoint({ x: 0, z: 0 }, empty));
  assert.equal(safeSpawnPoint({ x: 21.1, z: 0 }, empty), false);
  assert.equal(safeSpawnPoint({ x: 0, z: -18.5 }, empty), false);
  assert.equal(
    safeSpawnPoint({ x: 0, z: 0 }, { ...empty, canNavigate: () => false }),
    false,
  );
  const solid = { ...empty, obstacles: [{ x: 0, z: 0, w: 2, d: 2 }] };
  assert.equal(safeSpawnPoint({ x: 1.2, z: 1.2 }, solid), false);
  assert.ok(safeSpawnPoint({ x: 1.4, z: 1.4 }, solid));
  const wet = { ...empty, water: [{ x: 0, z: 0, rx: 1, rz: 1 }] };
  assert.equal(
    safeSpawnPoint({ x: 1.2, z: 0 }, wet),
    false,
    "dry centre still overlaps water",
  );
  const diagonal = 1 / Math.sqrt(2) + 0.28;
  assert.equal(
    safeSpawnPoint({ x: diagonal, z: diagonal }, wet),
    false,
    "diagonal circle/ellipse clearance is checked",
  );
  assert.ok(safeSpawnPoint({ x: 1.5, z: 0 }, wet));
  for (const environment of [
    { ...empty, water: [{ x: 0, z: 0, rx: 0, rz: 1 }] },
    { ...empty, obstacles: [{ x: NaN, z: 0, w: 1, d: 1 }] },
    { ...empty, occupants: [{ x: 10, z: 0, radius: Infinity }] },
  ])
    assert.equal(safeSpawnPoint({ x: 0, z: 0 }, environment), false);
});
test("all current and future occupancy categories exclude the full player footprint", () => {
  for (const kind of [
    "npc",
    "crowd",
    "traffic",
    "player",
    "vehicle",
  ] as const) {
    const environment = {
      ...empty,
      occupants: [{ x: 0, z: 0, radius: 0.6, kind }],
    };
    assert.equal(safeSpawnPoint({ x: 1, z: 0 }, environment), false, kind);
    assert.ok(safeSpawnPoint({ x: 1.1, z: 0 }, environment), kind);
  }
});
test("trusted factory publication rejects client approval, unknown points, y and mismatched world", () => {
  assert.deepEqual(
    parseSpawnRegistry(factorySpawnRegistry),
    factorySpawnRegistry,
  );
  for (const modify of [
    (r: SpawnRegistry) => {
      r.locations[0].x = 0;
    },
    (r: SpawnRegistry) => {
      r.locations.push({
        id: "unknown-point",
        name: "অজানা স্থান",
        x: 0,
        z: 0,
        facing: 0,
        enabled: true,
      });
    },
    (r: SpawnRegistry) => {
      Object.assign(r.locations[0], { approved: true });
    },
    (r: SpawnRegistry) => {
      Object.assign(r.locations[0], { y: 10 });
    },
    (r: SpawnRegistry) => {
      Object.assign(r, { worldVersion: "unknown" });
    },
    (r: SpawnRegistry) => {
      Object.assign(r, { source: "draft" });
    },
    (r: SpawnRegistry) => {
      r.publication.id = "browser-flag";
    },
  ]) {
    const candidate = structuredClone(factorySpawnRegistry);
    modify(candidate);
    assert.throws(() => parseSpawnRegistry(candidate), /নির্ধারিত/u);
  }
});
test("finite injectable shuffle chooses only safe trusted points and reports all occupied", () => {
  const occupied = {
    ...empty,
    occupants: factorySpawnRegistry.locations.map((p) => ({
      x: p.x,
      z: p.z,
      radius: 1,
      kind: "npc" as const,
    })),
  };
  let calls = 0;
  assert.equal(
    chooseSafeSpawn(factorySpawnRegistry, occupied, () => {
      calls++;
      return 0.5;
    }),
    null,
  );
  assert.equal(calls, factorySpawnRegistry.locations.length - 1);
  const oneFree = { ...occupied, occupants: occupied.occupants.slice(1) };
  assert.equal(
    chooseSafeSpawn(factorySpawnRegistry, oneFree, () => 0.25)?.id,
    factorySpawnRegistry.locations[0].id,
  );
  const seen = new Set<string>();
  for (const sample of [0, 0.2, 0.4, 0.6, 0.8, 0.999])
    seen.add(chooseSafeSpawn(factorySpawnRegistry, empty, () => sample)!.id);
  assert.ok(seen.size > 1, "independent fresh starts are randomized");
  for (const sample of [NaN, Infinity, -0.1, 1])
    assert.throws(() =>
      chooseSafeSpawn(factorySpawnRegistry, empty, () => sample),
    );
});
test("all curated starts clear authored southern street buildings, parked vehicles, poles and enlarged puddles", () => {
  const environment: SpawnEnvironment = {
    ...empty,
    obstacles: [
      { x: -12, z: 2, w: 8, d: 48 },
      { x: 12, z: 2, w: 8, d: 48 },
      { x: -6.7, z: 0.2, w: 1.25, d: 6 },
      { x: -4.1, z: -3.7, w: 1.6, d: 2.8 },
      { x: 4, z: 2, w: 1.6, d: 2.9 },
      { x: 3.1, z: 21.5, w: 2.6, d: 8.3 },
      { x: -7.2, z: -13.5, w: 0.45, d: 0.45 },
      ...[-1, 1].map((s) => ({ x: s * 5.8, z: -14, w: 0.22, d: 0.22 })),
    ],
    water: streetPuddles.map(([x, z, rx, rz]) => ({ x, z, rx: rx * 1.25, rz })),
  };
  for (const point of factorySpawnRegistry.locations)
    assert.ok(safeSpawnPoint(point, environment), point.id);
});
