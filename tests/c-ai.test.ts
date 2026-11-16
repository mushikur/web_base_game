import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MissionActorAI,
  clearAISegment,
  type AIFacts,
  type AIRole,
  type AIOptions,
} from "../apps/game/src/missionAI.ts";
import { EvacuationController } from "../apps/game/src/evacuation.ts";
import { ambulanceAnchorsAt } from "../apps/game/src/ambulanceGeometry.ts";
import { rotatedFootprintClear } from "../apps/game/src/missionClearance.ts";
import { worldAreas } from "../packages/shared/src/world-layout.ts";

const facts: AIFacts = { player: { x: 0, z: 0 }, active: true };
function actor(role: AIRole, extra: Partial<AIOptions> = {}) {
  return new MissionActorAI({
    id: `${role}-১`,
    role,
    pose: { x: 2, y: 0.12, z: 3, yaw: 0 },
    patrol: [
      { x: 2, z: 4 },
      { x: 3, z: 4 },
      { x: 3, z: 3 },
    ],
    covers: [
      { x: 4, z: 4 },
      { x: -2, z: 6 },
    ],
    escape: [
      { x: 4, z: 5 },
      { x: 4, z: 8 },
      { x: 0, z: 8 },
    ],
    scatter: { x: -5, z: 8 },
    clear: () => true,
    heightAt: () => 0.12,
    ...extra,
  });
}
function advance(ai: MissionActorAI, seconds: number, input: AIFacts = facts) {
  const samples = [];
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame++)
    samples.push(ai.tick(1 / 60, input));
  return samples;
}
test("leader actually notices, seeks cover, changes heading, flees and emits bounded harmless props", () => {
  const ai = actor("leader"),
    first = ai.tick(1 / 60, facts);
  assert.equal(first.state, "notice");
  assert.ok(
    first.actions.some((a) => a.type === "voice" && a.cue === "notice"),
  );
  const covered = advance(ai, 4);
  assert.ok(covered.some((s) => s.animation === "Walk"));
  assert.ok(ai.distanceMoved > 2);
  assert.ok(ai.pose.x > 3);
  const fleeing = advance(ai, 10, { ...facts, fleeing: true });
  assert.ok(fleeing.some((s) => s.animation === "Run"));
  assert.ok(new Set(fleeing.map((s) => s.pose.yaw.toFixed(1))).size > 5);
  const props = fleeing
    .flatMap((s) => s.actions)
    .filter((a) => a.type === "paper-prop");
  assert.ok(props.length >= 1 && props.length <= 2);
  const before = { ...ai.pose };
  advance(ai, 2, { ...facts, defeated: true, fleeing: true });
  assert.deepEqual(ai.pose, before);
  assert.equal(ai.animation, "Resting");
});
test("tutorial and pause suppress dangerous behavior before state/actions, with no stale motion burst", () => {
  const ai = actor("leader"),
    start = { ...ai.pose };
  const safe = advance(ai, 9, { ...facts, fleeing: true, tutorialSafe: true });
  assert.deepEqual(ai.pose, start);
  assert.equal(ai.state, "speech");
  assert.equal(safe.flatMap((s) => s.actions).length, 0);
  const paused = advance(ai, 4, { ...facts, fleeing: true, paused: true });
  assert.deepEqual(ai.pose, start);
  assert.equal(paused.flatMap((s) => s.actions).length, 0);
  ai.tick(1 / 60, { ...facts, fleeing: true });
  assert.ok(Math.hypot(ai.pose.x - start.x, ai.pose.z - start.z) < 0.06);
});
test("unreachable cover never slides through a wall or produces movement facts", () => {
  const ai = actor("leader", { clear: (x) => x < 2.1 }),
    start = { ...ai.pose };
  advance(ai, 4);
  assert.deepEqual(ai.pose, start);
  assert.equal(ai.distanceMoved, 0);
  assert.equal(ai.blocked, true);
  assert.equal(ai.animation, "Cover");
});
test("height clearance preserves accepted curbs, rejects the dais ledge and permits a real ramp", () => {
  const a = { x: 0, z: 0 },
    b = { x: 1, z: 0 };
  assert.equal(
    clearAISegment(
      a,
      b,
      () => true,
      (x) => (x < 0.5 ? 0 : 0.32),
    ),
    true,
  );
  assert.equal(
    clearAISegment(
      a,
      b,
      () => true,
      (x) => (x < 0.5 ? 0 : 0.46),
    ),
    false,
  );
  assert.equal(
    clearAISegment(
      a,
      b,
      () => true,
      (x) => x * 0.46,
    ),
    true,
  );
});
test("egg and sandal reactions differ and duplicate impact ids cannot restart reaction", () => {
  const ai = actor("leader");
  assert.equal(
    ai.tick(1 / 60, {
      ...facts,
      lastHit: { id: "physical-egg-1", item: "egg" },
    }).animation,
    "EggReact",
  );
  advance(ai, 1, { ...facts, lastHit: { id: "physical-egg-1", item: "egg" } });
  assert.notEqual(ai.animation, "EggReact");
  assert.equal(
    ai.tick(1 / 60, {
      ...facts,
      lastHit: { id: "physical-sandal-2", item: "sandal" },
    }).animation,
    "SandalReact",
  );
});
test("workers warn, follow, dodge incoming props and scatter after completion", () => {
  const ai = actor("worker");
  assert.equal(ai.tick(1 / 60, facts).state, "warn");
  const following = advance(ai, 3, { ...facts, leader: { x: 4, z: 6 } });
  assert.ok(following.some((s) => s.state === "follow" && s.moving));
  const before = { ...ai.pose };
  const dodged = ai.tick(1 / 60, { ...facts, incoming: { ...before } });
  assert.equal(dodged.state, "dodge");
  assert.equal(dodged.running, true);
  const scatter = advance(ai, 2, { ...facts, completed: true });
  assert.equal(ai.state, "scatter");
  assert.ok(scatter.some((s) => s.moving));
  assert.equal(
    scatter
      .flatMap((s) => s.actions)
      .filter((a) => a.type === "voice" && a.cue === "scatter").length,
    1,
  );
});
test("workers yield to a siren at one bounded safe goal and exhausted workers rest without a siren", () => {
  const ai = actor("worker"),
    start = { ...ai.pose };
  const yielding = advance(ai, 5, {
    ...facts,
    leader: { x: 8, z: 8 },
    siren: { x: 2, z: 8 },
  });
  assert.equal(ai.state, "yield");
  assert.ok(yielding.some((s) => s.moving));
  const after = { ...ai.pose };
  advance(ai, 5, { ...facts, siren: { x: 2, z: 8 } });
  assert.deepEqual(ai.pose, after);
  assert.ok(Math.hypot(after.x - start.x, after.z - start.z) <= 3.41);
  const rest = advance(ai, 2, {
    ...facts,
    defeated: true,
  });
  assert.deepEqual(ai.pose, after);
  assert.equal(ai.animation, "Resting");
  assert.equal(rest.flatMap((s) => s.actions).length, 0);
});

test("an exhausted worker remains solid but walks clear of the ambulance bay, then rests without regaining resolve", () => {
  const area = worldAreas[0],
    ai = actor("worker", {
      pose: { x: -2.6, y: 0, z: 8.2, yaw: 0 },
      // Keep the authored ambulance lane and its adjacent usable pavement.
      clear: (x, z) => x > -6 && x < 1 && z > 1 && z < 36,
      heightAt: () => 0,
    }),
    start = { ...ai.pose },
    controller = new EvacuationController({
      heightAt: () => 0,
      anchors: ambulanceAnchorsAt,
      canVehicleStand: (x, z, yaw) =>
        rotatedFootprintClear({ x, y: 0, z, yaw }, [], () => true, [ai.pose]),
      canActorStand: () => true,
    });
  assert.equal(
    controller.request(
      { missionId: area.id, ...area.ambulance },
      { x: 4.5, y: 0, z: 13, yaw: 0 },
    ),
    true,
  );
  for (let frame = 0; frame < 1200 && !controller.snapshot.blocked; frame++)
    controller.tick(1 / 60);
  assert.equal(controller.snapshot.blocked, true);
  const stopped = { ...controller.snapshot.ambulance };
  for (let frame = 0; frame < 120; frame++) controller.tick(1 / 60);
  assert.deepEqual(controller.snapshot.ambulance, stopped);
  const input: AIFacts = {
    ...facts,
    defeated: true,
    siren: controller.snapshot.ambulance,
  };
  const initialRest = advance(ai, 1, input);
  assert.deepEqual(ai.pose, start);
  assert.ok(initialRest.every((s) => !s.moving));
  const samples = [];
  for (let frame = 0; frame < 1200 && controller.state === "approach"; frame++) {
    samples.push(
      ai.tick(1 / 60, { ...input, siren: controller.snapshot.ambulance }),
    );
    controller.tick(1 / 60);
  }
  assert.equal(controller.state, "exit-medics");
  assert.ok(samples.some((s) => s.moving && s.animation === "Walk"));
  assert.ok(Math.hypot(ai.pose.x - start.x, ai.pose.z - start.z) > 2.5);
  assert.ok(Math.hypot(ai.pose.x - start.x, ai.pose.z - start.z) <= 3.41);
  assert.equal(input.defeated, true);
  const cleared = { ...ai.pose },
    resting = advance(ai, 3, { ...facts, defeated: true });
  assert.deepEqual(ai.pose, cleared);
  assert.equal(ai.state, "resting");
  assert.equal(ai.animation, "Resting");
  assert.equal(resting.flatMap((s) => s.actions).length, 0);
});

test("exhausted-worker siren recovery respects pause, tutorial and real route obstructions", () => {
  const ai = actor("worker"),
    start = { ...ai.pose },
    input = { ...facts, defeated: true, siren: { x: 2, z: 8 } };
  advance(ai, 4, { ...input, paused: true });
  assert.deepEqual(ai.pose, start);
  const tutorial = advance(ai, 4, { ...input, tutorialSafe: true });
  assert.deepEqual(ai.pose, start);
  assert.equal(tutorial.flatMap((s) => s.actions).length, 0);
  const trapped = actor("worker", {
    clear: (_x, z) => z < 2.4 || z > 2.6,
  });
  advance(trapped, 5, input);
  assert.deepEqual(trapped.pose, start);
  assert.equal(trapped.blocked, true);
  assert.equal(trapped.animation, "Resting");
  const leader = actor("leader"),
    leaderStart = { ...leader.pose };
  advance(leader, 5, input);
  assert.deepEqual(leader.pose, leaderStart);
  assert.equal(leader.animation, "Resting");
});
test("civilians yield at traffic crossings, visit shops, react to sirens and return to patrol", () => {
  const ai = actor("civilian", {
    crossings: [{ x: 2, z: 3 }],
    shop: { x: 2.5, z: 4.2 },
  });
  assert.equal(
    ai.tick(1 / 60, { ...facts, active: false, traffic: [{ x: 2, z: 4 }] })
      .state,
    "crossing",
  );
  assert.equal(ai.distanceMoved, 0);
  const normal = advance(ai, 8, { ...facts, active: false });
  assert.ok(normal.some((s) => s.state === "shopping"));
  const start = { ...ai.pose },
    siren = advance(ai, 4, { ...facts, active: false, siren: { ...start } });
  assert.ok(siren.some((s) => s.state === "yield" && s.moving));
  assert.equal(ai.state, "phone");
  const resumed = advance(ai, 10, { ...facts, active: false, completed: true });
  assert.ok(resumed.some((s) => s.state === "return"));
  assert.ok(resumed.some((s) => s.state === "patrol" && s.moving));
});
