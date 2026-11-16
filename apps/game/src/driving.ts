import {
  corridorRect,
  pointInRect,
  roadCorridors,
  worldAreas,
  type Point2,
} from "../../../packages/shared/src/world-layout.ts";
import { rotatedFootprintClear } from "./missionClearance.ts";
import type { NavigationObstacle } from "../../../packages/shared/src/navigation.ts";

export const rideProfiles = {
  cng: {
    label: "সবুজ সিএনজি",
    topSpeed: 10,
    acceleration: 4.1,
    reverse: 2.8,
    turn: 1.65,
    wheelRadius: 0.285,
    pedal: false,
  },
  rickshaw: {
    label: "ফুলেল রিকশা",
    topSpeed: 5.4,
    acceleration: 2.1,
    reverse: 1.1,
    turn: 1.85,
    wheelRadius: 0.4,
    pedal: true,
  },
  auto: {
    label: "ব্যাটারির অটোরিকশা",
    topSpeed: 8,
    acceleration: 3.1,
    reverse: 2.0,
    turn: 1.75,
    wheelRadius: 0.32,
    pedal: false,
  },
  bicycle: {
    label: "সাইকেল",
    topSpeed: 6.7,
    acceleration: 2.8,
    reverse: 0.9,
    turn: 2.15,
    wheelRadius: 0.35,
    pedal: true,
  },
} as const;
export type RideKind = keyof typeof rideProfiles;
export type RidePose = Point2 & { yaw: number; y: number };
type RideInput = {
  throttle: number;
  steering: number;
  brake: boolean;
  wet: boolean;
};
type Footprint = { w: number; d: number };

export function rideGroundAnchor(pose: RidePose, footprint: NavigationObstacle, playerRadius: number): RidePose {
  const margin = playerRadius + 0.07;
  const dx = -Math.sin(pose.yaw), dz = -Math.cos(pose.yaw);
  if (Math.abs(pose.x - footprint.x) >= footprint.w / 2 + margin ||
      Math.abs(pose.z - footprint.z) >= footprint.d / 2 + margin) return pose;
  const reach = (direction: number, offset: number, extent: number) =>
    Math.abs(direction) < 1e-5 ? Infinity :
      (Math.sign(direction) * (extent / 2 + margin) - offset) / direction;
  const distance = Math.min(reach(dx, pose.x - footprint.x, footprint.w),
    reach(dz, pose.z - footprint.z, footprint.d));
  return { ...pose, x: pose.x + dx * distance, z: pose.z + dz * distance };
}

const hubRoad = { minX: -5.26, maxX: 5.26, minZ: -20, maxZ: 28 };
const driveRegions = [
  hubRoad,
  ...roadCorridors.map(corridorRect),
  ...worldAreas.slice(1).map(({ center }) => ({
    minX: center.x - 5.95,
    maxX: center.x + 5.95,
    minZ: center.z - 18,
    maxZ: center.z + 18,
  })),
];
export const onDriveRoad = (x: number, z: number) =>
  driveRegions.some((rect) => pointInRect({ x, z }, rect));
export const checkpoints = worldAreas.map((area) => ({
  id: area.id,
  name: `${area.name} • চেকপয়েন্ট`,
  x: area.id === "promise-junction" ? -6.15 : area.entrance.x - 4.65,
  z: area.id === "promise-junction" ? -13.7 : area.entrance.z - 1.4,
  facing: 0,
}));

const approach = (value: number, target: number, step: number) =>
  value + Math.max(-step, Math.min(step, target - value));
const inputAxis = (value: number) =>
  Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;

export function driveStep(
  pose: RidePose,
  speed: number,
  kind: RideKind,
  footprint: Footprint,
  input: RideInput,
  dt: number,
  obstacles: readonly NavigationObstacle[],
  occupants: readonly Point2[],
  speedFactor = 1,
) {
  if (!Number.isFinite(dt) || dt <= 0)
    return { pose, speed, distance: 0, blocked: false, steering: 0 };
  const profile = rideProfiles[kind];
  const throttle = inputAxis(input.throttle);
  const steering = inputAxis(input.steering);
  const grip = input.wet ? 0.72 : 1;
  const target = input.brake
    ? 0
    : throttle * (throttle < 0 ? profile.reverse : profile.topSpeed) * speedFactor;
  const decelerating = input.brake || throttle * speed < 0;
  const rate = decelerating
    ? 8.8 * grip
    : throttle === 0
      ? 3.3
      : profile.acceleration * grip;
  let nextSpeed = Number.isFinite(speed) ? speed : 0;
  let next = pose;
  let distance = 0;
  // Four bounded increments keep a long frame from crossing a thin obstacle.
  const step = Math.min(dt, 0.05) / 4;
  for (let i = 0; i < 4; i++) {
    nextSpeed = approach(nextSpeed, target, rate * step);
    if (Math.abs(nextSpeed) < 0.001) continue;
    const turnScale = Math.min(1, Math.abs(nextSpeed) / 2.2);
    const yaw =
      next.yaw +
      steering * profile.turn * turnScale * grip * Math.sign(nextSpeed) * step;
    const travelled = nextSpeed * step;
    const middle = (yaw + next.yaw) * 0.5;
    const proposal = {
      ...next,
      yaw,
      x: next.x + Math.sin(middle) * travelled,
      z: next.z + Math.cos(middle) * travelled,
    };
    if (
      !rotatedFootprintClear(
        proposal,
        obstacles,
        onDriveRoad,
        occupants,
        footprint,
        0.34,
      )
    )
      return { pose: next, speed: 0, distance, blocked: true, steering };
    next = proposal;
    distance += travelled;
  }
  return { pose: next, speed: nextSpeed, distance, blocked: false, steering };
}
