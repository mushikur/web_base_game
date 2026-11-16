import { combatItems, isItem, type Item, type PickupItem } from "../../../packages/shared/src/combat.ts";
import {
  emptyInventory, freshPickups, networkStep, onlinePickups, onlineSpawns, onlineTargets,
  parseStreetInput, stepStreet, streetDistance, streetHeight, streetLine,
  type Pose, type StreetInput, type StreetPlayer, type StreetProjectile, type StreetSnapshot,
} from "../../../packages/shared/src/online.ts";

type Stats = { distance: number; hits: number; nextAction: number; nextPickup: number; lastInput?: StreetInput };
type Shot = StreetProjectile & { owner: string; vx: number; vy: number; vz: number; age: number };
const pickupIds = Object.keys(onlinePickups) as PickupItem[];
const clearStats = (): Stats => ({ distance: 0, hits: 0, nextAction: 0, nextPickup: 0 });
export class StreetMatch {
  readonly state: StreetSnapshot;
  private stats = new Map<string, Stats>();
  private respawn = new Map<PickupItem, number>();
  private shots = new Map<string, Shot>();
  private time = 0;
  private started = 0;
  private lastHit = -10;
  private shotId = 0;
  constructor(code: string) {
    this.state = { code, host: "", phase: "lobby", friendly: false, players: {}, targets: {},
      pickups: freshPickups(), projectiles: {}, score: 0, combo: 0, bestCombo: 0, round: 0 };
  }
  add(id: string, name: string, look: number, scarf: boolean) {
    const { x, z } = onlineSpawns[look];
    this.state.players[id] = {
      x, z, y: streetHeight(x, z), yaw: 0, name, look, scarf, connected: true,
      moving: false, running: false, action: "", actionId: 0, ack: 0,
      score: 0, health: 100, inventory: emptyInventory(),
    };
    this.stats.set(id, clearStats());
    this.state.host ||= id;
  }
  remove(id: string) {
    delete this.state.players[id];
    this.stats.delete(id);
    for (const [key, shot] of this.shots) if (shot.owner === id) this.removeShot(key);
    if (id === this.state.host) this.state.host =
      Object.keys(this.state.players).find((key) => this.state.players[key].connected) ?? Object.keys(this.state.players)[0] ?? "";
  }
  connect(id: string, connected: boolean) {
    const player = this.state.players[id], stats = this.stats.get(id);
    if (!player || !stats) return;
    player.connected = connected;
    player.moving = false;
    stats.lastInput = undefined;
  }
  start(id: string) {
    if (id !== this.state.host || this.state.phase === "playing" ||
        Object.values(this.state.players).filter((p) => p.connected).length < 2) return false;
    this.state.phase = "playing";
    this.state.round++;
    this.state.score = this.state.combo = this.state.bestCombo = 0;
    this.lastHit = this.time - 10;
    this.started = this.time;
    this.state.pickups = freshPickups();
    this.state.projectiles = {};
    this.shots.clear();
    this.respawn.clear();
    for (const [key, player] of Object.entries(this.state.players)) {
      const { x, z } = onlineSpawns[player.look];
      Object.assign(player, { x, z, y: streetHeight(x, z), yaw: 0, moving: false, running: false,
        health: 100, score: 0, inventory: emptyInventory(), action: "" });
      this.stats.set(key, clearStats());
    }
    this.state.targets = Object.fromEntries(onlineTargets.map((t) => [t.id, {
      x: t.x, y: streetHeight(t.x, t.z), z: t.z, yaw: Math.PI, health: 100, moving: false,
    }]));
    return true;
  }
  input(id: string, value: unknown) {
    const input = parseStreetInput(value), player = this.state.players[id], stats = this.stats.get(id);
    if (!input || !player?.connected || !stats || this.state.phase !== "playing" ||
        input.seq <= (stats.lastInput?.seq ?? player.ack) || input.seq > player.ack + 120) return;
    // Even a burst of accepted packets buys at most one fixed movement step.
    stats.lastInput = input;
  }
  private action(player: StreetPlayer, motion: string) {
    player.action = motion;
    player.actionId++;
  }
  pickup(id: string) {
    const player = this.state.players[id], stats = this.stats.get(id);
    if (!player?.connected || !stats || this.state.phase !== "playing" || this.time < stats.nextPickup) return;
    stats.nextPickup = this.time + 0.28;
    const item = pickupIds.filter((kind) => this.state.pickups[kind] && player.inventory[kind] < 30)
      .sort((a, b) => streetDistance(player, onlinePickups[a]) - streetDistance(player, onlinePickups[b]))[0];
    if (!item || streetDistance(player, onlinePickups[item]) > 2.15 || !streetLine(player, onlinePickups[item])) return;
    this.state.pickups[item] = false;
    player.inventory[item] = Math.min(30, player.inventory[item] + combatItems[item].quantity);
    this.respawn.set(item, this.time + 8);
    this.action(player, "Pickup");
    return item;
  }
  use(id: string, item: unknown) {
    const p = this.state.players[id], stats = this.stats.get(id);
    if (!p?.connected || !stats || !isItem(item) || this.state.phase !== "playing" || this.time < stats.nextAction ||
        (item !== "hand" && p.inventory[item] <= 0)) return false;
    const spec = combatItems[item];
    stats.nextAction = this.time + spec.cooldown;
    if (item !== "hand") p.inventory[item]--;
    this.action(p, spec.motion);
    const aim = this.closestTarget(id, p, spec.range, spec.aim);
    if (item === "egg" || item === "sandal") {
      const from = { x: p.x + Math.sin(p.yaw) * 0.38, y: p.y + 1.38, z: p.z + Math.cos(p.yaw) * 0.38 };
      const to = aim?.point ?? { x: from.x + Math.sin(p.yaw) * 8, y: p.y + 1.3, z: from.z + Math.cos(p.yaw) * 8 };
      const t = Math.max(0.32, Math.min(0.82, streetDistance(from, to) / 15));
      const key = String(++this.shotId);
      this.shots.set(key, { ...from, item, owner: id, vx: (to.x - from.x) / t,
        vy: (to.y + 0.93 - from.y) / t + 4.905 * t, vz: (to.z - from.z) / t, age: 0 });
      this.state.projectiles[key] = { ...from, item };
    } else if (aim) {
      if (aim.friend) this.friendlyHit(aim.key);
      else this.hit(id, aim.key, item);
    }
    return true;
  }
  private closestTarget(id: string, pose: Pose, range: number, cone: number) {
    return [
      ...Object.entries(this.state.targets).map(([key, point]) => ({ key, point, friend: false })),
      ...(this.state.friendly ? Object.entries(this.state.players).filter(([key, p]) => key !== id && p.connected)
        .map(([key, point]) => ({ key, point, friend: true })) : []),
    ].filter(({ point }) => {
      const distance = streetDistance(pose, point);
      if (point.health <= 0 || distance < 0.03 || distance > range || !streetLine(pose, point)) return false;
      return ((point.x - pose.x) * Math.sin(pose.yaw) + (point.z - pose.z) * Math.cos(pose.yaw)) / distance >= cone;
    }).sort((a, b) => streetDistance(pose, a.point) - streetDistance(pose, b.point))[0];
  }
  private friendlyHit(id: string) {
    const player = this.state.players[id];
    if (!this.state.friendly || !player?.connected) return;
    player.health = Math.max(0, player.health - 12);
    if (!player.health) {
      const { x, z } = onlineSpawns[player.look];
      Object.assign(player, { x, z, y: streetHeight(x, z), health: 100 });
    }
    this.action(player, "Hit");
  }
  private hit(id: string, key: string, item: Item) {
    const p = this.state.players[id], target = this.state.targets[key], stats = this.stats.get(id);
    if (!p?.connected || !target || target.health <= 0 || !stats || this.state.phase !== "playing") return;
    target.health = Math.max(0, target.health - combatItems[item].resolve);
    const score = combatItems[item].score;
    p.score += score;
    stats.hits++;
    this.state.score += score;
    this.state.combo = this.time - this.lastHit <= 3 ? this.state.combo + 1 : 1;
    this.state.bestCombo = Math.max(this.state.combo, this.state.bestCombo);
    this.lastHit = this.time;
    if (key === "leader" && !target.health) this.state.phase = "won";
  }
  private removeShot(key: string) {
    this.shots.delete(key);
    delete this.state.projectiles[key];
  }
  private tickShots() {
    for (const [key, shot] of this.shots) {
      const previous = { x: shot.x, y: shot.y, z: shot.z };
      shot.age += networkStep;
      shot.x += shot.vx * networkStep;
      shot.z += shot.vz * networkStep;
      shot.y += shot.vy * networkStep - 4.905 * networkStep ** 2;
      shot.vy -= 9.81 * networkStep;
      if (shot.age > 2 || !streetLine(previous, shot) || shot.y < streetHeight(shot.x, shot.z)) {
        this.removeShot(key);
        continue;
      }
      const targets = [
        ...Object.entries(this.state.targets).map(([id, point]) => ({ id, point, friend: false })),
        ...(this.state.friendly ? Object.entries(this.state.players).filter(([id, p]) => id !== shot.owner && p.connected)
          .map(([id, point]) => ({ id, point, friend: true })) : []),
      ];
      const dx = shot.x - previous.x, dz = shot.z - previous.z;
      const norm = dx * dx + dz * dz;
      const impact = targets.filter(({ point }) => point.health > 0).map(({ id, point, friend }) => {
        const t = norm ? Math.max(0, Math.min(1, ((point.x - previous.x) * dx + (point.z - previous.z) * dz) / norm)) : 0;
        const at = { x: previous.x + dx * t, z: previous.z + dz * t, y: previous.y + (shot.y - previous.y) * t };
        return { id, friend, t, hit: streetDistance(point, at) < 0.48 && at.y > point.y + 0.25 && at.y < point.y + 1.8 };
      }).filter((target) => target.hit).sort((a, b) => a.t - b.t)[0];
      if (impact) {
        if (impact.friend) this.friendlyHit(impact.id);
        else this.hit(shot.owner, impact.id, shot.item);
        this.removeShot(key);
      } else this.state.projectiles[key] = { x: shot.x, y: shot.y, z: shot.z, item: shot.item };
    }
  }
  tick() {
    this.time += networkStep;
    if (this.state.phase !== "playing") return;
    for (const [id, p] of Object.entries(this.state.players)) {
      const stats = this.stats.get(id)!;
      const input = stats.lastInput;
      stats.lastInput = undefined;
      p.moving = false;
      if (!p.connected || !input) continue;
      const next = stepStreet(p, input), distance = streetDistance(p, next);
      stats.distance += distance;
      Object.assign(p, next, { moving: distance > 0.001, running: input.run, ack: input.seq });
    }
    for (const [item, due] of this.respawn)
      if (this.time >= due) { this.state.pickups[item] = true; this.respawn.delete(item); }
    for (const [id, target] of Object.entries(this.state.targets)) {
      target.moving = false;
      if (id !== "leader" || target.health <= 0 || target.health > 75 || target.z >= 13.6) continue;
      const nextZ = target.z + networkStep * 0.72;
      target.z = nextZ;
      target.y = streetHeight(target.x, nextZ);
      target.yaw = 0;
      target.moving = true;
    }
    this.tickShots();
    if (this.state.phase !== "playing") {
      this.shots.clear();
      this.state.projectiles = {};
    }
    if (this.time - this.lastHit > 3) this.state.combo = 0;
  }
  qualified() {
    if (this.state.phase !== "won" || this.time - this.started < 8) return [];
    return [...this.stats].filter(([id, stats]) => this.state.players[id]?.connected && stats.distance >= 2 && stats.hits >= 1)
      .map(([id]) => id);
  }
}
