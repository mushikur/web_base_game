import type { NavigationObstacle } from "../../../packages/shared/src/navigation.ts";
import type { AIPoint, AIPose } from "./missionAI.ts";
import { ambulanceFootprint } from "./ambulanceGeometry.ts";
import { sweptProjectileDistance } from "./projectileAim.ts";
export { ambulanceFootprint } from "./ambulanceGeometry.ts";
export function canMoveAroundActors(
  from: AIPoint,
  to: AIPoint,
  occupants: readonly AIPoint[],
  clearance = 0.68,
) {
  return occupants.every((point) => {
    const before = Math.hypot(from.x - point.x, from.z - point.z),
      after = Math.hypot(to.x - point.x, to.z - point.z);
    if (before < clearance) return after > before + 1e-6;
    return (
      sweptProjectileDistance(
        { x: from.x, y: 0, z: from.z },
        { x: to.x, y: 0, z: to.z },
        { x: point.x, y: 0, z: point.z },
      ) >= clearance
    );
  });
}
type Footprint = { w: number; d: number };
/** Transform into the actual vehicle frame before testing body occupancy. */
export function rotatedVehicleContains(
  point: AIPoint,
  pose: AIPose,
  padding = 0,
  footprint: Footprint = ambulanceFootprint,
) {
  const dx = point.x - pose.x,
    dz = point.z - pose.z,
    c = Math.cos(pose.yaw),
    s = Math.sin(pose.yaw);
  return (
    Math.abs(c * dx - s * dz) <= footprint.w / 2 + padding &&
    Math.abs(s * dx + c * dz) <= footprint.d / 2 + padding
  );
}
function overlap(
  pose: AIPose,
  footprint: Footprint,
  obstacle: NavigationObstacle,
  padding: number,
) {
  const c = Math.cos(pose.yaw),
    s = Math.sin(pose.yaw),
    dx = obstacle.x - pose.x,
    dz = obstacle.z - pose.z;
  const hx = footprint.w / 2 + padding,
    hz = footprint.d / 2 + padding,
    ox = obstacle.w / 2,
    oz = obstacle.d / 2;
  // Separating-axis test: world X/Z plus the microbus's two rotated body axes.
  return !(
    Math.abs(dx) > Math.abs(c) * hx + Math.abs(s) * hz + ox ||
    Math.abs(dz) > Math.abs(s) * hx + Math.abs(c) * hz + oz ||
    Math.abs(c * dx - s * dz) > hx + Math.abs(c) * ox + Math.abs(s) * oz ||
    Math.abs(s * dx + c * dz) > hz + Math.abs(s) * ox + Math.abs(c) * oz
  );
}
/** Exact OBB/AABB collision for every static obstacle, plus authored-ground
 * coverage and occupied character circles across the entire body, not9corners. */
export function rotatedFootprintClear(
  pose: AIPose,
  obstacles: readonly NavigationObstacle[],
  canStand: (x: number, z: number) => boolean,
  occupants: readonly AIPoint[] = [],
  footprint: Footprint = ambulanceFootprint,
  occupantRadius = 0.38,
) {
  if (
    ![pose.x, pose.z, pose.yaw, footprint.w, footprint.d].every(
      Number.isFinite,
    ) ||
    footprint.w <= 0 ||
    footprint.d <= 0
  )
    return false;
  if (obstacles.some((o) => overlap(pose, footprint, o, 0.025))) return false;
  if (
    occupants.some((p) =>
      rotatedVehicleContains(p, pose, occupantRadius, footprint),
    )
  )
    return false;
  const across = Math.ceil(footprint.w / 0.35),
    lengthwise = Math.ceil(footprint.d / 0.35),
    c = Math.cos(pose.yaw),
    s = Math.sin(pose.yaw);
  for (let i = 0; i <= across; i++)
    for (let j = 0; j <= lengthwise; j++) {
      const x = -footprint.w / 2 + (footprint.w * i) / across,
        z = -footprint.d / 2 + (footprint.d * j) / lengthwise;
      if (!canStand(pose.x + c * x + s * z, pose.z - s * x + c * z))
        return false;
    }
  return true;
}
/** Conservative whole-body AABB for an on-foot path planner. The controller
 * ignores this only during authored open-door/interior anchor movement. */
export function ambulanceNavigationObstacles(
  pose: AIPose,
  footprint: Footprint = ambulanceFootprint,
): NavigationObstacle[] {
  const c = Math.abs(Math.cos(pose.yaw)),
    s = Math.abs(Math.sin(pose.yaw));
  return [
    {
      x: pose.x,
      z: pose.z,
      w: c * footprint.w + s * footprint.d,
      d: s * footprint.w + c * footprint.d,
    },
  ];
}
