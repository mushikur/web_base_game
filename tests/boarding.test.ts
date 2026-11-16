import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BoardingController,
  boardingApproachPath,
  boardingDurations,
  clearBoardingSegment,
  type BoardingPose,
  type BoardingVehicle,
} from "../apps/game/src/boarding.ts";

const pose = (
  x: number,
  y: number,
  z: number,
  yaw = -Math.PI / 2,
): BoardingPose => ({ x, y, z, yaw });
const copyPosition = (player: {
  position: { x: number; y: number; z: number };
}) => ({ ...player.position });

function fixture() {
  let offset = 0;
  let blocked: (
    x: number,
    z: number,
    ignoredVehicleId?: string,
  ) => boolean = () => false;
  const player = { position: { x: -1, y: 0.32, z: 0 }, rotation: { y: 0 } };
  const local = (point: BoardingPose) => ({ ...point, x: point.x + offset });
  const vehicle: BoardingVehicle = {
    id: "practice-cng",
    name: "সবুজ সিএনজি",
    footprint: { x: 1.3, z: 0.3, w: 1.6, d: 1.6 },
    occupied: false,
    approachPose: () => local(pose(0, 0.32, 0)),
    entryPose: () => local(pose(0.6, 0.08, 0)),
    seatPose: () => local(pose(1.3, 0.34, 0.6, Math.PI)),
    exitPoses: () => [local(pose(0, 0, 0)), local(pose(2.6, 0, 0))],
    entryPath: () => [
      vehicle.approachPose(),
      vehicle.entryPose(),
      local(pose(1.05, 0.28, 0.25)),
      vehicle.seatPose(),
    ],
    exitPaths: () => [
      [
        vehicle.seatPose(),
        local(pose(1.05, 0.28, 0.25)),
        vehicle.entryPose(),
        vehicle.exitPoses()[0],
      ],
      [
        vehicle.seatPose(),
        local(pose(1.6, 0.28, 0.25)),
        local(pose(2, 0.08, 0)),
        vehicle.exitPoses()[1],
      ],
    ],
  };
  const messages: string[] = [],
    events: string[] = [];
  const canStand = (x: number, z: number, ignoredVehicleId?: string) => {
    const vehicleCollision =
      ignoredVehicleId !== vehicle.id &&
      x - offset > 0.5 &&
      x - offset < 2.1 &&
      z > -0.5 &&
      z < 1.2;
    return !vehicleCollision && !blocked(x, z, ignoredVehicleId);
  };
  const controller = new BoardingController(player, [vehicle], {
    canStand,
    heightAt: () => 0.32,
    message: (message) => messages.push(message),
    onEvent: (event) => events.push(event),
  });
  return {
    player,
    vehicle,
    messages,
    events,
    controller,
    block: (predicate: typeof blocked) => {
      blocked = predicate;
    },
    moveVehicle: (distance: number) => {
      offset += distance;
    },
  };
}

function advanceTo(
  f: ReturnType<typeof fixture>,
  state: string,
  frameLimit = 300,
) {
  for (
    let frame = 0;
    frame < frameLimit && f.controller.state !== state;
    frame++
  )
    f.controller.tick(1 / 60);
  assert.equal(
    f.controller.state,
    state,
    `expected ${state} within ${frameLimit} frames`,
  );
}

test("boarding walks to the door, enters continuously, follows the seat and exits to ground", () => {
  const f = fixture(),
    initial = copyPosition(f.player);
  assert.equal(f.controller.nearVehicle, f.vehicle);
  assert.equal(f.controller.toggle(), true);
  assert.deepEqual(
    f.player.position,
    initial,
    "requesting boarding must not teleport",
  );
  assert.equal(f.vehicle.occupied, true);
  assert.equal(f.controller.motion, "Idle");
  f.controller.tick(1 / 60);
  assert.equal(f.controller.motion, "Walk");
  assert.ok(
    f.player.position.x > initial.x && f.player.position.x < initial.x + 0.036,
  );
  advanceTo(f, "entering");
  const doorway = copyPosition(f.player);
  f.controller.tick(1 / 60);
  assert.ok(
    Math.hypot(
      f.player.position.x - doorway.x,
      f.player.position.z - doorway.z,
    ) < 0.03,
  );
  assert.equal(f.controller.motion, "EnterVehicle");
  advanceTo(f, "seated");
  assert.deepEqual(f.player.position, { x: 1.3, y: 0.34, z: 0.6 });
  assert.equal(f.controller.motion, "Seated");
  assert.deepEqual(f.events, ["interact", "entered"]);

  f.moveVehicle(0.15);
  f.controller.tick(1 / 60);
  assert.equal(
    f.player.position.x,
    1.45,
    "seated pose follows the real vehicle anchor each tick",
  );
  assert.deepEqual(f.controller.cameraFocus, {
    position: { x: 1.45, y: 1.26, z: 0.6 },
    ignoredVehicleId: f.vehicle.id,
  });
  const seated = copyPosition(f.player);
  assert.equal(f.controller.toggle(), true);
  assert.deepEqual(
    f.player.position,
    seated,
    "requesting exit must not teleport",
  );
  assert.equal(f.controller.motion, "ExitVehicle");
  advanceTo(f, "onFoot");
  assert.ok(Math.abs(f.player.position.x - 0.15) < 1e-12);
  assert.equal(f.player.position.y, 0.32);
  assert.equal(f.player.position.z, 0);
  assert.equal(f.vehicle.occupied, false);
  assert.equal(f.controller.activeVehicle, undefined);
  assert.equal(f.controller.locked, false);
  assert.deepEqual(f.events, ["interact", "entered", "exited"]);
});

test("door arrival turns continuously at 60 Hz and uses Idle for stationary alignment", () => {
  const f = fixture();
  f.player.rotation.y = Math.PI / 2;
  f.controller.toggle();
  let stationaryAlignmentFrames = 0;
  for (
    let frame = 0;
    frame < 300 && f.controller.state === "approach";
    frame++
  ) {
    const before = copyPosition(f.player),
      yaw = f.player.rotation.y;
    f.controller.tick(1 / 60);
    const turn = Math.abs(
      Math.atan2(
        Math.sin(f.player.rotation.y - yaw),
        Math.cos(f.player.rotation.y - yaw),
      ),
    );
    assert.ok(
      turn <= 3.5 / 60 + 1e-10,
      "approach rotation must obey the angular speed limit even at arrival",
    );
    const travelled = Math.hypot(
      f.player.position.x - before.x,
      f.player.position.z - before.z,
    );
    if (f.controller.state === "approach" && travelled < 1e-10) {
      stationaryAlignmentFrames++;
      assert.equal(
        f.controller.motion,
        "Idle",
        "waiting to face the door must not keep the Walk clip active",
      );
    }
  }
  assert.ok(
    stationaryAlignmentFrames > 0,
    "fixture must exercise alignment at rest",
  );
  assert.equal(f.controller.state, "entering");
  const target = f.vehicle.approachPose().yaw;
  assert.ok(
    Math.abs(
      Math.atan2(
        Math.sin(f.player.rotation.y - target),
        Math.cos(f.player.rotation.y - target),
      ),
    ) < 1e-5,
  );
  assert.equal(f.controller.motion, "EnterVehicle");
  assert.equal(
    f.controller.animationTime,
    0,
    "entry animation starts at its first frame after alignment",
  );
});

test("entry begins at actual ground height when the authored outside anchor is on a raised curb", () => {
  const f = fixture();
  // The model's outside anchor is vehicle-local ground, while the street's
  // collision-safe point can stand on a raised pavement.
  f.vehicle.approachPose = () => pose(0, 0, 0);
  f.controller.toggle();
  advanceTo(f, "entering");
  assert.equal(f.player.position.y, 0.32);
  f.controller.tick(1 / 60);
  assert.ok(
    Math.abs(f.player.position.y - 0.32) < 0.02,
    "the first entry frame must interpolate from ground instead of dropping to the authored anchor",
  );
  advanceTo(f, "seated");
  assert.equal(f.player.position.y, 0.34);
});

test("busy, distant or obstructed vehicles cannot claim occupancy or move the player", () => {
  for (const condition of ["occupied", "distant", "blocked-door"] as const) {
    const f = fixture();
    if (condition === "occupied") f.vehicle.occupied = true;
    if (condition === "distant") f.player.position.x = -3;
    if (condition === "blocked-door") f.block((x) => x > 0.65 && x < 0.8);
    const before = copyPosition(f.player);
    assert.equal(f.controller.toggle(), false, condition);
    assert.deepEqual(f.player.position, before);
    assert.equal(f.controller.locked, false);
    assert.deepEqual(f.events, []);
    assert.equal(f.vehicle.occupied, condition === "occupied");
  }
});

test("a new approach obstruction stops at the last safe position and releases occupancy", () => {
  const f = fixture();
  assert.equal(f.controller.toggle(), true);
  f.controller.tick(0.1);
  const safe = copyPosition(f.player);
  f.block((x) => x > safe.x + 0.02 && x < safe.x + 0.15);
  f.controller.tick(0.1);
  assert.deepEqual(
    f.player.position,
    safe,
    "cannot tunnel through an obstruction appearing after route selection",
  );
  assert.equal(f.controller.state, "onFoot");
  assert.equal(f.vehicle.occupied, false);
  assert.deepEqual(f.events, ["interact"]);
});

test("entry obstruction freezes motion and animation together, then resumes once clear", () => {
  const f = fixture();
  f.controller.toggle();
  advanceTo(f, "entering");
  f.controller.tick(0.2);
  const safe = copyPosition(f.player),
    animationTime = f.controller.animationTime;
  f.block((x) => x > safe.x + 0.01);
  const messageCount = f.messages.length;
  for (let frame = 0; frame < 20; frame++) f.controller.tick(1 / 60);
  assert.deepEqual(f.player.position, safe);
  assert.equal(f.controller.animationTime, animationTime);
  assert.equal(
    f.messages.length,
    messageCount + 1,
    "waiting should not flood subtitles every frame",
  );
  assert.equal(f.vehicle.occupied, true);
  f.block(() => false);
  advanceTo(f, "seated");
  assert.deepEqual(f.events, ["interact", "entered"]);
});

test("blocked exits keep the player seated, while an alternate safe door is selected", () => {
  const f = fixture();
  f.controller.toggle();
  advanceTo(f, "seated");
  const safe = copyPosition(f.player);
  f.block((x, _z, ignored) => ignored === undefined && (x < 0.2 || x > 2.4));
  assert.equal(f.controller.toggle(), false);
  assert.equal(f.controller.state, "seated");
  assert.deepEqual(f.player.position, safe);
  assert.equal(f.vehicle.occupied, true);

  f.block((x) => x < 0.2);
  assert.equal(f.controller.toggle(), true);
  advanceTo(f, "onFoot");
  assert.deepEqual(f.player.position, { x: 2.6, y: 0.32, z: 0 });
  assert.deepEqual(f.events, ["interact", "entered", "exited"]);
});

test("an exit obstruction freezes at the last safe pose and resumes without a ground-height pop", () => {
  const f = fixture();
  f.controller.toggle();
  advanceTo(f, "seated");
  f.controller.toggle();
  f.controller.tick(0.2);
  const safe = copyPosition(f.player),
    animationTime = f.controller.animationTime;
  f.block((x) => x < safe.x - 0.01);
  for (let frame = 0; frame < 20; frame++) f.controller.tick(1 / 60);
  assert.deepEqual(f.player.position, safe);
  assert.equal(f.controller.animationTime, animationTime);
  assert.equal(f.vehicle.occupied, true);
  f.block(() => false);
  f.controller.tick(
    boardingDurations.ExitVehicle - f.controller.animationTime - 0.001,
  );
  assert.equal(f.controller.state, "exiting");
  const beforeLanding = copyPosition(f.player);
  f.controller.tick(0.0011);
  assert.equal(f.controller.state, "onFoot");
  assert.ok(
    Math.abs(beforeLanding.y - f.player.position.y) < 0.001,
    "exit animation must converge to street height before unlocking movement",
  );
});

test("reset releases occupancy without inventing a position, and invalid tick times do nothing", () => {
  const f = fixture();
  f.controller.toggle();
  f.controller.tick(0.1);
  const safe = copyPosition(f.player),
    time = f.controller.animationTime;
  for (const dt of [0, -0.1, NaN, Infinity]) f.controller.tick(dt);
  assert.deepEqual(f.player.position, safe);
  assert.equal(f.controller.animationTime, time);
  f.controller.reset();
  assert.equal(f.vehicle.occupied, false);
  assert.equal(f.controller.state, "onFoot");
  assert.deepEqual(f.player.position, safe);
  assert.deepEqual(f.events, ["interact"]);
});

test("approach planning validates thin-wall crossings, routes around obstacles and fails finitely when enclosed", () => {
  const from = { x: -1, z: 0 },
    to = { x: 1, z: 0 };
  const clear = (x: number, z: number) =>
    !(Math.abs(x) < 0.12 && Math.abs(z) < 0.75);
  assert.equal(
    clearBoardingSegment(from, to, clear),
    false,
    "two safe endpoints cannot skip a wall",
  );
  const route = boardingApproachPath(from, to, clear);
  assert.ok(route && route.length > 1);
  let previous = from;
  for (const point of route) {
    assert.equal(clearBoardingSegment(previous, point, clear), true);
    previous = point;
  }
  assert.deepEqual(route.at(-1), to);
  let evaluations = 0;
  const enclosed = boardingApproachPath(
    { x: 0, z: 0 },
    { x: 2, z: 0 },
    (x, z) => {
      evaluations++;
      const radius = Math.hypot(x, z);
      return radius < 0.4 || radius > 0.8;
    },
  );
  assert.equal(enclosed, undefined);
  assert.ok(
    evaluations < 1000,
    "an enclosed start must terminate rather than retry indefinitely",
  );
});
