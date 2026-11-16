export type TrafficPoint = { x: number; z: number };
export type TrafficPose = TrafficPoint & { yaw: number };
export type TrafficLoop = {
  id: string;
  axis: "x" | "z";
  start: number;
  end: number;
  center: number;
  radius: number;
  initial: number;
  speed: number;
};
export const trafficLoops: readonly TrafficLoop[] = [
  {
    id: "east-cross-cng",
    axis: "x",
    start: 8,
    end: 56,
    center: 34,
    radius: 2,
    initial: 14,
    speed: 3.6,
  },
  {
    id: "office-road-cng",
    axis: "z",
    start: 44,
    end: 68,
    center: 66,
    radius: 2,
    initial: 35,
    speed: 3.2,
  },
];
export const trafficLoopLength = (loop: TrafficLoop) =>
  2 * (loop.end - loop.start) + 2 * Math.PI * loop.radius;

/** Two parallel lanes are joined by tangent semicircles. The terminal sample
 * equals the initial sample, including heading; a loop never resets its pose. */
export function sampleTrafficLoop(
  loop: TrafficLoop,
  distance: number,
): TrafficPose {
  const straight = loop.end - loop.start,
    arc = Math.PI * loop.radius;
  const total = trafficLoopLength(loop);
  let d = ((distance % total) + total) % total;
  let along: number, side: number, da: number, ds: number;
  if (d <= straight) {
    along = loop.start + d;
    side = -loop.radius;
    da = 1;
    ds = 0;
  } else if ((d -= straight) <= arc) {
    const angle = -Math.PI / 2 + d / loop.radius;
    along = loop.end + Math.cos(angle) * loop.radius;
    side = Math.sin(angle) * loop.radius;
    da = -Math.sin(angle);
    ds = Math.cos(angle);
  } else if ((d -= arc) <= straight) {
    along = loop.end - d;
    side = loop.radius;
    da = -1;
    ds = 0;
  } else {
    d -= straight;
    const angle = Math.PI / 2 + d / loop.radius;
    along = loop.start + Math.cos(angle) * loop.radius;
    side = Math.sin(angle) * loop.radius;
    da = -Math.sin(angle);
    ds = Math.cos(angle);
  }
  if (loop.axis === "x")
    return { x: along, z: loop.center + side, yaw: Math.atan2(da, ds) };
  return { x: loop.center - side, z: along, yaw: Math.atan2(-ds, da) };
}
export type TrafficOccupant = TrafficPoint & { id?: string; radius?: number };
export function trafficBlocked(
  pose: TrafficPose,
  occupants: readonly TrafficOccupant[],
  speed: number,
) {
  const sin = Math.sin(pose.yaw),
    cos = Math.cos(pose.yaw);
  return occupants.some((actor) => {
    const dx = actor.x - pose.x,
      dz = actor.z - pose.z,
      r = actor.radius ?? 0.35;
    const lateral = dx * cos - dz * sin,
      forward = dx * sin + dz * cos;
    return (
      Math.abs(lateral) < 0.8 + r + 0.2 &&
      forward > -1.5 - r &&
      forward < 1.65 + r + Math.max(0, speed) * 0.65
    );
  });
}
export class TrafficDriver {
  readonly loop: TrafficLoop;
  distance: number;
  moved = 0;
  speed = 0;
  reason = "";
  constructor(loop: TrafficLoop) {
    this.loop = loop;
    this.distance = loop.initial;
  }
  get pose() {
    return sampleTrafficLoop(this.loop, this.distance);
  }
  tick(
    dt: number,
    occupants: readonly TrafficOccupant[],
    siren: boolean,
    tutorialSafe: boolean,
    paused: boolean,
  ) {
    if (!Number.isFinite(dt) || dt <= 0 || paused) {
      this.speed = 0;
      return;
    }
    const step = Math.min(dt, 0.05);
    this.reason = tutorialSafe
      ? "শেখার সময় গাড়ি অপেক্ষায়"
      : siren
        ? "অ্যাম্বুলেন্সকে পথ দেওয়া হচ্ছে"
        : trafficBlocked(this.pose, occupants, this.speed)
          ? "পথচারীকে আগে যেতে দেওয়া হচ্ছে"
          : "";
    if (this.reason) {
      this.speed = 0;
      return;
    }
    const nextSpeed = Math.min(this.loop.speed, this.speed + step * 1.5);
    const distance = nextSpeed * step;
    const next = sampleTrafficLoop(this.loop, this.distance + distance);
    if (trafficBlocked(next, occupants, nextSpeed)) {
      this.reason = "সামনের পথ খোলার অপেক্ষা";
      this.speed = 0;
      return;
    }
    this.speed = nextSpeed;
    this.distance += distance;
    this.moved += distance;
  }
}
