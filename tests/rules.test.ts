import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bn,
  canWalk,
  launchVelocity,
  rewardForHit,
  content,
} from "../packages/shared/src/index.ts";
test("civilian hits never award mission points", () => {
  assert.equal(rewardForHit("civilian", "egg"), 0);
  assert.equal(rewardForHit("civilian", "sandal"), 0);
  assert.equal(rewardForHit("leader", "egg"), 5);
  assert.equal(rewardForHit("worker", "sandal"), 8);
});
test("projectile trajectory reaches its target under gravity", () => {
  const from = { x: 1, y: 1.3, z: -4 },
    to = { x: 4, y: 1, z: 3 },
    t = 0.65,
    v = launchVelocity(from, to, t);
  assert.ok(Math.abs(from.x + v.x * t - to.x) < 1e-8);
  assert.ok(Math.abs(from.y + v.y * t - 4.905 * t * t - to.y) < 1e-8);
  assert.ok(Math.abs(from.z + v.z * t - to.z) < 1e-8);
});
test("street colliders block inflated footprints but allow clear pavement", () => {
  const o = [{ x: 2, z: 2, w: 2, d: 2 }];
  assert.equal(canWalk(2, 2, o), false);
  assert.equal(canWalk(0.8, 2, o), false);
  assert.equal(canWalk(0, 0, o), true);
  assert.equal(canWalk(25, 0, o), false);
});
test("Bengali Unicode survives content and numeral formatting", () => {
  assert.equal(bn(125), "১২৫");
  assert.ok(content.mission.includes("কুড়িয়ে"));
  assert.ok(content.shapingSample.includes("প্রতিশ্রুতি"));
  for (const text of [
    content.title,
    content.slogan,
    content.location,
    ...content.workers,
    ...content.civilians,
  ]) {
    assert.ok(/[\u0980-\u09ff]/u.test(text));
    assert.ok(!/[\ufffd]/u.test(text));
  }
});
