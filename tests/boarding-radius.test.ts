import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canWalk,
  playerCollisionRadius,
  safeSpawnPoint,
  type SpawnEnvironment,
} from "../packages/shared/src/index.ts";
import {
  BoardingController,
  type BoardingPose,
  type BoardingVehicle,
} from "../apps/game/src/boarding.ts";

function roadsideFixture(blockDoor = false) {
  // Actual parked CNG world geometry/anchors at (4, 2), rotated by PI.
  const footprint = { x: 4, z: 2, w: 1.6, d: 2.9 },
    approach = { x: 2.62, y: 0, z: 1.92, yaw: Math.PI / 2 },
    entry = { x: 3.24, y: 0.08, z: 1.92, yaw: Math.PI / 2 },
    inside = { x: 3.75, y: 0.28, z: 2.18, yaw: Math.PI - 0.45 },
    seat = { x: 4, y: 0.34, z: 2.67, yaw: Math.PI },
    doorWall = { x: 2.62, z: 1.92, w: 0.1, d: 0.1 };
  const vehicle: BoardingVehicle = {
    id: "parked-green-cng",
    name: "সবুজ সিএনজি",
    footprint,
    occupied: false,
    approachPose: () => ({ ...approach }),
    entryPose: () => ({ ...entry }),
    seatPose: () => ({ ...seat }),
    exitPoses: () => [{ ...approach }],
    entryPath: () => [approach, entry, inside, seat].map((p) => ({ ...p })),
    exitPaths: () => [[seat, inside, entry, approach].map((p) => ({ ...p }))],
  };
  const environment = (ignoredVehicleId?: string): SpawnEnvironment => {
    const obstacles = [
      ...(ignoredVehicleId === vehicle.id ? [] : [footprint]),
      ...(blockDoor ? [doorWall] : []),
    ];
    return {
      bounds: { minX: -21.4, maxX: 21.4, minZ: -18.8, maxZ: 22.5 },
      obstacles,
      water: [],
      occupants: [],
      canNavigate: (x, z, radius) => canWalk(x, z, obstacles, radius),
    };
  };
  const player = {
    position: { x: 2.8788, y: 0, z: 1.0248 },
    rotation: { y: 0 },
  };
  const canStand = (x: number, z: number, ignoredVehicleId?: string) =>
    safeSpawnPoint(
      { x, z },
      environment(ignoredVehicleId),
      playerCollisionRadius,
    );
  const messages: string[] = [],
    events: string[] = [],
    controller = new BoardingController(player, [vehicle], {
      canStand,
      heightAt: () => 0,
      message: (message) => messages.push(message),
      onEvent: (event) => events.push(event),
    });
  return {
    player,
    controller,
    vehicle,
    environment,
    canStand,
    messages,
    events,
  };
}

test("a legal roadside walking pose can begin and finish the actual CNG approach without a larger boarding radius rejecting it", () => {
  const f = roadsideFixture(),
    start = { ...f.player.position };
  assert.ok(canWalk(start.x, start.z, [f.vehicle.footprint]));
  assert.ok(f.canStand(start.x, start.z));
  assert.equal(
    safeSpawnPoint(start, f.environment()),
    false,
    "new-game spawning keeps its separate conservative 0.42 m footprint",
  );
  assert.equal(f.controller.nearVehicle, f.vehicle);
  assert.equal(f.controller.toggle(), true);
  assert.deepEqual(f.player.position, start, "boarding must not teleport");
  for (let frame = 0; frame < 600 && f.controller.state !== "seated"; frame++) {
    f.controller.tick(1 / 60);
    if (f.controller.state === "approach")
      assert.ok(
        f.canStand(f.player.position.x, f.player.position.z),
        "approach must retain the same full-footprint walking clearance",
      );
  }
  assert.equal(f.controller.state, "seated");
  const seat: BoardingPose = f.vehicle.seatPose();
  assert.deepEqual(f.player.position, { x: seat.x, y: seat.y, z: seat.z });
  assert.deepEqual(f.events, ["interact", "entered"]);
  assert.equal(f.vehicle.occupied, true);
});

test("matching the walking radius still rejects CNG body penetration and unrelated doorway obstructions", () => {
  const clear = roadsideFixture();
  assert.equal(clear.canStand(3, 1.1), false);
  assert.equal(clear.canStand(3, 1.1, clear.vehicle.id), true);
  const blocked = roadsideFixture(true),
    initial = { ...blocked.player.position },
    doorway = blocked.vehicle.approachPose();
  assert.equal(
    blocked.canStand(doorway.x, doorway.z, blocked.vehicle.id),
    false,
  );
  assert.equal(blocked.controller.toggle(), false);
  assert.equal(blocked.controller.state, "onFoot");
  assert.equal(blocked.vehicle.occupied, false);
  assert.deepEqual(blocked.player.position, initial);
  assert.match(blocked.messages.at(-1)!, /পথ আটকে আছে/u);
});
