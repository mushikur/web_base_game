import { segmentClear } from "./navigation.ts";
import { worldHeightAt } from "./world-layout.ts";
import type { Item, PickupItem } from "./combat.ts";

export const roomType = "dhaka-street";
export const networkStep = 0.05;
export const reconnectSeconds = 65;
export const invitePattern = /^[A-HJ-NP-Z2-9]{6}$/;
export const onlineLooks = [
  { name: "নীল জামা", color: "#4b657f" },
  { name: "সবুজ জামা", color: "#42735b" },
  { name: "ইটরঙা জামা", color: "#935749" },
  { name: "সরষে জামা", color: "#937641" },
  { name: "বেগুনি জামা", color: "#685478" },
  { name: "ধূসর জামা", color: "#5f6466" },
] as const;
export const onlineSpawns = [
  { x: -2.4, z: -9 }, { x: 0, z: -9 }, { x: 2.4, z: -9 },
  { x: -2.4, z: -11 }, { x: 0, z: -11 }, { x: 2.4, z: -11 },
] as const;
export const onlinePickups = {
  egg: { x: -1.4, z: -5.7 }, sandal: { x: 1.25, z: -3.4 },
  baton: { x: -2.6, z: 1.1 }, sound: { x: 2, z: -0.45 }, spark: { x: -1.1, z: 2.8 },
} satisfies Record<PickupItem, { x: number; z: number }>;
export const onlineTargets = [
  { id: "leader", x: 1.8, z: 10.6, leader: true },
  { id: "worker-0", x: -1.8, z: 7.8, leader: false },
  { id: "worker-1", x: 3.3, z: 7.4, leader: false },
  { id: "worker-2", x: 0.1, z: 6.6, leader: false },
] as const;
const streetObstacles = [
  { x: -6.7, z: 0.2, w: 1.25, d: 6 },
  { x: 4, z: 2, w: 1.6, d: 2.9 },
  { x: -4.1, z: -3.7, w: 1.88, d: 3.04 },
  { x: -4, z: -14.1, w: 1.57, d: 2.79 },
  { x: 3.8, z: -9.55, w: 0.75, d: 2.18 },
  { x: 3.1, z: 21.5, w: 2.6, d: 8.3 },
  { x: -0.2, z: 18.5, w: 0.7, d: 10 },
  { x: -7.2, z: -13.5, w: 0.45, d: 0.45 },
  { x: 7.2, z: 11.7, w: 0.45, d: 0.45 },
];

export type Pose = { x: number; y: number; z: number; yaw: number };
export type StreetInput = { seq: number; x: number; z: number; yaw: number; run: boolean };
export type StreetPlayer = Pose & {
  name: string; look: number; scarf: boolean; connected: boolean; moving: boolean;
  running: boolean; action: string; actionId: number; ack: number; score: number;
  health: number; inventory: Record<PickupItem, number>;
};
export type StreetTarget = Pose & { health: number; moving: boolean };
export type StreetProjectile = { x: number; y: number; z: number; item: "egg" | "sandal" };
export type StreetSnapshot = {
  code: string; host: string; phase: "lobby" | "playing" | "won"; friendly: boolean;
  players: Record<string, StreetPlayer>; targets: Record<string, StreetTarget>;
  pickups: Record<PickupItem, boolean>; projectiles: Record<string, StreetProjectile>;
  score: number; combo: number; bestCombo: number; round: number;
};
export type OnlineProfile = { token: string; code: string; scarf: boolean; pending: boolean };
export type StreetAction = { kind: "pickup" } | { kind: "use"; item: Item };

export const emptyInventory = (): Record<PickupItem, number> => ({ egg: 0, sandal: 0, baton: 0, sound: 0, spark: 0 });
export const freshPickups = (): Record<PickupItem, boolean> => ({ egg: true, sandal: true, baton: true, sound: true, spark: true });
export const streetDistance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
export const streetYaw = (yaw: number) => Math.atan2(Math.sin(yaw), Math.cos(yaw));
export const streetHeight = (x: number, z: number) => worldHeightAt(x, z);
export function parseStreetInput(value: unknown): StreetInput | undefined {
  if (!value || typeof value !== "object") return;
  const { seq, x, z, yaw, run } = value as StreetInput;
  if (!Number.isSafeInteger(seq) || seq < 1 || seq > 2_000_000_000 ||
      ![x, z, yaw].every(Number.isFinite) || Math.abs(x) > 1 || Math.abs(z) > 1 ||
      Math.abs(yaw) > Math.PI + 0.001 || typeof run !== "boolean") return;
  return { seq, x, z, yaw, run };
}
const insideStreet = ({ x, z }: { x: number; z: number }) =>
  x >= -7.6 && x <= 7.6 && z >= -17 && z <= 23;
export function stepStreet(pose: Pose, input: StreetInput): Pose {
  const speed = (input.run ? 4.5 : 2.25) * networkStep;
  const scale = Math.max(1, Math.hypot(input.x, input.z));
  const c = Math.cos(input.yaw), s = Math.sin(input.yaw);
  const dx = (input.x * c + input.z * s) * speed / scale;
  const dz = (input.z * c - input.x * s) * speed / scale;
  const cross = { x: pose.x + dx, z: pose.z };
  const x = insideStreet(cross) && segmentClear(pose, cross, streetObstacles) ? cross.x : pose.x;
  const forward = { x, z: pose.z + dz };
  const z = insideStreet(forward) && segmentClear({ x, z: pose.z }, forward, streetObstacles) ? forward.z : pose.z;
  return { x, z, y: streetHeight(x, z), yaw: Math.hypot(dx, dz) > 0.002 ? Math.atan2(dx, dz) : input.yaw };
}
export function streetLine(a: { x: number; z: number }, b: { x: number; z: number }) {
  if (!insideStreet(a) || !insideStreet(b)) return false;
  const steps = Math.max(1, Math.ceil(streetDistance(a, b) / 0.08));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    if (streetObstacles.some((obstacle) =>
      Math.abs(x - obstacle.x) <= obstacle.w / 2 && Math.abs(z - obstacle.z) <= obstacle.d / 2)) return false;
  }
  return true;
}

export function onlineName(value: unknown) {
  if (typeof value !== "string") return;
  const name = value.trim().replace(/ +/g, " ").normalize("NFC");
  if (name.length < 2 || name.length > 28 ||
      !/\p{Script=Bengali}/u.test(name) || !/^[\p{Script=Bengali} .’-]+$/u.test(name.replace(/\u200c|\u200d/gu, ""))) return;
  return name;
}
