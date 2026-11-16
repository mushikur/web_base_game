import { test } from "node:test";
import assert from "node:assert/strict";
import {
  civilianPatrol,
  civilianPatrolBounds,
  initialOccupantClearance,
  maximumSimulationStep,
} from "../apps/game/src/patrol.ts";
import {
  chooseSafeSpawn,
  factorySpawnRegistry,
  safeSpawnPoint,
  type SpawnEnvironment,
} from "../packages/shared/src/spawns.ts";

const playerRadius = 0.42,
  npcRadius = 0.58;
// These are the actual walking civilians beside the current factory spawn area.
const civilians = [
  { x: -6.1, baseZ: -7, phase: 0 },
  { x: 6.3, baseZ: 5.8, phase: 1 },
  { x: -6.1, baseZ: 8, phase: 2 },
  { x: 6.4, baseZ: -10, phase: 3 },
];
function environment(time: number, phaseShift = 0): SpawnEnvironment {
  return {
    bounds: { minX: -21.4, maxX: 21.4, minZ: -18.8, maxZ: 22.5 },
    obstacles: civilians.map((npc) => civilianPatrolBounds(npc.x, npc.baseZ)),
    water: [],
    occupants: civilians.map((npc) => ({
      x: npc.x,
      z: civilianPatrol(npc.baseZ, time, npc.phase + phaseShift).z,
      radius: npcRadius + initialOccupantClearance,
      kind: "npc",
    })),
  };
}

test("factory spawn validation rejects a civilian's phase-resolved location instead of its temporary reset base", () => {
  const spawn = factorySpawnRegistry.locations.find(
    (location) => location.id === "east-middle",
  )!;
  const baseEnvironment: SpawnEnvironment = {
    ...environment(0),
    obstacles: [],
    occupants: [{ x: 6.4, z: -10, radius: npcRadius, kind: "npc" }],
  };
  assert.ok(
    safeSpawnPoint(spawn, baseEnvironment),
    "the old base-only check incorrectly allowed this point",
  );
  const actual = civilianPatrol(-10, 0, -Math.PI / 2);
  assert.ok(
    !safeSpawnPoint(spawn, {
      ...baseEnvironment,
      occupants: [
        {
          x: 6.4,
          z: actual.z,
          radius: npcRadius + initialOccupantClearance,
          kind: "npc",
        },
      ],
    }),
    "actual reset/render position overlaps the formerly allowed spawn",
  );
});

test("random factory starts retain full NPC clearance through the first capped frame across patrol phases", () => {
  let unsafeCandidatesRejected = 0;
  for (let sample = 0; sample < 480; sample++) {
    // Large/nonzero clocks represent repeated starts and returning from pause.
    const time = sample * 13.71,
      phaseShift = sample * 0.173,
      current = environment(time, phaseShift);
    unsafeCandidatesRejected += factorySpawnRegistry.locations.filter(
      (location) => !safeSpawnPoint(location, current),
    ).length;
    let rngState = sample + 1;
    const chosen = chooseSafeSpawn(factorySpawnRegistry, current, () => {
      rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
      return rngState / 2 ** 32;
    });
    assert.ok(chosen, "unoccupied south factory points remain available");
    for (let frameSample = 0; frameSample <= 20; frameSample++) {
      const frameTime = time + (maximumSimulationStep * frameSample) / 20;
      for (const npc of civilians) {
        const actual = civilianPatrol(
          npc.baseZ,
          frameTime,
          npc.phase + phaseShift,
        );
        assert.ok(
          Math.hypot(chosen.x - npc.x, chosen.z - actual.z) >
            playerRadius + npcRadius + 0.049,
          "the first actual frame must not move a civilian into the spawned player",
        );
      }
    }
  }
  assert.ok(unsafeCandidatesRejected > 100);
});

test("a stationary new-game spawn stays outside every civilian throughout the complete authored patrol cycle", () => {
  const eligible = factorySpawnRegistry.locations.filter((location) =>
    safeSpawnPoint(location, environment(0)),
  );
  assert.deepEqual(
    eligible.map((location) => location.id),
    ["west-south", "east-south", "west-middle"],
    "six registered starts currently contain three patrol-safe eligible points",
  );
  for (const initialTime of [0, 57.13, 1000.93]) {
    for (const phaseShift of [0, 0.7, 5.1]) {
      const current = environment(initialTime, phaseShift);
      assert.deepEqual(
        factorySpawnRegistry.locations
          .filter((location) => safeSpawnPoint(location, current))
          .map((location) => location.id),
        eligible.map((location) => location.id),
      );
      for (const spawn of eligible) {
        // 0.32 rad/s is the actual existing patrol rate. Check one entire
        // 19.635-second cycle rather than only the first rendered frame.
        for (let sample = 0; sample <= 720; sample++) {
          const time = initialTime + (sample / 720) * ((Math.PI * 2) / 0.32);
          for (const npc of civilians) {
            const actual = civilianPatrol(
              npc.baseZ,
              time,
              npc.phase + phaseShift,
            );
            assert.ok(
              Math.hypot(spawn.x - npc.x, spawn.z - actual.z) >
                playerRadius + npcRadius,
              "a player who stays at the new-game location must never intersect a patrol",
            );
          }
        }
      }
    }
  }
});
