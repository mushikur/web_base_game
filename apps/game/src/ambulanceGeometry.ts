import type { AIPose } from "./missionAI.ts";
export const ambulanceFootprint = { w: 2.2, d: 5.05 } as const;
export const ambulanceLocalAnchors = {
  rear: { x: 0, y: 0.12, z: -2.9, yaw: 0 },
  rest: { x: 0, y: 0.52, z: -0.77, yaw: Math.PI },
  seats: [
    { x: -0.48, y: 0.42, z: 0.74, yaw: 0 },
    { x: 0.48, y: 0.42, z: 0.74, yaw: 0 },
  ],
  exits: [
    { x: -1.55, y: 0.12, z: 0.76, yaw: 0 },
    { x: 1.55, y: 0.12, z: 0.76, yaw: 0 },
  ],
} as const;
export function ambulanceAnchorsAt(pose: AIPose) {
  const transform = (p: AIPose): AIPose => ({
    x: pose.x + Math.cos(pose.yaw) * p.x + Math.sin(pose.yaw) * p.z,
    y: pose.y + p.y,
    z: pose.z - Math.sin(pose.yaw) * p.x + Math.cos(pose.yaw) * p.z,
    yaw: pose.yaw + p.yaw,
  });
  return {
    rear: transform(ambulanceLocalAnchors.rear),
    rest: transform(ambulanceLocalAnchors.rest),
    seats: ambulanceLocalAnchors.seats.map(transform) as [AIPose, AIPose],
    exits: ambulanceLocalAnchors.exits.map(transform) as [AIPose, AIPose],
  };
}
