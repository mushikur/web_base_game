import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkpoints,
  driveStep,
  onDriveRoad,
  rideGroundAnchor,
  rideProfiles,
} from "../apps/game/src/driving.ts";
import { allSectorObstacles } from "../apps/game/src/sectorBlueprints.ts";
import { worldCanWalk } from "../packages/shared/src/navigation.ts";
import { outerFootpaths, pointInRect, worldAreas, worldHeightAt, worldSurfaceAt } from "../packages/shared/src/world-layout.ts";

const pose = { x: -2.7, y: 0, z: 0, yaw: 0 };
const size = { w: 1.6, d: 2.9 };
const input = { throttle: 1, steering: 0, brake: false, wet: false };
const dt = 1 / 60;

test("phase 03 connector intersections have a level driving surface and separate raised sidewalk", () => {
  const area = worldAreas.find((area) => area.id === "committee-lane")!;
  const crossing = { x: -38.5, z: 36.23 };
  const pavement = { x: -38.5, z: 48 };
  const walks = outerFootpaths(area, 1);
  assert.equal(walks.some((walk) => pointInRect(crossing, walk)), false);
  assert.equal(worldHeightAt(crossing.x, crossing.z), 0);
  assert.equal(worldSurfaceAt(crossing.x, crossing.z), "asphalt");
  assert.equal(onDriveRoad(crossing.x, crossing.z), true);
  assert.equal(walks.some((walk) => pointInRect(pavement, walk)), true);
  assert.equal(worldHeightAt(pavement.x, pavement.z), 0.2);
  assert.equal(onDriveRoad(pavement.x, pavement.z), false);
});

test("phase 03 rotated parking offers a standing point clear of the widened walking obstacle", () => {
  const parking = { x: -3.3, z: -12, w: 2.8, d: 3.2 };
  const door = { x: -2.28, y: 0, z: -12.61, yaw: -1.01 };
  const ground = rideGroundAnchor(door, parking, 0.32);
  assert.ok(ground.x > parking.x + parking.w / 2 + 0.32);
  assert.equal(worldCanWalk(ground.x, ground.z, [parking], 0.32), true);
});

test("phase 03 ride profiles distinguish acceleration, steering, reverse and wet braking", () => {
  const accelerating = driveStep(pose, 0, "cng", size, input, dt, [], []);
  const cycling = driveStep(pose, 0, "rickshaw", size, input, dt, [], []);
  assert.ok(accelerating.speed > cycling.speed && cycling.speed > 0);
  const reverse = driveStep(
    pose,
    -0.5,
    "cng",
    size,
    { ...input, throttle: -1, steering: 1 },
    dt,
    [],
    [],
  );
  assert.ok(reverse.pose.z < pose.z && reverse.pose.yaw < 0);
  const dryBrake = driveStep(
    pose,
    4,
    "cng",
    size,
    { ...input, brake: true },
    dt,
    [],
    [],
  );
  const rainBrake = driveStep(
    pose,
    4,
    "cng",
    size,
    { ...input, brake: true, wet: true },
    dt,
    [],
    [],
  );
  assert.ok(dryBrake.speed < rainBrake.speed && rainBrake.speed < 4);
  assert.ok(
    Object.values(rideProfiles).every((profile) => profile.wheelRadius > 0),
  );
});

test("phase 03 swept vehicle footprint stops before thin obstacles, people and pavement", () => {
  const fast = { ...pose, z: 1.0 };
  const cases = [
    driveStep(
      fast,
      9,
      "cng",
      size,
      input,
      1,
      [{ x: -2.7, z: 2.55, w: 3, d: 0.04 }],
      [],
    ),
    driveStep(fast, 9, "cng", size, input, 1, [], [{ x: -2.7, z: 2.94 }]),
    driveStep(
      { ...pose, x: 4.39, yaw: Math.PI / 2 },
      9,
      "bicycle",
      { w: 0.7, d: 1.7 },
      input,
      1,
      [],
      [],
    ),
  ];
  for (const result of cases) {
    assert.equal(result.blocked, true);
    assert.equal(result.speed, 0);
    assert.ok(result.distance < 0.22);
  }
});

test("phase 03 vehicle follows the hub connector continuously and all checkpoint sites are walkable", () => {
  let result = driveStep(
    { ...pose, z: 21.4 },
    4,
    "cng",
    size,
    input,
    dt,
    [],
    [],
  );
  for (let frame = 0; frame < 120; frame++)
    result = driveStep(
      result.pose,
      result.speed,
      "cng",
      size,
      input,
      dt,
      [],
      [],
    );
  assert.ok(result.pose.z > 36);
  assert.equal(result.blocked, false);
  assert.deepEqual(
    checkpoints.map((point) => point.id),
    worldAreas.map((area) => area.id),
  );
  for (const point of checkpoints)
    assert.ok(
      worldCanWalk(point.x, point.z, allSectorObstacles, 0.38),
      point.id,
    );
  assert.equal(onDriveRoad(13, 13), false);
});
