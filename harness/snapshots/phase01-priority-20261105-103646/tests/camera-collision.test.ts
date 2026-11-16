import assert from "node:assert/strict";
import { test } from "node:test";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Ray } from "@babylonjs/core/Culling/ray.js";
// The real world registers StandardMaterial; without this, NullEngine falls back
// to bounding-sphere centre distances instead of triangle entry distances.
import "@babylonjs/core/Materials/standardMaterial.js";
import {
  cameraBounds,
  cameraCollider,
  cameraRetractionDistance,
  avatarOpacityForDistance,
  nextAvatarOpacity,
} from "../apps/game/src/cameraCollision.ts";

test("tea-shop camera retracts before the side wall at the observed grazing position", (t) => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  t.after(() => engine.dispose());
  const wall = MeshBuilder.CreateBox(
    "Tea shop brick side",
    { width: 5.7, height: 2.6, depth: 0.21 },
    scene,
  );
  wall.position.set(-8.7, 1.3, -3.6);
  const bounds = cameraBounds(wall),
    proxy = cameraCollider(scene, bounds),
    target = new Vector3(-5.740278241400066, 0.34 + 1.28, -1.0851475502951409),
    back = new Vector3(0, 0.35 + 0.18 * 4.8, -4.8),
    direction = back.normalizeToNew(),
    ray = new Ray(target, direction, back.length());
  proxy.computeWorldMatrix(true);

  // Reproduce why checking a thin wall with just the centre ray was insufficient.
  assert.equal(ray.intersectsMesh(wall, false).hit, false);
  const hit = ray.intersectsMesh(proxy, false);
  assert.equal(hit.hit, true);
  const safeDistance = cameraRetractionDistance(back.length(), hit.distance),
    camera = target.add(direction.scale(safeDistance));
  assert.ok(
    safeDistance < 2.5,
    "camera must stay on the player's side of the wall",
  );
  assert.ok(camera.z > -3.245, "near plane must not be placed behind the wall");
  assert.equal(proxy.visibility, 0);
  assert.equal(
    proxy.physicsBody,
    undefined,
    "camera proxy must not change Havok movement",
  );
  assert.equal(
    proxy.checkCollisions,
    false,
    "walking collisions remain separate",
  );

  // Leaving the shop edge restores the unobstructed street camera.
  const streetRay = new Ray(
    new Vector3(-5, target.y, target.z),
    direction,
    back.length(),
  );
  assert.equal(streetRay.intersectsMesh(proxy, false).hit, false);
});

test("the observed tight tea counter cannot push the retracted camera through its near surface", (t) => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  t.after(() => engine.dispose());
  // Actual broad counter collider in world.ts/physics(), not a synthetic hit number.
  const counter = MeshBuilder.CreateBox(
    "Tea service counter collision",
    { width: 1.25, height: 1.75, depth: 6 },
    scene,
  );
  counter.position.set(-6.7, 1.75 / 2, 0.2);
  counter.computeWorldMatrix(true);
  const target = new Vector3(-5.7214, 0.34 + 1.28, -0.55275),
    back = new Vector3(
      -Math.sin(1.6) * 4.8,
      0.35 - 0.08 * 4.8,
      -Math.cos(1.6) * 4.8,
    ),
    direction = back.normalizeToNew(),
    hit = new Ray(target, direction, back.length()).intersectsMesh(
      counter,
      false,
    );
  assert.equal(hit.hit, true);
  assert.ok(hit.distance > 0.34 && hit.distance < 0.37);
  const oldCamera = target.add(
    direction.scale(Math.max(0.65, hit.distance - 0.35)),
  );
  assert.ok(
    oldCamera.x < -6.075,
    "the previous minimum crossed into the actual counter",
  );
  const safeDistance = cameraRetractionDistance(back.length(), hit.distance),
    camera = target.add(direction.scale(safeDistance));
  assert.ok(safeDistance < hit.distance);
  assert.ok(
    camera.x > -6.025,
    "lens remains on the player's side with surface clearance",
  );
  assert.equal(avatarOpacityForDistance(Vector3.Distance(camera, target)), 0);
  assert.equal(
    counter.checkCollisions,
    false,
    "camera resolution does not mutate walking collision",
  );
});

test("sub-minimum ray hits resolve before the wall and avatar opacity restores only after clearance", (t) => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  t.after(() => engine.dispose());
  const wall = MeshBuilder.CreateBox(
    "Very close wall",
    { width: 0.2, height: 3, depth: 3 },
    scene,
  );
  wall.position.set(-0.18, 1.5, 0);
  wall.computeWorldMatrix(true);
  const focus = new Vector3(0, 1.28, 0),
    direction = new Vector3(-1, 0, 0),
    hit = new Ray(focus, direction, 4.8).intersectsMesh(wall, false);
  assert.equal(hit.hit, true);
  assert.ok(hit.distance > 0.07 && hit.distance < 0.09);
  const distance = cameraRetractionDistance(4.8, hit.distance);
  assert.ok(distance >= 0 && distance <= hit.distance - 0.049);
  const opaque = 1,
    hidden = nextAvatarOpacity(
      opaque,
      avatarOpacityForDistance(distance),
      1 / 60,
    );
  assert.equal(
    hidden,
    0,
    "fade-out must happen before rendering a body-filled frame",
  );
  const normalOnFootCamera = focus.add(new Vector3(0, 1.214, -4.8));
  assert.equal(
    avatarOpacityForDistance(Vector3.Distance(normalOnFootCamera, focus)),
    1,
  );
  const seatFocus = new Vector3(4, 0.34 + 0.92, 2.67),
    seatedCamera = seatFocus.add(new Vector3(0, 1.214, -4.8));
  assert.equal(
    avatarOpacityForDistance(Vector3.Distance(seatedCamera, seatFocus)),
    1,
  );
  const firstRecovery = nextAvatarOpacity(hidden, 1, 1 / 60);
  assert.ok(firstRecovery > 0 && firstRecovery < 0.2);
  let restored = firstRecovery;
  for (let frame = 0; frame < 60; frame++)
    restored = nextAvatarOpacity(restored, 1, 1 / 60);
  assert.ok(restored > 0.999);
});

test("camera bounds retain the authored wall's world height and are independent of batching", (t) => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  t.after(() => engine.dispose());
  const wall = MeshBuilder.CreateBox(
    "Offset raised wall",
    { width: 5.7, height: 2.6, depth: 0.21 },
    scene,
  );
  wall.position.set(-8.7, 1.3, 3.6);
  const bounds = cameraBounds(wall);
  wall.dispose();
  const proxy = cameraCollider(scene, bounds);
  assert.ok(Math.abs(proxy.position.y - 1.3) < 1e-5);
  assert.ok(Math.abs(bounds.h - 2.6) < 1e-5);
  const target = new Vector3(-5.740278241400066, 1.62, 1.0851475502951409),
    ray = new Ray(target, new Vector3(0, 1.214, 4.8).normalize(), 4.951);
  proxy.computeWorldMatrix(true);
  assert.equal(ray.intersectsMesh(proxy, false).hit, true);
  assert.ok(proxy.getBoundingInfo().boundingBox.minimumWorld.y < 0);
});
