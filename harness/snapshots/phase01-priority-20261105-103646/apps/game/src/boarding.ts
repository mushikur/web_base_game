/** Parked-vehicle boarding is world-space motion, so the on-foot controller keeps
 * its existing position semantics. Every seated tick reads the real seat anchor. */
export type BoardingPose = { x: number; y: number; z: number; yaw: number };
export type BoardingVehicle = {
  id: string;
  name: string;
  footprint: { x: number; z: number; w: number; d: number };
  occupied: boolean;
  approachPose(): BoardingPose;
  entryPose(): BoardingPose;
  seatPose(): BoardingPose;
  exitPoses(): BoardingPose[];
  entryPath(): BoardingPose[];
  exitPaths(): BoardingPose[][];
};
export type BoardingState =
  "onFoot" | "approach" | "entering" | "seated" | "exiting";
export const boardingDurations = {
  EnterVehicle: 1.4,
  Seated: 2.6,
  ExitVehicle: 1.25,
};
type Point = { x: number; z: number };
type Player = {
  position: { x: number; y: number; z: number };
  rotation: { y: number };
};
type Options = {
  /** Ignoring a vehicle omits only that vehicle's collision proxy, never walls,
   * water, pedestrians, traffic or other players. */
  canStand(x: number, z: number, ignoredVehicleId?: string): boolean;
  heightAt(x: number, z: number): number;
  message(text: string): void;
  onEvent?(
    event: "interact" | "entered" | "exited",
    vehicle: BoardingVehicle,
  ): void;
};
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const turn = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const turnTowards = (a: number, b: number, maximum: number) => {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + Math.max(-maximum, Math.min(maximum, delta));
};

/** Sample the whole movement segment, including footprint clearance delegated to
 * the shared world predicate. A valid endpoint alone cannot cross a thin wall. */
export function clearBoardingSegment(
  from: Point,
  to: Point,
  clear: (x: number, z: number) => boolean,
) {
  const steps = Math.max(1, Math.ceil(distance(from, to) / 0.08));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!clear(mix(from.x, to.x, t), mix(from.z, to.z, t))) return false;
  }
  return true;
}

/** Finite local A*: a blocked straight approach walks around real obstacles.
 * There is no teleport or unvalidated fallback when the route is unavailable. */
export function boardingApproachPath(
  from: Point,
  to: Point,
  clear: (x: number, z: number) => boolean,
): Point[] | undefined {
  if (!clear(from.x, from.z) || !clear(to.x, to.z)) return;
  if (clearBoardingSegment(from, to, clear)) return [to];
  const step = 0.4,
    extent = 24,
    key = (x: number, z: number) => `${x},${z}`,
    position = (x: number, z: number) => ({
      x: from.x + x * step,
      z: from.z + z * step,
    });
  type Cell = { x: number; z: number; g: number; f: number; parent?: Cell };
  const first: Cell = { x: 0, z: 0, g: 0, f: distance(from, to) },
    open = [first],
    costs = new Map([[key(0, 0), 0]]),
    closed = new Set<string>();
  for (let visited = 0; open.length && visited < 2401; visited++) {
    let best = 0;
    for (let i = 1; i < open.length; i++)
      if (open[i].f < open[best].f) best = i;
    const cell = open.splice(best, 1)[0],
      here = position(cell.x, cell.z),
      cellKey = key(cell.x, cell.z);
    if (closed.has(cellKey)) continue;
    closed.add(cellKey);
    if (
      distance(here, to) < step * 1.5 &&
      clearBoardingSegment(here, to, clear)
    ) {
      const route: Point[] = [to];
      let current: Cell | undefined = cell;
      while (current?.parent) {
        route.unshift(position(current.x, current.z));
        current = current.parent;
      }
      // Collapse unnecessary grid corners while preserving every collision test.
      const smooth: Point[] = [];
      let start = from;
      while (route.length) {
        let next = route.length - 1;
        while (next > 0 && !clearBoardingSegment(start, route[next], clear))
          next--;
        start = route[next];
        smooth.push(start);
        route.splice(0, next + 1);
      }
      return smooth;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const x = cell.x + dx,
        z = cell.z + dz,
        nextKey = key(x, z);
      if (Math.abs(x) > extent || Math.abs(z) > extent || closed.has(nextKey))
        continue;
      const next = position(x, z),
        g = cell.g + Math.hypot(dx, dz) * step;
      if (
        g >= (costs.get(nextKey) ?? Infinity) ||
        !clearBoardingSegment(here, next, clear)
      )
        continue;
      costs.set(nextKey, g);
      open.push({ x, z, g, f: g + distance(next, to), parent: cell });
    }
  }
}

function poseAlong(path: BoardingPose[], progress: number): BoardingPose {
  const scaled = Math.min(1, Math.max(0, progress)) * (path.length - 1),
    index = Math.min(path.length - 2, Math.floor(scaled)),
    t = scaled - index,
    a = path[index],
    b = path[index + 1];
  return {
    x: mix(a.x, b.x, t),
    y: mix(a.y, b.y, t),
    z: mix(a.z, b.z, t),
    yaw: turn(a.yaw, b.yaw, t),
  };
}

export class BoardingController {
  private readonly player: Player;
  private readonly vehicles: readonly BoardingVehicle[];
  private readonly options: Options;
  state: BoardingState = "onFoot";
  animationTime = 0;
  activeVehicle?: BoardingVehicle;
  private route: Point[] = [];
  private approachMoving = false;
  private exitRoute = 0;
  private blockedMessage = false;
  constructor(
    player: Player,
    vehicles: readonly BoardingVehicle[],
    options: Options,
  ) {
    this.player = player;
    this.vehicles = vehicles;
    this.options = options;
  }
  get locked() {
    return this.state !== "onFoot";
  }
  get motion():
    "Idle" | "Walk" | "EnterVehicle" | "Seated" | "ExitVehicle" | undefined {
    return this.state === "approach"
      ? this.approachMoving
        ? "Walk"
        : "Idle"
      : this.state === "entering"
        ? "EnterVehicle"
        : this.state === "seated"
          ? "Seated"
          : this.state === "exiting"
            ? "ExitVehicle"
            : undefined;
  }
  get nearVehicle() {
    if (this.state !== "onFoot") return this.activeVehicle;
    return this.vehicles
      .filter(
        (v) =>
          !v.occupied && distance(this.player.position, v.approachPose()) < 2.5,
      )
      .sort(
        (a, b) =>
          distance(this.player.position, a.approachPose()) -
          distance(this.player.position, b.approachPose()),
      )[0];
  }
  get cameraFocus() {
    const vehicle = this.activeVehicle;
    if (!vehicle || this.state === "approach") return;
    const seat = vehicle.seatPose();
    return {
      position: { x: seat.x, y: seat.y + 0.92, z: seat.z },
      ignoredVehicleId: vehicle.id,
    };
  }
  private place(pose: BoardingPose) {
    Object.assign(this.player.position, { x: pose.x, y: pose.y, z: pose.z });
    this.player.rotation.y = pose.yaw;
  }
  private exitPaths(vehicle: BoardingVehicle) {
    return vehicle
      .exitPaths()
      .map((path) =>
        path.map((pose, index) =>
          index === path.length - 1
            ? { ...pose, y: this.options.heightAt(pose.x, pose.z) }
            : pose,
        ),
      );
  }
  private entryPath(vehicle: BoardingVehicle) {
    return vehicle
      .entryPath()
      .map((pose, index) =>
        index === 0
          ? { ...pose, y: this.options.heightAt(pose.x, pose.z) }
          : pose,
      );
  }
  private validPath(path: BoardingPose[], vehicle: BoardingVehicle) {
    return (
      path.length >= 2 &&
      path
        .slice(1)
        .every((p, i) =>
          clearBoardingSegment(path[i], p, (x, z) =>
            this.options.canStand(x, z, vehicle.id),
          ),
        )
    );
  }
  private transition(state: BoardingState) {
    this.state = state;
    this.animationTime = 0;
    this.blockedMessage = false;
  }
  toggle() {
    if (this.state === "seated" && this.activeVehicle) {
      const vehicle = this.activeVehicle;
      this.exitRoute = this.exitPaths(vehicle).findIndex((path) => {
        const end = path.at(-1);
        return (
          end &&
          this.options.canStand(end.x, end.z) &&
          this.validPath(path, vehicle)
        );
      });
      if (this.exitRoute < 0) {
        this.options.message(
          "নামার জায়গা আটকে আছে। সিটে থাকুন, একটু পরে আবার চেষ্টা করুন।",
        );
        return false;
      }
      this.transition("exiting");
      this.options.message("ধীরে নিরাপদ জায়গায় নামছেন…");
      return true;
    }
    if (this.locked) return false;
    const vehicle = this.nearVehicle;
    if (!vehicle) return false;
    const route = boardingApproachPath(
      this.player.position,
      vehicle.approachPose(),
      (x, z) => this.options.canStand(x, z),
    );
    if (!route || !this.validPath(this.entryPath(vehicle), vehicle)) {
      this.options.message(
        "সিএনজির দরজার পথ আটকে আছে। খালি হলে আবার চেষ্টা করুন।",
      );
      return false;
    }
    this.activeVehicle = vehicle;
    vehicle.occupied = true;
    this.route = route;
    this.approachMoving = false;
    this.transition("approach");
    this.options.onEvent?.("interact", vehicle);
    this.options.message("খোলা দরজার দিকে হাঁটছেন…");
    return true;
  }
  tick(dt: number) {
    const vehicle = this.activeVehicle;
    if (!vehicle || !this.locked || !Number.isFinite(dt) || dt <= 0) return;
    if (this.state === "seated") {
      this.animationTime = (this.animationTime + dt) % boardingDurations.Seated;
      this.place(vehicle.seatPose());
      return;
    }
    if (this.state === "approach") {
      // Finish facing the open doorway at rest, using Idle rather than a
      // stationary walk. Limit turns at both route corners and final arrival.
      const doorway = vehicle.approachPose();
      this.approachMoving = false;
      if (!this.route.length) {
        if (
          !this.options.canStand(
            this.player.position.x,
            this.player.position.z,
          ) ||
          !this.validPath(this.entryPath(vehicle), vehicle)
        ) {
          this.options.message(
            "সিএনজির দরজা আটকে গেছে। নিরাপদ জায়গায় অপেক্ষা করুন।",
          );
          this.reset();
          return;
        }
        this.player.rotation.y = turnTowards(
          this.player.rotation.y,
          doorway.yaw,
          3.5 * dt,
        );
        const remaining = Math.atan2(
          Math.sin(doorway.yaw - this.player.rotation.y),
          Math.cos(doorway.yaw - this.player.rotation.y),
        );
        if (Math.abs(remaining) < 0.00001) {
          this.transition("entering");
          this.options.message("মাথা নিচু করে সিটে উঠছেন…");
        }
        return;
      }
      const goal = this.route[0],
        p = this.player.position,
        gap = distance(p, goal),
        amount = Math.min(1, (2.1 * dt) / Math.max(0.00001, gap)),
        next = { x: mix(p.x, goal.x, amount), z: mix(p.z, goal.z, amount) };
      if (
        !clearBoardingSegment(p, next, (x, z) => this.options.canStand(x, z))
      ) {
        this.options.message(
          "দরজার পথে বাধা এসেছে। নিরাপদ জায়গায় থেমেছেন; আবার চেষ্টা করুন।",
        );
        this.reset();
        return;
      }
      const travelled = distance(p, next),
        heading =
          gap > 0.00001
            ? Math.atan2(goal.x - p.x, goal.z - p.z)
            : this.player.rotation.y,
        // Turn toward the doorway over the final half metre; collision checks
        // still follow the original safe route independently of facing.
        facing =
          this.route.length === 1
            ? turn(heading, doorway.yaw, Math.max(0, 1 - gap / 0.5))
            : heading;
      this.place({
        ...next,
        y: this.options.heightAt(next.x, next.z),
        yaw: turnTowards(this.player.rotation.y, facing, 3.5 * dt),
      });
      this.approachMoving = travelled > 0.00001;
      this.animationTime += dt;
      if (amount === 1) this.route.shift();
      return;
    }
    const entering = this.state === "entering",
      duration = entering
        ? boardingDurations.EnterVehicle
        : boardingDurations.ExitVehicle,
      elapsed = Math.min(duration, this.animationTime + dt),
      path = entering
        ? this.entryPath(vehicle)
        : this.exitPaths(vehicle)[this.exitRoute],
      next = poseAlong(path, elapsed / duration);
    if (
      !clearBoardingSegment(this.player.position, next, (x, z) =>
        this.options.canStand(x, z, vehicle.id),
      )
    ) {
      if (!this.blockedMessage)
        this.options.message(
          "দরজায় বাধা এসেছে। নিরাপদ ভঙ্গিতে অপেক্ষা করছেন; পথ খালি হলে চলবেন।",
        );
      this.blockedMessage = true;
      return;
    }
    this.blockedMessage = false;
    this.place(next);
    this.animationTime = elapsed;
    if (elapsed < duration) return;
    if (entering) {
      this.place(vehicle.seatPose());
      this.transition("seated");
      this.options.onEvent?.("entered", vehicle);
      this.options.message("সিএনজিতে বসেছেন। এবার নিরাপদে নামতে পারেন।");
    } else {
      this.player.position.y = this.options.heightAt(next.x, next.z);
      this.options.onEvent?.("exited", vehicle);
      this.reset();
      this.options.message("নিরাপদে নেমেছেন। আবার হাঁটতে পারেন।");
    }
  }
  /** New-game reset releases occupancy. It never invents a replacement position. */
  reset() {
    if (this.activeVehicle) this.activeVehicle.occupied = false;
    this.activeVehicle = undefined;
    this.route = [];
    this.approachMoving = false;
    this.transition("onFoot");
  }
}
