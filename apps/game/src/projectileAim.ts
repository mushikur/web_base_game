type Point3 = { x: number; y: number; z: number };
/** A metre-scale throw uses a short local arc, with a bounded estimate from
 * actual observed actor motion. Havok still decides the real flight/collisions. */
export function movingThrowAim(
  from: Point3,
  target: Point3,
  velocity: Point3 = { x: 0, y: 0, z: 0 },
) {
  const flight = Math.max(
    0.18,
    Math.min(0.75, Math.hypot(target.x - from.x, target.z - from.z) / 14),
  );
  const bound = (n: number) =>
    Number.isFinite(n) ? Math.max(-5, Math.min(5, n)) : 0;
  return {
    flight,
    target: {
      x: target.x + bound(velocity.x) * flight,
      y: target.y,
      z: target.z + bound(velocity.z) * flight,
    },
  };
}
/** Continuous segment/circle distance prevents a fast frame from skipping a
 * body. It observes the real previous/current physics positions. */
export function sweptProjectileDistance(
  from: Point3,
  to: Point3,
  center: Point3,
) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    dz = to.z - from.z;
  const length = dx * dx + dy * dy + dz * dz;
  const t = length
    ? Math.max(
        0,
        Math.min(
          1,
          ((center.x - from.x) * dx +
            (center.y - from.y) * dy +
            (center.z - from.z) * dz) /
            length,
        ),
      )
    : 0;
  return Math.hypot(
    from.x + dx * t - center.x,
    from.y + dy * t - center.y,
    from.z + dz * t - center.z,
  );
}
