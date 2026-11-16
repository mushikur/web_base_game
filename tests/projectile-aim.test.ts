import { test } from "node:test";
import assert from "node:assert/strict";
import {
  movingThrowAim,
  sweptProjectileDistance,
} from "../apps/game/src/projectileAim.ts";
import { launchVelocity } from "../packages/shared/src/index.ts";
import { canMoveAroundActors } from "../apps/game/src/missionClearance.ts";
test("short and distant throws retain gravity and intercept an observed moving target", () => {
  const origin = { x: 6, y: 1.4, z: 13 },
    target = { x: 4.5, y: 1, z: 13 },
    motion = { x: 0, y: 80, z: 2.9 };
  const { flight, target: aim } = movingThrowAim(origin, target, motion),
    v = launchVelocity(origin, aim, flight);
  assert.equal(flight, 0.18);
  const at = {
    x: origin.x + v.x * flight,
    y: origin.y + v.y * flight - 4.905 * flight * flight,
    z: origin.z + v.z * flight,
  };
  assert.ok(Math.abs(at.x - target.x) < 1e-9);
  assert.ok(Math.abs(at.y - target.y) < 1e-9);
  assert.ok(Math.abs(at.z - (target.z + motion.z * flight)) < 1e-9);
  assert.equal(movingThrowAim(origin, { x: 100, y: 1, z: 13 }).flight, 0.75);
  const stopped = movingThrowAim(origin, target, {
    x: NaN,
    y: Infinity,
    z: 99,
  });
  assert.equal(stopped.target.x, target.x);
  assert.ok(stopped.target.z - target.z <= 5 * 0.18 + 1e-8);
});
test("continuous physics positions detect a crossing without inventing a nearby miss", () => {
  const from = { x: -2, y: 1, z: 0 },
    to = { x: 2, y: 1, z: 0 };
  assert.equal(sweptProjectileDistance(from, to, { x: 0, y: 1, z: 0 }), 0);
  assert.equal(sweptProjectileDistance(from, to, { x: 0, y: 1, z: 1 }), 1);
  assert.equal(sweptProjectileDistance(from, from, { x: -2, y: 1, z: 0 }), 0);
  assert.equal(sweptProjectileDistance(from, to, { x: 3, y: 1, z: 0 }), 1);
});
test("a player cannot cross an occupied body or become trapped by initial overlap", () => {
  const people = [{ x: 0, z: 0 }];
  assert.equal(
    canMoveAroundActors({ x: -2, z: 0 }, { x: 2, z: 0 }, people),
    false,
  );
  assert.equal(
    canMoveAroundActors({ x: -2, z: 1 }, { x: 2, z: 1 }, people),
    true,
  );
  assert.equal(
    canMoveAroundActors({ x: 0.5, z: 0 }, { x: 0.7, z: 0 }, people),
    true,
  );
  assert.equal(
    canMoveAroundActors({ x: 0.5, z: 0 }, { x: 0.4, z: 0 }, people),
    false,
  );
});
