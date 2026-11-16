import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import type { Scene } from "@babylonjs/core/scene.js";

export type CameraObstacle = {
  name: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
};

/** Prefer the normal .35 m gap, but never let a minimum camera distance put the
 * lens beyond a nearby surface. Extremely close hits may retract to the focus. */
export function cameraRetractionDistance(
  desiredDistance: number,
  hitDistance: number,
) {
  if (!Number.isFinite(desiredDistance) || desiredDistance <= 0) return 0;
  if (!Number.isFinite(hitDistance) || hitDistance < 0) return desiredDistance;
  return Math.min(
    desiredDistance,
    Math.max(0, hitDistance - 0.05),
    Math.max(0.05, hitDistance - 0.35),
  );
}

/** The camera uses an upper-body anchor, rather than the feet, when deciding if
 * a retracted camera is inside the avatar. Normal follow/vehicle views stay opaque. */
export function avatarOpacityForDistance(distance: number) {
  if (!Number.isFinite(distance)) return 1;
  const t = Math.max(0, Math.min(1, (distance - 0.55) / 0.55));
  return t * t * (3 - 2 * t);
}

/** Obstruction fades immediately; visibility recovers smoothly after clearance. */
export function nextAvatarOpacity(current: number, target: number, dt: number) {
  if (target <= current) return target;
  return current + (target - current) * Math.min(1, Math.max(0, dt) * 10);
}

/** Capture authored geometry before static batching disposes its source mesh. */
export function cameraBounds(mesh: AbstractMesh): CameraObstacle {
  mesh.computeWorldMatrix(true);
  const { minimumWorld: min, maximumWorld: max } =
    mesh.getBoundingInfo().boundingBox;
  return {
    name: mesh.name,
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
    w: max.x - min.x,
    h: max.y - min.y,
    d: max.z - min.z,
  };
}

/** The camera has a near plane, so a centre ray alone may graze a visible wall. */
export function cameraCollider(scene: Scene, bounds: CameraObstacle) {
  const clearance = 0.25;
  const mesh = MeshBuilder.CreateBox(
    `Hidden camera collider ${bounds.name}`,
    {
      width: bounds.w + 2 * clearance,
      height: bounds.h + 2 * clearance,
      depth: bounds.d + 2 * clearance,
    },
    scene,
  );
  mesh.position.set(bounds.x, bounds.y, bounds.z);
  mesh.computeWorldMatrix(true);
  mesh.visibility = 0;
  mesh.isPickable = false;
  mesh.metadata = { staticBatchExclude: true };
  return mesh;
}
