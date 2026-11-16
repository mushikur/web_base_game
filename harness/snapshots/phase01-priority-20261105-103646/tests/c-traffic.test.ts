import assert from "node:assert/strict";
import { test } from "node:test";
import {
  trafficLoops,
  trafficLoopLength,
  sampleTrafficLoop,
  trafficBlocked,
  TrafficDriver,
} from "../apps/game/src/sectorTrafficPath.ts";
import { worldCanWalk } from "../packages/shared/src/navigation.ts";
import { allSectorObstacles } from "../apps/game/src/sectorBlueprints.ts";

test("scripted C traffic loops join with continuous position and heading", () => {
  for (const loop of trafficLoops) {
    const total = trafficLoopLength(loop);
    assert.deepEqual(
      sampleTrafficLoop(loop, 0),
      sampleTrafficLoop(loop, total),
    );
    const last = sampleTrafficLoop(loop, total - 0.0001),
      first = sampleTrafficLoop(loop, 0.0001);
    assert.ok(Math.hypot(last.x - first.x, last.z - first.z) < 0.00021);
    assert.ok(
      Math.abs(
        Math.atan2(
          Math.sin(last.yaw - first.yaw),
          Math.cos(last.yaw - first.yaw),
        ),
      ) < 0.0001,
    );
    for (let d = 0; d < total; d += 0.2) {
      const pose = sampleTrafficLoop(loop, d),
        next = sampleTrafficLoop(loop, d + 0.2);
      assert.ok(Math.hypot(next.x - pose.x, next.z - pose.z) < 0.201);
      for (const lateral of [-0.82, 0, 0.82])
        for (const forward of [-1.5, 0, 1.5]) {
          const x =
            pose.x +
            Math.cos(pose.yaw) * lateral +
            Math.sin(pose.yaw) * forward;
          const z =
            pose.z -
            Math.sin(pose.yaw) * lateral +
            Math.cos(pose.yaw) * forward;
          assert.equal(
            worldCanWalk(x, z, allSectorObstacles, 0.05),
            true,
            `${loop.id} ${d}`,
          );
        }
    }
  }
});

test("traffic yields before touching a player, resumes after clearance, freezes during tutorial and pause", () => {
  const driver = new TrafficDriver(trafficLoops[0]);
  const pose = driver.pose;
  const player = {
    x: pose.x + Math.sin(pose.yaw) * 2,
    z: pose.z + Math.cos(pose.yaw) * 2,
  };
  assert.equal(trafficBlocked(pose, [player], 3), true);
  for (let i = 0; i < 100; i++)
    driver.tick(0.05, [player], false, false, false);
  assert.equal(driver.moved, 0);
  assert.notEqual(driver.reason, "");
  for (let i = 0; i < 30; i++) driver.tick(0.05, [], false, false, false);
  assert.ok(driver.moved > 0);
  const before = driver.distance;
  driver.tick(0.05, [], true, false, false);
  assert.equal(driver.distance, before);
  assert.match(driver.reason, /অ্যাম্বুলেন্স/);
  driver.tick(0.05, [], false, true, false);
  assert.equal(driver.distance, before);
  assert.match(driver.reason, /শেখার/);
  driver.tick(50, [], false, false, true);
  assert.equal(driver.distance, before);
  driver.tick(0.05, [], false, false, false);
  assert.ok(driver.distance > before);
});

test("traffic lookahead respects lateral clearance and caps background steps", () => {
  const driver = new TrafficDriver(trafficLoops[0]),
    pose = driver.pose;
  assert.equal(trafficBlocked(pose, [{ x: pose.x, z: pose.z + 3 }], 3), false);
  driver.tick(20, [], false, false, false);
  assert.ok(driver.moved < 0.01);
  driver.tick(NaN, [], false, false, false);
  assert.ok(driver.moved < 0.01);
});
