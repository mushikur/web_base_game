import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EvacuationController,
  type EvacuationDefinition,
  type EvacuationSnapshot,
} from "../apps/game/src/evacuation.ts";
import type { AIPose } from "../apps/game/src/missionAI.ts";
const pose = (x: number, z: number, y = 0.12, yaw = 0): AIPose => ({
  x,
  y,
  z,
  yaw,
});
const definition: EvacuationDefinition = {
  missionId: "promise-junction",
  approach: [
    { x: 0, z: -12 },
    { x: 0, z: -5 },
    { x: 0, z: 0 },
  ],
  bay: { x: 0, z: 0 },
  exitRoute: [
    { x: 0, z: 0 },
    { x: 0, z: -5 },
    { x: 0, z: -12 },
  ],
  exit: { x: 0, z: -12 },
};
function fixture() {
  let vehicleBlocked = false,
    doorBlocked = false,
    completed = 0;
  const stages: string[] = [];
  const controller = new EvacuationController({
    canVehicleStand: (_x, z) => !vehicleBlocked || z < -5,
    canActorStand: (x, z, who) =>
      !doorBlocked ||
      who !== "leader" ||
      !(Math.abs(x) < 0.5 && z < -2 && z > -3.1),
    heightAt: () => 0.12,
    anchors: (p) => ({
      rear: pose(p.x, p.z - 2.9, p.y + 0.12),
      rest: pose(p.x, p.z - 0.77, p.y + 0.52, Math.PI),
      seats: [
        pose(p.x - 0.48, p.z + 0.74, p.y + 0.42),
        pose(p.x + 0.48, p.z + 0.74, p.y + 0.42),
      ],
      exits: [
        pose(p.x - 1.55, p.z + 0.76, p.y + 0.12),
        pose(p.x + 1.55, p.z + 0.76, p.y + 0.12),
      ],
    }),
    onStage: (stage) => stages.push(stage),
    onCompleted: () => completed++,
  });
  return {
    controller,
    stages,
    completed: () => completed,
    blockVehicle: (b: boolean) => {
      vehicleBlocked = b;
    },
    blockDoor: (b: boolean) => {
      doorBlocked = b;
    },
  };
}
function advance(
  f: ReturnType<typeof fixture>,
  until: (s: EvacuationSnapshot) => boolean,
  limit = 24000,
) {
  const samples: EvacuationSnapshot[] = [];
  for (let frame = 0; frame < limit; frame++) {
    const s = f.controller.tick(1 / 60);
    samples.push(s);
    if (until(s)) return samples;
  }
  assert.fail(
    `stage failed to progress: ${f.controller.state} ${JSON.stringify(f.controller.snapshot)}`,
  );
}
test("ambulance completes exactly once only after actual assistance, loading, door closure and observed exit", () => {
  const f = fixture();
  assert.equal(f.controller.request(definition, pose(3, 3)), true);
  assert.equal(f.controller.request(definition, pose(3, 3)), false);
  const samples = advance(f, (s) => s.stage === "completed");
  assert.deepEqual(f.stages, [
    "approach",
    "exit-medics",
    "assist",
    "load",
    "return-medics",
    "close-doors",
    "depart",
    "completed",
  ]);
  assert.ok(samples.some((s) => s.medicAnimations.includes("Walk")));
  assert.ok(
    samples.some((s) => s.medicAnimations.every((a) => a === "Assist")),
  );
  assert.ok(samples.some((s) => s.leaderAnimation === "AssistedWalk"));
  assert.ok(samples.some((s) => s.leaderAnimation === "Loading"));
  const end = f.controller.snapshot;
  assert.ok(
    Math.hypot(
      end.ambulance.x - definition.exit.x,
      end.ambulance.z - definition.exit.z,
    ) < 0.05,
  );
  assert.equal(end.leaderAttached, true);
  assert.equal(end.doorOpen, 0);
  assert.deepEqual(end.medicsAttached, [true, true]);
  assert.ok(end.vehicleTravel > 23);
  assert.equal(f.completed(), 1);
  for (let frame = 0; frame < 600; frame++) f.controller.tick(1 / 60);
  assert.equal(f.completed(), 1);
  assert.equal(f.controller.request(definition, pose(3, 3)), false);
  for (let frame = 1; frame < samples.length; frame++) {
    for (const key of ["ambulance", "leader"] as const)
      assert.ok(
        Math.hypot(
          samples[frame][key].x - samples[frame - 1][key].x,
          samples[frame][key].z - samples[frame - 1][key].z,
        ) < 0.2,
        `${key} never teleports`,
      );
  }
});
test("blocked vehicle route waits indefinitely and resumes only when actually clear", () => {
  const f = fixture();
  f.controller.request(definition, pose(3, 3));
  f.blockVehicle(true);
  advance(f, (s) => s.blocked);
  const blocked = f.controller.snapshot;
  for (let frame = 0; frame < 1200; frame++) f.controller.tick(1 / 60);
  assert.equal(f.controller.state, "approach");
  assert.deepEqual(f.controller.snapshot.ambulance, blocked.ambulance);
  assert.equal(f.completed(), 0);
  f.blockVehicle(false);
  advance(f, (s) => s.stage === "completed");
  assert.equal(f.completed(), 1);
});
test("blocked rear door cannot complete loading, and pause freezes every actor and stage clock", () => {
  const f = fixture();
  f.controller.request(definition, pose(3, 3));
  f.blockDoor(true);
  advance(f, (s) => s.stage === "load" && s.blocked);
  const blocked = f.controller.snapshot;
  for (let frame = 0; frame < 1200; frame++) f.controller.tick(1 / 60);
  assert.equal(f.controller.state, "load");
  assert.equal(f.controller.snapshot.leaderAttached, false);
  assert.equal(f.completed(), 0);
  const beforePause = f.controller.snapshot;
  for (let frame = 0; frame < 600; frame++) f.controller.tick(1 / 60, true);
  assert.deepEqual(f.controller.snapshot, beforePause);
  assert.ok(blocked.message.includes("বাধা"));
  f.blockDoor(false);
  advance(f, (s) => s.stage === "completed");
  assert.equal(f.completed(), 1);
});
test("cancel/retry resets only the intended request token, while invalid routes cannot start", () => {
  const f = fixture();
  assert.equal(
    f.controller.request({ ...definition, approach: [] }, pose(3, 3)),
    false,
  );
  assert.equal(f.controller.request(definition, pose(3, 3)), true);
  assert.equal(f.controller.resetRequest(definition.missionId), false);
  assert.equal(f.controller.cancel("other-mission"), false);
  assert.equal(f.controller.cancel(definition.missionId), true);
  assert.equal(f.controller.resetRequest(definition.missionId), true);
  assert.equal(f.controller.request(definition, pose(3, 3)), true);
});
