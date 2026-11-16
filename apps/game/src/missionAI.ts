/** In-place skeletal clips are selected from actual world-space displacement.
 * This controller owns no scene objects: sleeping sectors can discard it safely. */
import type { Item } from "../../../packages/shared/src/combat";
export type AIPoint = { x: number; z: number };
export type AIPose = AIPoint & { y: number; yaw: number };
export type AIRole = "leader" | "worker" | "civilian" | "crowd";
export type AIState =
  | "speech"
  | "guard"
  | "patrol"
  | "notice"
  | "cover"
  | "flee"
  | "warn"
  | "follow"
  | "dodge"
  | "scatter"
  | "crossing"
  | "shopping"
  | "phone"
  | "yield"
  | "return"
  | "resting";
export type AIAnimation =
  | "Idle"
  | "Walk"
  | "Run"
  | "Speech"
  | "Warn"
  | "Cover"
  | "Phone"
  | "EggReact"
  | "SandalReact"
  | "Defeated"
  | "Resting";
export type AIFacts = {
  player: AIPoint;
  leader?: AIPoint;
  active: boolean;
  fleeing?: boolean;
  completed?: boolean;
  defeated?: boolean;
  tutorialSafe?: boolean;
  paused?: boolean;
  siren?: AIPoint;
  incoming?: AIPoint;
  sound?: AIPoint;
  traffic?: readonly AIPoint[];
  lastHit?: { id: string; item: Item };
};
export type AIAction =
  | { type: "voice"; cue: "notice" | "warn" | "flee" | "siren" | "scatter" }
  | { type: "paper-prop"; from: AIPose; target: AIPoint };
export type AIOptions = {
  id: string;
  role: AIRole;
  pose: AIPose;
  patrol?: readonly AIPoint[];
  covers?: readonly AIPoint[];
  escape?: readonly AIPoint[];
  shop?: AIPoint;
  crossings?: readonly AIPoint[];
  scatter?: AIPoint;
  speedFactor?: number;
  clear(x: number, z: number, radius: number): boolean;
  heightAt(x: number, z: number): number;
  pathTo?(from: AIPoint, to: AIPoint, radius: number): AIPoint[] | undefined;
};
export const aiDistance = (a: AIPoint, b: AIPoint) =>
  Math.hypot(a.x - b.x, a.z - b.z);
const clone = (p: AIPoint): AIPoint => ({ x: p.x, z: p.z });
const turn = (a: number, b: number, maximum: number) =>
  a +
  Math.max(
    -maximum,
    Math.min(maximum, Math.atan2(Math.sin(b - a), Math.cos(b - a))),
  );
export function clearAISegment(
  from: AIPoint,
  to: AIPoint,
  clear: (x: number, z: number) => boolean,
  heightAt?: (x: number, z: number) => number,
) {
  const steps = Math.max(1, Math.ceil(aiDistance(from, to) / 0.08));
  let priorHeight = heightAt?.(from.x, from.z);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      x = from.x + (to.x - from.x) * t,
      z = from.z + (to.z - from.z) * t;
    if (!clear(x, z)) return false;
    if (heightAt) {
      const height = heightAt(x, z);
      // Accepted hub curbs are .32 m. Keep those traversable while rejecting
      // the .46 m speech-dais edge so actors must use its authored ramp.
      if (
        !Number.isFinite(height) ||
        (priorHeight !== undefined && Math.abs(height - priorHeight) > 0.34)
      )
        return false;
      priorHeight = height;
    }
  }
  return true;
}
/** Nearby cooperation uses the exact occupancy predicate, including round
 * people, instead of getting stuck inside a conservative planning AABB corner. */
export function localActorPath(from: AIPoint, to: AIPoint, clear: (x: number, z: number) => boolean, heightAt?: (x: number, z: number) => number) {
  if (aiDistance(from, to) > 6) return;
  if (!clear(from.x, from.z) || !clear(to.x, to.z)) return;
  const segment = (a: AIPoint, b: AIPoint) => clearAISegment(a, b, clear, heightAt);
  if (segment(from, to)) return [{ ...to }];
  const step = 0.35, extent = 20, key = (x: number, z: number) => `${x},${z}`;
  type Cell = { x: number; z: number; g: number; f: number; parent?: Cell };
  const position = (cell: { x: number; z: number }) => ({ x: from.x + cell.x * step, z: from.z + cell.z * step });
  const open: Cell[] = [{ x: 0, z: 0, g: 0, f: aiDistance(from, to) }], costs = new Map([[key(0, 0), 0]]), closed = new Set<string>();
  for (let visited = 0; open.length && visited < 1681; visited++) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const cell = open.splice(best, 1)[0], here = position(cell), cellKey = key(cell.x, cell.z);
    if (closed.has(cellKey)) continue;
    closed.add(cellKey);
    if (aiDistance(here, to) < step * 1.5 && segment(here, to)) {
      const route: AIPoint[] = [{ ...to }];
      let current: Cell | undefined = cell;
      while (current?.parent) { route.unshift(position(current)); current = current.parent; }
      const smooth: AIPoint[] = [];
      let start = from;
      while (route.length) { let next = route.length - 1; while (next > 0 && !segment(start, route[next])) next--; start = route[next]; smooth.push(start); route.splice(0, next + 1); }
      return smooth;
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = cell.x + dx, z = cell.z + dz, nextKey = key(x, z), g = cell.g + Math.hypot(dx, dz) * step;
      if (Math.abs(x) > extent || Math.abs(z) > extent || closed.has(nextKey) || g >= (costs.get(nextKey) ?? Infinity)) continue;
      const next = position({ x, z });
      if (!clear(next.x, next.z) || !segment(here, next)) continue;
      costs.set(nextKey, g); open.push({ x, z, g, f: g + aiDistance(next, to), parent: cell });
    }
  }
}
export class MissionActorAI {
  readonly id: string;
  readonly role: AIRole;
  readonly pose: AIPose;
  readonly home: AIPose;
  state: AIState;
  animation: AIAnimation = "Idle";
  distanceMoved = 0;
  blocked = false;
  private elapsed = 0;
  private stateTime = 0;
  private route: AIPoint[] = [];
  private goal?: AIPoint;
  private pathRetry = 0;
  private patrolIndex = 0;
  private escapeIndex = 0;
  private coverIndex = 0;
  private nextProp = 0;
  private lastHit = "";
  private reaction = 0;
  private reactionItem: Item = "egg";
  private actions: AIAction[] = [];
  private warned = new Set<string>();
  private completedHandled = false;
  private exhaustedWorkerTime = 0;
  private options: AIOptions;
  constructor(options: AIOptions) {
    this.options = options;
    this.id = options.id;
    this.role = options.role;
    this.pose = { ...options.pose };
    this.home = { ...options.pose };
    this.state =
      this.role === "leader"
        ? "speech"
        : this.role === "worker"
          ? "guard"
          : "patrol";
  }
  private setState(state: AIState) {
    if (this.state === state) return;
    this.state = state;
    this.stateTime = 0;
    this.route = [];
    this.goal = undefined;
    this.pathRetry = 0;
  }
  private voice(cue: "notice" | "warn" | "flee" | "siren" | "scatter") {
    if (this.warned.has(cue)) return;
    this.warned.add(cue);
    this.actions.push({ type: "voice", cue });
  }
  private move(to: AIPoint, speed: number, dt: number) {
    const clear = (x: number, z: number) => this.options.clear(x, z, 0.32);
    this.pathRetry -= dt;
    if (
      !this.goal ||
      aiDistance(this.goal, to) > 0.65 ||
      (!this.route.length && this.pathRetry <= 0)
    ) {
      this.goal = clone(to);
      this.route = clearAISegment(this.pose, to, clear, this.options.heightAt)
        ? [clone(to)]
        : (localActorPath(this.pose, to, clear, this.options.heightAt) ?? this.options.pathTo?.(this.pose, to, 0.32) ?? []);
      this.pathRetry = 0.8;
    }
    while (this.route.length && aiDistance(this.pose, this.route[0]) < 0.045)
      this.route.shift();
    const target = this.route[0];
    if (!target) {
      this.blocked = aiDistance(this.pose, to) > 0.15;
      return false;
    }
    const span = aiDistance(this.pose, target),
      travel = Math.min(span, speed * (this.options.speedFactor ?? 1) * dt),
      t = span ? travel / span : 0;
    const next = {
      x: this.pose.x + (target.x - this.pose.x) * t,
      z: this.pose.z + (target.z - this.pose.z) * t,
    };
    if (!clearAISegment(this.pose, next, clear, this.options.heightAt)) {
      this.blocked = true;
      this.route = [];
      return false;
    }
    this.pose.yaw = turn(
      this.pose.yaw,
      Math.atan2(target.x - this.pose.x, target.z - this.pose.z),
      dt * 5,
    );
    this.pose.x = next.x;
    this.pose.z = next.z;
    this.pose.y = this.options.heightAt(next.x, next.z);
    this.distanceMoved += travel;
    this.blocked = false;
    return travel > 0.00001;
  }
  private away(point: AIPoint, amount = 2.4): AIPoint {
    let dx = this.pose.x - point.x,
      dz = this.pose.z - point.z;
    const span = Math.hypot(dx, dz);
    if (span < 0.01) {
      dx = this.id.length % 2 ? 1 : -1;
      dz = 0.6;
    }
    const length = Math.hypot(dx, dz);
    const candidates = [
      0,
      Math.PI / 3,
      -Math.PI / 3,
      Math.PI / 2,
      -Math.PI / 2,
    ].map((angle) => ({
      x:
        this.pose.x +
        ((dx * Math.cos(angle) - dz * Math.sin(angle)) / length) * amount,
      z:
        this.pose.z +
        ((dx * Math.sin(angle) + dz * Math.cos(angle)) / length) * amount,
    }));
    return (
      candidates.find((p) => this.options.clear(p.x, p.z, 0.32)) ??
      clone(this.home)
    );
  }
  tick(
    delta: number,
    facts: AIFacts,
  ): {
    pose: AIPose;
    state: AIState;
    animation: AIAnimation;
    moving: boolean;
    running: boolean;
    actions: AIAction[];
    blocked: boolean;
  } {
    this.actions = [];
    const before = this.distanceMoved,
      dt = Math.max(0, Math.min(0.05, Number.isFinite(delta) ? delta : 0));
    if (facts.paused || dt === 0) return this.result(before);
    this.elapsed += dt;
    this.stateTime += dt;
    this.reaction = Math.max(0, this.reaction - dt);
    if (facts.lastHit && facts.lastHit.id !== this.lastHit) {
      this.lastHit = facts.lastHit.id;
      this.reactionItem = facts.lastHit.item;
      this.reaction = facts.lastHit.item === "egg" ? 0.65 : 0.85;
      this.coverIndex++;
      this.route = [];
    }
    if (
      facts.defeated &&
      (this.role === "leader" || (this.role === "worker" && !facts.completed))
    ) {
      if (this.role === "worker") {
        this.exhaustedWorkerTime += dt;
        // Exhaustion never restores resolve or removes the occupied body. Once
        // the short rest motion finishes, make room for approaching help using
        // the same checked route as a healthy worker, then rest at that spot.
        if (
          !facts.tutorialSafe &&
          facts.siren &&
          aiDistance(this.pose, facts.siren) < 18 &&
          this.exhaustedWorkerTime >= 1.2
        ) {
          this.yieldToSiren(facts.siren, 1.1, dt);
          this.animation =
            this.distanceMoved > before ? "Walk" : "Resting";
          return this.result(before);
        }
      }
      this.setState("resting");
      this.animation = this.stateTime < 1.2 ? "Defeated" : "Resting";
      return this.result(before);
    }
    this.exhaustedWorkerTime = 0;
    // Tutorial overrides dangerous state selection before any prop, following or fleeing.
    if (
      facts.tutorialSafe &&
      (this.role === "leader" || this.role === "worker")
    ) {
      this.setState(this.role === "leader" ? "speech" : "guard");
      this.animation = this.role === "leader" ? "Speech" : "Idle";
      return this.result(before);
    }
    if (!facts.completed) this.completedHandled = false;
    if (
      facts.completed &&
      (this.role === "worker" ||
        this.role === "crowd" ||
        !this.completedHandled)
    ) {
      if (this.role === "worker" || this.role === "crowd") {
        this.setState("scatter");
        this.voice("scatter");
        this.move(this.options.scatter ?? this.home, 2.7, dt);
      } else if (this.role === "civilian") {
        this.setState("return");
        if (aiDistance(this.pose, this.home) > 0.1)
          this.move(this.home, 1.3, dt);
        else {
          this.setState("patrol");
          this.warned.delete("siren");
          this.completedHandled = true;
        }
      }
    } else if (this.role === "leader") this.leader(dt, facts);
    else if (this.role === "worker") this.worker(dt, facts);
    else this.civilian(dt, facts);
    const moving = this.distanceMoved - before > 0.00001;
    if (this.reaction > 0)
      this.animation = this.reactionItem === "egg" ? "EggReact"
        : this.reactionItem === "sound" || this.reactionItem === "spark" ? "Warn"
        : "SandalReact";
    else if (moving)
      this.animation = ["flee", "scatter", "dodge"].includes(this.state)
        ? "Run"
        : "Walk";
    else
      this.animation =
        this.state === "speech"
          ? "Speech"
          : ["notice", "warn"].includes(this.state)
            ? "Warn"
            : this.state === "cover"
              ? "Cover"
              : this.state === "phone"
                ? "Phone"
                : "Idle";
    return this.result(before);
  }
  private leader(dt: number, facts: AIFacts) {
    if (!facts.active) {
      this.setState("speech");
      return;
    }
    if (facts.fleeing) {
      this.setState("flee");
      this.voice("flee");
      const route = this.options.escape ?? [];
      if (route.length) {
        const target = route[this.escapeIndex % route.length];
        this.move(target, this.reaction > 0 ? 1.4 : 2.9, dt);
        if (aiDistance(this.pose, target) < 0.22) this.escapeIndex++;
      }
      if (
        this.elapsed >= this.nextProp &&
        aiDistance(this.pose, facts.player) < 13 &&
        this.reaction === 0
      ) {
        this.actions.push({
          type: "paper-prop",
          from: { ...this.pose },
          target: clone(facts.player),
        });
        this.nextProp = this.elapsed + 7;
      }
      return;
    }
    if (aiDistance(this.pose, facts.player) < 11 || this.lastHit) {
      if (this.state === "speech") {
        this.setState("notice");
        this.voice("notice");
      }
      if (this.state === "notice" && this.stateTime >= 0.9)
        this.setState("cover");
      if (this.state === "cover") {
        const covers = this.options.covers ?? [this.home];
        const target = covers[this.coverIndex % covers.length];
        this.move(target, 1.9, dt);
        if (this.stateTime > 4.2) {
          this.coverIndex++;
          this.setState("notice");
        }
      }
    } else this.setState("speech");
  }
  private yieldToSiren(siren: AIPoint, speed: number, dt: number) {
    if (this.state !== "yield") {
      this.setState("yield");
      this.goal = this.away(siren, 3.4);
      this.voice("siren");
    }
    if (this.goal && aiDistance(this.pose, this.goal) > 0.16)
      this.move(this.goal, speed, dt);
  }
  private worker(dt: number, facts: AIFacts) {
    if (facts.siren && aiDistance(this.pose, facts.siren) < 18) {
      this.yieldToSiren(facts.siren, 1.9, dt);
      return;
    }
    if (this.state === "yield") this.setState("guard");
    if (facts.incoming && aiDistance(this.pose, facts.incoming) < 2.2) {
      this.setState("dodge");
      this.move(this.away(facts.incoming, 1.8), 3, dt);
      return;
    }
    if (this.state === "dodge" && this.stateTime < 0.7) {
      if (this.goal) this.move(this.goal, 3, dt);
      return;
    }
    if (
      facts.active &&
      (aiDistance(this.pose, facts.player) < 12 ||
        (facts.sound && aiDistance(this.pose, facts.sound) < 14))
    ) {
      if (this.state === "guard" || this.state === "dodge") {
        this.setState("warn");
        this.voice("warn");
      }
      if (this.state === "warn" && this.stateTime < 1.1) return;
      this.setState("follow");
      const leader = facts.leader ?? this.home;
      const hash = [...this.id].reduce(
        (sum, char) => sum + char.codePointAt(0)!,
        0,
      );
      const angle = (hash * 2.13) % (Math.PI * 2);
      const target = {
        x: leader.x + Math.sin(angle) * 2.1,
        z: leader.z + Math.cos(angle) * 2.1,
      };
      if (aiDistance(this.pose, target) > 0.65) this.move(target, 1.7, dt);
    } else {
      this.setState("guard");
      if (aiDistance(this.pose, this.home) > 0.15)
        this.move(this.home, 1.4, dt);
    }
  }
  private civilian(dt: number, facts: AIFacts) {
    const disturbance =
      facts.siren && aiDistance(this.pose, facts.siren) < 18
        ? facts.siren
        : facts.active &&
            aiDistance(this.pose, facts.leader ?? facts.player) < 8
          ? (facts.leader ?? facts.player)
          : facts.incoming && aiDistance(this.pose, facts.incoming) < 3
            ? facts.incoming
            : undefined;
    if (disturbance && !facts.tutorialSafe) {
      if (this.state !== "yield" && this.state !== "phone") {
        this.setState("yield");
        this.goal = this.away(disturbance, 3);
      }
      if (facts.siren) this.voice("siren");
      if (this.goal && aiDistance(this.pose, this.goal) > 0.2)
        this.move(this.goal, 1.7, dt);
      else this.setState("phone");
      return;
    }
    if (this.state === "yield" || this.state === "phone") {
      this.setState("return");
    }
    if (this.state === "return") {
      if (aiDistance(this.pose, this.home) > 0.12) {
        this.move(this.home, 1.3, dt);
        return;
      }
      this.setState("patrol");
    }
    if (this.role === "crowd") {
      this.setState(facts.active ? "phone" : "patrol");
      return;
    }
    const patrol = this.options.patrol ?? [this.home];
    const target = patrol[this.patrolIndex % patrol.length];
    if (
      this.options.crossings?.some(
        (crossing) => aiDistance(this.pose, crossing) < 1.2,
      ) &&
      facts.traffic?.some((vehicle) => aiDistance(this.pose, vehicle) < 5)
    ) {
      this.setState("crossing");
      return;
    }
    if (this.options.shop && this.patrolIndex % 3 === 2) {
      if (aiDistance(this.pose, this.options.shop) > 0.12) {
        this.setState("shopping");
        this.move(this.options.shop, 1.15, dt);
        return;
      }
      if (this.state !== "shopping") this.setState("shopping");
      if (this.stateTime < 2.2) return;
      this.patrolIndex++;
    }
    this.setState("patrol");
    this.move(target, 1.25, dt);
    if (aiDistance(this.pose, target) < 0.12) this.patrolIndex++;
  }
  private result(before: number) {
    const moving = this.distanceMoved - before > 0.00001;
    return {
      pose: { ...this.pose },
      state: this.state,
      animation: this.animation,
      moving,
      running: moving && this.animation === "Run",
      actions: this.actions.slice(),
      blocked: this.blocked,
    };
  }
}
