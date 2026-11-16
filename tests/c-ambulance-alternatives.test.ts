import assert from "node:assert/strict";
import { test } from "node:test";
import {
  worldAreas,
  worldHeightAt,
  type Point2,
  type WorldArea,
} from "../packages/shared/src/world-layout.ts";
import {
  pathfindWorld,
  worldCanWalk,
  type NavigationObstacle,
} from "../packages/shared/src/navigation.ts";
import { allSectorObstacles } from "../apps/game/src/sectorBlueprints.ts";
import { EvacuationController } from "../apps/game/src/evacuation.ts";
import { ambulanceAnchorsAt } from "../apps/game/src/ambulanceGeometry.ts";
import {
  ambulanceNavigationObstacles,
  rotatedFootprintClear,
  rotatedVehicleContains,
} from "../apps/game/src/missionClearance.ts";
import type { AIPose } from "../apps/game/src/missionAI.ts";

// Protected hub physical footprints, including the real dais, parked vehicles,
// median, counter and poles. C walking may use the dais; a microbus may not.
const obstacles: NavigationObstacle[] = [
  { x: -12, z: 2, w: 8, d: 48 },
  { x: 12, z: 2, w: 8, d: 48 },
  { x: -6.7, z: 0.2, w: 1.25, d: 6 },
  { x: 1.8, z: 10.6, w: 4, d: 3 },
  { x: -4.1, z: -3.7, w: 1.6, d: 2.8 },
  { x: 4, z: 2, w: 1.6, d: 2.9 },
  { x: 3.1, z: 21.5, w: 2.6, d: 8.3 },
  { x: -0.2, z: 18.5, w: 0.7, d: 10 },
  { x: -7.2, z: -13.5, w: 0.45, d: 0.45 },
  { x: 7.2, z: 11.7, w: 0.45, d: 0.45 },
  ...allSectorObstacles,
];
const pose = (p: Point2, yaw = 0): AIPose => ({
  x: p.x,
  z: p.z,
  y: worldHeightAt(p.x, p.z),
  yaw,
});
const safe = (p: AIPose, people: Point2[]) =>
  rotatedFootprintClear(
    p,
    obstacles,
    (x, z) => worldCanWalk(x, z, [], 0.02),
    people,
  );
function controllerFor(area: WorldArea, people: () => Point2[]) {
  const controller: EvacuationController = new EvacuationController({
    heightAt: worldHeightAt,
    anchors: ambulanceAnchorsAt,
    canVehicleStand: (x, z, yaw) => safe(pose({ x, z }, yaw), people()),
    canActorStand: (x, z, _who, interior) =>
      worldCanWalk(x, z, obstacles, 0.32) &&
      (interior ||
        !rotatedVehicleContains({ x, z }, controller.snapshot.ambulance, 0.32)),
    pathTo: (from, to, _who, interior) => {
      const result = pathfindWorld(from, to, [
        ...obstacles,
        ...(!interior
          ? ambulanceNavigationObstacles(controller.snapshot.ambulance)
          : []),
      ]);
      return result.ok ? result.points : undefined;
    },
  });
  assert.equal(
    controller.request(
      { missionId: area.id, ...area.ambulance },
      pose(area.leader),
    ),
    true,
  );
  return controller;
}
function advanceChecked(
  controller: EvacuationController,
  people: () => Point2[],
  dt = 1 / 60,
) {
  const before = controller.snapshot,
    after = controller.tick(dt);
  assert.ok(
    safe(after.ambulance, people()),
    `${after.missionId}: actual rotated body intersected a wall, unbuilt ground or person`,
  );
  const distance = Math.hypot(
    after.ambulance.x - before.ambulance.x,
    after.ambulance.z - before.ambulance.z,
  );
  assert.ok(
    distance <= 5.5 * dt + 1e-7,
    "alternate movement must remain continuous",
  );
  const angle = Math.abs(
    Math.atan2(
      Math.sin(after.ambulance.yaw - before.ambulance.yaw),
      Math.cos(after.ambulance.yaw - before.ambulance.yaw),
    ),
  );
  assert.ok(
    angle <= 3 * dt + 1e-7,
    "alternate turns must retain their bounded angular speed",
  );
  assert.ok(
    Math.abs(Math.abs(after.wheelTravel - before.wheelTravel) - distance) <
      1e-7,
    "signed wheels must match actual travelled distance",
  );
  const deltaYaw = Math.atan2(
    Math.sin(after.ambulance.yaw - before.ambulance.yaw),
    Math.cos(after.ambulance.yaw - before.ambulance.yaw),
  );
  const samples = Math.max(
    1,
    Math.ceil(distance / 0.025),
    Math.ceil(angle / 0.01),
  );
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    assert.ok(
      safe(
        {
          x: before.ambulance.x + (after.ambulance.x - before.ambulance.x) * t,
          z: before.ambulance.z + (after.ambulance.z - before.ambulance.z) * t,
          y: before.ambulance.y + (after.ambulance.y - before.ambulance.y) * t,
          yaw: before.ambulance.yaw + deltaYaw * t,
        },
        people(),
      ),
      "the full body must remain clear between frame samples while it steers",
    );
  }
  return { before, after, distance };
}

test("all four outer approaches back away and bypass a live obstruction into the original aligned bay", () => {
  for (const area of worldAreas.slice(1)) {
    const blocker = { x: area.center.x - 4.5, z: area.center.z - 8 },
      people = () => [blocker];
    assert.ok(area.ambulance.alternateApproaches?.length);
    assert.ok(area.ambulance.alternateExits?.length);
    for (const route of area.ambulance.alternateApproaches!)
      assert.deepEqual(route.at(-1), area.ambulance.bay);
    const controller = controllerFor(area, people);
    let waited = 0,
      reversed = false,
      lateral = 0;
    for (
      let frame = 0;
      frame < 4000 && controller.state === "approach";
      frame++
    ) {
      const { before, after } = advanceChecked(controller, people, 1 / 20);
      if (after.blocked) waited += 1 / 20;
      reversed ||= after.wheelTravel < before.wheelTravel;
      lateral = Math.max(
        lateral,
        Math.abs(after.ambulance.x - area.ambulance.bay.x),
      );
    }
    assert.equal(
      controller.state,
      "exit-medics",
      `${area.id}: alternate approach failed`,
    );
    assert.ok(
      waited >= 2.5,
      "a real blockage must precede selecting a fallback",
    );
    assert.ok(
      reversed,
      "a staged backoff must reverse its wheels, not spin or teleport",
    );
    assert.ok(lateral > 2, "the actual vehicle must use the alternate lane");
    assert.ok(
      Math.hypot(
        controller.snapshot.ambulance.x - area.ambulance.bay.x,
        controller.snapshot.ambulance.z - area.ambulance.bay.z,
      ) < 0.05,
    );
    assert.ok(
      Math.abs(
        Math.atan2(
          Math.sin(controller.snapshot.ambulance.yaw),
          Math.cos(controller.snapshot.ambulance.yaw),
        ),
      ) < 0.05,
    );
  }
});

test("all four outer departures keep a standing road blocker intact and reach the same observed exit", () => {
  for (const area of worldAreas.slice(1)) {
    const blocker = { x: area.center.x - 4.5, z: area.center.z - 8 };
    let obstructed = false;
    const people = () => (obstructed ? [blocker] : []),
      controller = controllerFor(area, people);
    let waited = 0,
      lateral = 0;
    for (
      let frame = 0;
      frame < 18000 && controller.state !== "completed";
      frame++
    ) {
      if (controller.state === "depart") obstructed = true;
      const { after } = advanceChecked(controller, people, 1 / 30);
      if (obstructed) {
        if (after.blocked) waited += 1 / 30;
        lateral = Math.max(
          lateral,
          Math.abs(after.ambulance.x - area.ambulance.exit.x),
        );
      }
    }
    assert.equal(
      controller.state,
      "completed",
      `${area.id}: alternate departure failed`,
    );
    assert.ok(waited >= 2.5 && lateral > 2.5);
    assert.ok(
      controller.snapshot.leaderAttached &&
        controller.snapshot.medicsAttached.every(Boolean),
    );
    assert.equal(controller.snapshot.doorOpen, 0);
    assert.ok(
      Math.hypot(
        controller.snapshot.ambulance.x - area.ambulance.exit.x,
        controller.snapshot.ambulance.z - area.ambulance.exit.z,
      ) < 0.05,
    );
  }
});

test("the hub northern junction has a checked early-obstruction approach without crossing the median or bus", () => {
  for (const z of [30, 31]) {
    const area = worldAreas[0],
      people = () => [{ x: -2.6, z }],
      controller = controllerFor(area, people);
    let waited = 0,
      reversed = false,
      maxX = -Infinity;
    for (
      let frame = 0;
      frame < 5000 && controller.state === "approach";
      frame++
    ) {
      const { before, after } = advanceChecked(controller, people);
      if (after.blocked) waited += 1 / 60;
      reversed ||= after.wheelTravel < before.wheelTravel;
      maxX = Math.max(maxX, after.ambulance.x);
    }
    assert.equal(controller.state, "exit-medics");
    assert.ok(waited >= 2.5 && reversed && maxX > -0.1);
    assert.ok(
      Math.hypot(
        controller.snapshot.ambulance.x + 2.6,
        controller.snapshot.ambulance.z - 8,
      ) < 0.05,
    );
  }
});

test("the hub departure uses the actual junction around a person and observes the original exit", () => {
  const area = worldAreas[0];
  let obstructed = false;
  const people = () => (obstructed ? [{ x: -2.6, z: 31 }] : []),
    controller = controllerFor(area, people);
  let waited = 0,
    maxX = -Infinity;
  for (
    let frame = 0;
    frame < 18000 && controller.state !== "completed";
    frame++
  ) {
    if (controller.state === "depart") obstructed = true;
    const { after } = advanceChecked(controller, people);
    if (obstructed) {
      if (after.blocked) waited += 1 / 60;
      maxX = Math.max(maxX, after.ambulance.x);
    }
  }
  assert.equal(controller.state, "completed");
  assert.ok(waited >= 2.5 && maxX > -0.1);
  assert.ok(
    controller.snapshot.leaderAttached &&
      controller.snapshot.medicsAttached.every(Boolean),
  );
  assert.equal(controller.snapshot.doorOpen, 0);
  assert.ok(
    Math.hypot(
      controller.snapshot.ambulance.x + 2.6,
      controller.snapshot.ambulance.z - 34,
    ) < 0.05,
  );
});

test("a solid hub median-lane obstruction waits honestly and resumes only after it is removed", () => {
  const area = worldAreas[0];
  let blocked = true;
  const people = () => (blocked ? [{ x: -2.6, z: 20 }] : []),
    controller = controllerFor(area, people);
  for (let frame = 0; frame < 1200; frame++) advanceChecked(controller, people);
  assert.equal(controller.state, "approach");
  assert.equal(controller.snapshot.completed, false);
  assert.equal(controller.snapshot.blocked, true);
  const waiting = controller.snapshot.ambulance;
  for (let frame = 0; frame < 60; frame++) advanceChecked(controller, people);
  assert.deepEqual(
    controller.snapshot.ambulance,
    waiting,
    "no unvalidated teleport can escape a narrow occupied lane",
  );
  blocked = false;
  for (let frame = 0; frame < 4000 && controller.state === "approach"; frame++)
    advanceChecked(controller, people);
  assert.equal(controller.state, "exit-medics");
});
