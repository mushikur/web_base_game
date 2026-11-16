export * from "./quality.ts";
export * from "./audio.ts";
export * from "./street-surfaces.ts";
export * from "./tutorial.ts";
export * from "./spawns.ts";
export * from "./combat.ts";
export * from "./catalog.ts";
export const bn = (value: number) =>
  new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 0 }).format(value);
export function launchVelocity(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  flight = 0.65,
) {
  return {
    x: (to.x - from.x) / flight,
    y: (to.y - from.y + 4.905 * flight * flight) / flight,
    z: (to.z - from.z) / flight,
  };
}
export const playerCollisionRadius = 0.32;
export function canWalk(
  x: number,
  z: number,
  obstacles: readonly { x: number; z: number; w: number; d: number }[],
  radius = playerCollisionRadius,
) {
  return (
    Math.abs(x) < 21.4 &&
    z > -18.8 &&
    z < 22.5 &&
    !obstacles.some(
      (o) =>
        Math.abs(x - o.x) < o.w / 2 + radius &&
        Math.abs(z - o.z) < o.d / 2 + radius,
    )
  );
}
