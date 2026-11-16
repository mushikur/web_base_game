import { Vector3, type Scene, type ShadowGenerator } from "./engine";
import { catalogArea, type GameCatalog } from "../../../packages/shared/src/catalog";
import {
  areaById,
  worldAreas,
  worldHeightAt,
  distance2,
  type AreaId,
  type Point2,
} from "../../../packages/shared/src/world-layout";
import {
  worldCanWalk,
  pathfindWorld,
  type NavigationObstacle,
} from "../../../packages/shared/src/navigation";
import {
  newMatchMissions,
  reduceMission,
  missionCheckpointKey,
  missionCheckpoint,
  parseMissionCheckpoint,
  nextMissionId,
  type MatchMissionState,
  type MissionEvent,
} from "../../../packages/shared/src/missions";
import { bn, type AudioEvent, type Item, type PickupItem } from "../../../packages/shared/src/index";
import {
  MissionActorAI,
  localActorPath,
  type AIPose,
  type AIRole,
} from "./missionAI";
import { EvacuationController } from "./evacuation";
import {
  createAmbulance,
  attachMissionAccessories,
  type AmbulanceModel,
} from "./ambulance";
import {
  rotatedFootprintClear,
  rotatedVehicleContains,
  ambulanceNavigationObstacles,
} from "./missionClearance";
import { MissionAnimationBank } from "./missionAnimations";
import { attachWorkerBanner } from "./workerBanner";
import type { Actor } from "./game";
import type { MissionMapData } from "./missionMap";
import type { SectorManager } from "./sectors";

type Binding = {
  actor: Actor;
  areaId: AreaId;
  role: AIRole;
  ai: MissionActorAI;
  accessories: ReturnType<typeof attachMissionAccessories>;
  banner?: ReturnType<typeof attachWorkerBanner>;
  released: boolean;
  engaged: boolean;
  lastHit?: { id: string; item: Item };
};
type RetiredAmbulance = {
  id: string;
  areaId: AreaId;
  model: AmbulanceModel;
  leader: Actor;
  leaderPose: AIPose;
  medics: Actor[];
  medicPoses: AIPose[];
  accessories: ReturnType<typeof attachMissionAccessories>[];
  released: boolean;
};
export type MissionVehicleBody = {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  w: number;
  d: number;
  h: number;
};
type EventBody = MissionEvent extends infer E
  ? E extends MissionEvent
    ? Omit<E, "seq" | "missionId">
    : never
  : never;
type Options = {
  catalog?: GameCatalog;
  preview?: boolean;
  scene: Scene;
  shadow: ShadowGenerator;
  sectors: SectorManager;
  actors: Actor[];
  player: () => Actor;
  createActor(
    name: string,
    role: "leader" | "worker" | "civilian",
    position: Vector3,
    color: string,
    areaId?: AreaId,
  ): Actor;
  releaseActor(actor: Actor): void;
  animate(
    actor: Actor,
    dt: number,
    moving: boolean,
    running: boolean,
    speed: number,
  ): void;
  obstacles(): NavigationObstacle[];
  traffic?(): NavigationObstacle[];
  addPickup(kind: PickupItem, position: Vector3): () => void;
  combatCheckpoint?(): object;
  message(text: string): void;
  subtitle(text: string): void;
  sound(
    cue: AudioEvent | "slogan" | "escape",
    point: Point2,
    character?: string,
  ): void;
  paper(from: AIPose, to: Point2): void;
};
export class MissionDirector {
  state: MatchMissionState = newMatchMissions();
  readonly history: {
    at: number;
    missionId: AreaId;
    event: string;
    phase: string;
  }[] = [];
  private bindings = new Map<Actor, Binding>();
  private outerCreated = new Set<AreaId>();
  private animationBank?: MissionAnimationBank;
  private ambulance?: AmbulanceModel;
  private medics: Actor[] = [];
  private medicAccessories: ReturnType<typeof attachMissionAccessories>[] = [];
  private evacuation?: EvacuationController;
  private retired: RetiredAmbulance[] = [];
  private ambulanceId = "";
  private ambulanceSequence = 0;
  private evacuationRetryAt = 0;
  private elapsed = 0;
  private navigationAt = 0;
  private statusAt = 0;
  private sirenAt = 0;
  private route: Point2[] = [];
  private routeDistance = 0;
  private routeMessage = "মানচিত্র থেকে গন্তব্য বেছে নিন।";
  private lastPlayer: Point2 = { x: 0, z: 0 };
  private resetting = false;
  constructor(private options: Options) {}
  private area(id: AreaId) {
    return this.options.catalog ? catalogArea(this.options.catalog, id) : areaById(id);
  }
  async init() {
    this.animationBank = await MissionAnimationBank.load(this.options.scene);
    for (const actor of this.options.actors)
      this.bind(actor, "promise-junction", actor.role);
  }
  private bind(actor: Actor, areaId: AreaId, role: AIRole) {
    const area = this.area(areaId),
      p = actor.root.position;
    if (!actor.groups.some((g) => g.name.endsWith("/Warn"))) {
      const hasSpeech = actor.groups.some((g) => g.name.endsWith("/Speech"));
      actor.groups.push(...this.animationBank!.bind(actor.root, actor.name, hasSpeech ? ["Speech"] : []));
    }
    const dx = role === "civilian" ? 0 : 1.4;
    const patrol = [
      { x: p.x, z: p.z - 1.5 },
      { x: p.x, z: p.z + 1.5 },
      { x: p.x + dx, z: p.z },
    ];
    const ai = new MissionActorAI({
      id: actor.name,
      role,
      speedFactor: this.options.catalog?.behavior[role === "crowd" ? "civilian" : role],
      pose: { x: p.x, y: p.y, z: p.z, yaw: actor.root.rotation.y },
      covers: area.cover,
      escape: area.escapeRoute,
      patrol,
      shop: area.teaShop,
      crossings: [area.entrance],
      scatter: {
        x: area.center.x + (p.x < area.center.x ? -7 : 7),
        z: area.center.z - 11,
      },
      clear: (x, z, radius) => this.actorClear(actor, x, z, radius),
      heightAt: worldHeightAt,
      pathTo: (from, to, radius) => {
        const path = pathfindWorld(
          from,
          to,
          this.actorPathObstacles(actor),
          radius,
        );
        if (path.ok) return path.points;
        const player = this.options.player().root.position;
        const fallback = pathfindWorld(
          from,
          to,
          [
            ...this.walkingObstacles(),
            { x: player.x, z: player.z, w: 0.76, d: 0.76 },
          ],
          radius,
        );
        if (!fallback.ok) return;
        const route = fallback.points.filter((p) => distance2(p, from) > 0.04),
          first = route[0];
        if (!first) return;
        const span = distance2(from, first),
          travel = Math.min(4.5, span),
          t = span ? travel / span : 0;
        const waypoint = {
          x: from.x + (first.x - from.x) * t,
          z: from.z + (first.z - from.z) * t,
        };
        const local = localActorPath(
          from,
          waypoint,
          (x, z) => this.actorClear(actor, x, z, radius),
          worldHeightAt,
        );
        return local
          ? [...local, ...(span > 4.5 ? route : route.slice(1))]
          : undefined;
      },
    });
    const existing = this.bindings.get(actor);
    if (existing && !existing.released) {
      Object.assign(existing, { areaId, role, ai, lastHit: undefined });
      return existing;
    }
    const binding: Binding = {
      actor,
      areaId,
      role,
      ai,
      accessories: attachMissionAccessories(
        this.options.scene,
        actor.root,
        this.options.shadow,
      ),
      released: false,
      engaged: false,
      banner:
        role === "worker" && /পল্টু|কর্মী রবিন/u.test(actor.name)
          ? attachWorkerBanner(
              this.options.scene,
              actor.root,
              this.options.shadow,
              areaId === "microphone-square" ? "মাইক চলবে!" : "নেতা এগিয়ে চলো!",
            )
          : undefined,
    };
    this.bindings.set(actor, binding);
    return binding;
  }
  private dropBinding(binding: Binding, releaseActor: boolean) {
    if (binding.released) return;
    binding.released = true;
    binding.accessories.dispose();
    binding.banner?.dispose();
    if (this.bindings.get(binding.actor) === binding)
      this.bindings.delete(binding.actor);
    if (releaseActor) this.options.releaseActor(binding.actor);
  }
  private bodyObstacles(except = ""): NavigationObstacle[] {
    return this.dynamicVehicles
      .filter((v) => v.id !== except)
      .flatMap((v) => ambulanceNavigationObstacles(v));
  }
  private walkingObstacles(except = ""): NavigationObstacle[] {
    return [
      ...this.options.obstacles(),
      ...(this.options.traffic?.() ?? []),
      ...this.bodyObstacles(except),
    ];
  }
  private actorPathObstacles(actor: Actor, except = ""): NavigationObstacle[] {
    return [
      ...this.walkingObstacles(except),
      ...this.actorOccupants(actor).map((p) => ({
        x: p.x,
        z: p.z,
        w: 0.6,
        d: 0.6,
      })),
      {
        x: this.options.player().root.position.x,
        z: this.options.player().root.position.z,
        w: 0.76,
        d: 0.76,
      },
    ];
  }
  private actorOccupants(except?: Actor): Point2[] {
    const snapshot = this.evacuation?.snapshot;
    const controlled = new Map<Actor, Point2>();
    if (snapshot && worldAreas.some((a) => a.id === snapshot.missionId)) {
      const leader = this.leader(snapshot.missionId as AreaId);
      if (leader) controlled.set(leader, snapshot.leader);
      this.medics.forEach((actor, i) =>
        controlled.set(actor, snapshot.medics[i]),
      );
    }
    return [...new Set([...this.options.actors, ...this.medicActors])]
      .filter((actor) => actor !== except && actor.root.isEnabled())
      .map((actor) => controlled.get(actor) ?? actor.root.position);
  }
  private actorClear(actor: Actor, x: number, z: number, radius: number) {
    if (!worldCanWalk(x, z, this.walkingObstacles(), radius)) return false;
    const player = this.options.player().root.position;
    if (distance2({ x, z }, player) < 0.72) return false;
    if (this.actorOccupants(actor).some((p) => distance2({ x, z }, p) < 0.64))
      return false;
    return true;
  }
  controlsActor(actor: Actor) {
    const b = this.bindings.get(actor);
    if (!b) return false;
    // Preserve B's original full patrol sweep until the hub encounter needs reactions.
    return (
      b.areaId !== "promise-junction" ||
      b.role !== "civilian" ||
      b.engaged ||
      this.state.activeId === "promise-junction"
    );
  }
  get pins(): AreaId[] {
    return this.state.activeId ? [this.state.activeId] : [];
  }
  get sirenActive() {
    return !!this.evacuation?.snapshot.siren;
  }
  get medicActors(): Actor[] {
    return [...this.medics, ...this.retired.flatMap((r) => r.medics)].filter(
      (a) => a.root.isEnabled(),
    );
  }
  get dynamicVehicles(): MissionVehicleBody[] {
    const bodies: MissionVehicleBody[] = this.retired
      .filter((r) => !r.released && r.model.root.isEnabled())
      .map((r) => ({ id: r.id, ...this.bodyPose(r.model) }));
    if (this.ambulance && this.evacuation && this.ambulance.root.isEnabled())
      bodies.push({ id: this.ambulanceId, ...this.bodyPose(this.ambulance) });
    return bodies;
  }
  private bodyPose(model: AmbulanceModel): Omit<MissionVehicleBody, "id"> {
    const p = model.root.position;
    return {
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: model.root.rotation.y,
      w: 2.2,
      d: 5.05,
      h: 2.85,
    };
  }
  private releaseRetired(record: RetiredAmbulance) {
    if (record.released) return;
    record.released = true;
    record.model.dispose();
    for (const accessory of record.accessories) accessory.dispose();
    for (const actor of record.medics) this.options.releaseActor(actor);
    if (record.areaId !== "promise-junction") {
      const binding = this.bindings.get(record.leader);
      if (binding) this.dropBinding(binding, true);
      else this.options.releaseActor(record.leader);
    } else {
      record.leader.root.setEnabled(false);
      for (const group of record.leader.groups) group.stop();
    }
  }
  private updateRetired() {
    // Keep a completed journey physically visible and mapped until its whole
    // vehicle is beyond the actual camera range, then release its owned rigs.
    const coldDistance =
      Math.max(75, this.options.scene.activeCamera?.maxZ ?? 120) + 10;
    const player = this.options.player().root.position;
    for (const record of this.retired) {
      if (distance2(player, record.model.root.position) > coldDistance)
        this.releaseRetired(record);
      else {
        record.leader.root.setEnabled(true);
        this.apply(record.leader, record.leaderPose, "Resting", 0, 0);
        record.medics.forEach((actor, i) => {
          actor.root.setEnabled(true);
          this.apply(actor, record.medicPoses[i], "Seated", 0, 0);
        });
      }
    }
    this.retired = this.retired.filter((r) => !r.released);
  }
  private retireAmbulance(
    id: AreaId,
    leader: Actor,
    snapshot: ReturnType<EvacuationController["tick"]>,
  ) {
    if (!this.ambulance) return;
    this.retired.push({
      id: this.ambulanceId,
      areaId: id,
      model: this.ambulance,
      leader,
      leaderPose: { ...snapshot.leader },
      medics: [...this.medics],
      medicPoses: snapshot.medics.map((p) => ({ ...p })),
      accessories: [...this.medicAccessories],
      released: false,
    });
    this.ambulance = undefined;
    this.ambulanceId = "";
    this.medics = [];
    this.medicAccessories = [];
  }
  get hasSavedRun() {
    if (this.options.preview) return false;
    try {
      return !!localStorage.getItem(missionCheckpointKey);
    } catch {
      return false;
    }
  }
  reset(resume = false) {
    this.resetting = true;
    this.evacuation?.cancel(this.evacuation.snapshot.missionId);
    this.evacuation = undefined;
    this.ambulance?.dispose();
    this.ambulance = undefined;
    this.ambulanceId = "";
    for (const record of this.retired) this.releaseRetired(record);
    this.retired = [];
    for (const accessory of this.medicAccessories) accessory.dispose();
    this.medicAccessories = [];
    for (const actor of this.medics) this.options.releaseActor(actor);
    this.medics = [];
    for (const b of [...this.bindings.values()])
      this.dropBinding(b, b.areaId !== "promise-junction");
    this.bindings.clear();
    this.outerCreated.clear();
    this.state = resume ? this.readCheckpoint() : newMatchMissions();
    // A live encounter needs physical reconstruction; resume it at its safe entry,
    // retaining completed jobs and their observations instead of inventing a loaded ambulance.
    if (this.state.activeId) {
      const id = this.state.activeId,
        old = this.state.missions[id];
      this.state.missions[id] = {
        ...old,
        phase: "selected",
        resolve: 100,
        hitCount: 0,
        fleeRequested: false,
        ambulanceRequested: false,
        leaderLoaded: false,
        outsideSeconds: 0,
        boundsWarning: false,
        failure: "",
      };
      this.state.activeId = null;
      this.state.selectedId = id;
    }
    for (const actor of this.options.actors)
      if (!this.medics.includes(actor))
        this.bind(actor, "promise-junction", actor.role);
    this.route = [];
    this.routeDistance = 0;
    this.navigationAt = 0;
    this.statusAt = 0;
    this.evacuationRetryAt = 0;
    this.elapsed = 0;
    this.history.length = 0;
    this.resetting = false;
    this.save();
    if (!this.state.selectedId) {
      const next = nextMissionId(this.state);
      if (next) this.select(next);
    }
  }
  private readCheckpoint() {
    if (this.options.preview) return newMatchMissions();
    try {
      return parseMissionCheckpoint(localStorage.getItem(missionCheckpointKey));
    } catch {
      return newMatchMissions();
    }
  }
  save() {
    if (this.options.preview) return;
    try {
      const checkpoint = this.options.combatCheckpoint
        ? JSON.stringify({ ...this.state, combat: this.options.combatCheckpoint() })
        : missionCheckpoint(this.state);
      localStorage.setItem(missionCheckpointKey, checkpoint);
    } catch {
      /* Device storage may be unavailable. */
    }
  }
  private dispatch(id: AreaId, event: EventBody) {
    const reduction = reduceMission(this.state, {
      ...event,
      missionId: id,
      seq: this.state.sequence + 1,
    } as MissionEvent);
    if (!reduction.accepted) return false;
    this.state = reduction.state;
    if (event.type !== "player-status" && event.type !== "approach") {
      this.history.push({
        at: this.elapsed,
        missionId: id,
        event: event.type,
        phase: this.state.missions[id].phase,
      });
      if (this.history.length > 100) this.history.shift();
      this.save();
    }
    for (const effect of reduction.effects) {
      if (effect.type !== "score" && effect.type !== "discovered")
        this.options.message(effect.type === "started" ? this.area(id).objective : effect.message);
      if (effect.type === "started") {
        const leader = this.leader(id);
        if (leader) leader.health = 100;
        this.options.subtitle(
          `${this.area(id).leaderName}: ভাইসব, প্রতিশ্রুতি শুনে যান!`,
        );
        this.options.sound("slogan", areaById(id).center);
      }
      if (effect.type === "completed") {
        this.options.sound("complete", areaById(id).center);
        const next = nextMissionId(this.state);
        if (
          next &&
          !["failed", "restartable"].includes(this.state.missions[next].phase)
        )
          this.select(next);
        else if (next)
          this.options.message(
            `${this.area(next).name}তে আবার চেষ্টা করার সুযোগ আছে। মানচিত্রে দেখুন।`,
          );
      }
    }
    return true;
  }
  select(id: AreaId) {
    const route = pathfindWorld(
      this.options.player().root.position,
      areaById(id).entrance,
      this.walkingObstacles(),
    );
    const result = reduceMission(this.state, {
      type: "select",
      missionId: id,
      seq: this.state.sequence + 1,
      routeReady: route.ok,
    });
    if (!result.accepted) {
      this.options.message(result.error);
      return false;
    }
    this.state = result.state;
    this.route = route.points;
    this.routeDistance = route.distance;
    this.routeMessage = route.message;
    this.save();
    this.options.message(`${this.area(id).name} • ${route.message}`);
    return true;
  }
  private leader(id: AreaId) {
    return [...this.bindings.values()].find(
      (b) => b.areaId === id && b.role === "leader",
    )?.actor;
  }
  canImpact(actor: Actor, tutorialSafe: boolean) {
    if (tutorialSafe || actor.role === "civilian") return true;
    const binding = this.bindings.get(actor);
    return (
      !!binding &&
      binding.areaId === this.state.activeId &&
      ["active", "leader-fleeing"].includes(
        this.state.missions[binding.areaId].phase,
      )
    );
  }
  impact(
    actor: Actor,
    projectileId: string,
    item: Item,
    tutorialSafe: boolean,
  ) {
    const b = this.bindings.get(actor);
    if (!b) return;
    b.lastHit = { id: projectileId, item };
    this.dispatch(b.areaId, {
      type: "impact",
      projectileId,
      item,
      target: actor.role,
      observed: true,
      tutorialSafe,
    });
    if (
      actor.role === "leader" &&
      !tutorialSafe &&
      this.state.activeId === b.areaId
    )
      actor.health = this.state.missions[b.areaId].resolve;
  }
  private createOuter(id: AreaId) {
    if (this.outerCreated.has(id)) return;
    const area = this.area(id),
      ownedBindings: Binding[] = [];
    const create = (
      name: string,
      role: "leader" | "worker" | "civilian",
      p: Point2,
      color: string,
      aiRole: AIRole = role,
    ) => {
      const actor = this.options.createActor(
        name,
        role,
        new Vector3(p.x, worldHeightAt(p.x, p.z), p.z),
        color,
        id,
      );
      this.options.actors.push(actor);
      ownedBindings.push(this.bind(actor, id, aiRole));
      return actor;
    };
    const leader = create(area.leaderName, "leader", area.leader, "#c4baa0");
    if (this.state.missions[id].phase === "completed") {
      leader.health = 0;
      leader.root.setEnabled(false);
    }
    area.workers.forEach((p, i) =>
      create(
        `${area.name}র কর্মী ${["রবিন", "শওকত", "জসিম"][i]}`,
        "worker",
        p,
        ["#47776d", "#755047", "#66754b"][i],
      ),
    );
    area.crowd.forEach((p, i) =>
      create(
        `${area.name}র দর্শক ${bn(i + 1)}`,
        "civilian",
        p,
        ["#bca272", "#839d9b", "#b67967", "#7f8762"][i % 4],
        "crowd",
      ),
    );
    area.civilians.forEach((p, i) =>
      create(
        `${area.name}র পথচারী ${["শিউলি", "সালাম", "কবির"][i]}`,
        "civilian",
        p,
        ["#a37364", "#8aab9c", "#c2ab7b"][i],
      ),
    );
    const supplies = [...area.pickups] as { kind: PickupItem; position: Point2 }[];
    const obstacles = this.walkingObstacles();
    for (const [index, kind] of (["baton", "sound", "spark"] as const).entries()) {
      const point = [-3.4, 3.4, -2.6, 2.6, 0].map((dx) => ({
        x: area.entrance.x + dx,
        z: area.entrance.z - 1.8 + index * 1.9,
      })).find((p) => worldCanWalk(p.x, p.z, obstacles, 0.55)
        && supplies.every((item) => distance2(item.position, p) > 1.4));
      if (point) supplies.push({ kind, position: point });
    }
    const cleanup = supplies.map((p) =>
      this.options.addPickup(
        p.kind,
        new Vector3(p.position.x, worldHeightAt(p.position.x, p.position.z) + 0.15, p.position.z),
      ),
    );
    this.outerCreated.add(id);
    const handle = this.options.sectors.handles.find((h) => h.id === id);
    handle?.own(() => {
      // Capture these exact ownership records. A stale handle from an earlier
      // run cannot look up and dispose a replacement binding's accessories.
      for (const binding of ownedBindings)
        this.dropBinding(
          binding,
          !this.retired.some((r) => !r.released && r.leader === binding.actor),
        );
      for (const f of cleanup) f();
      this.outerCreated.delete(id);
    });
  }
  private pose(actor: Actor): AIPose {
    const p = actor.root.position;
    return { x: p.x, y: p.y, z: p.z, yaw: actor.root.rotation.y };
  }
  private apply(
    actor: Actor,
    p: AIPose,
    animation: string,
    dt: number,
    animationTime?: number,
  ) {
    const before = actor.root.position.clone();
    actor.root.position.set(p.x, p.y, p.z);
    actor.velocity
      .copyFrom(actor.root.position.subtract(before))
      .scaleInPlace(dt > 0 ? 1 / dt : 0);
    actor.root.rotation.set(0, p.yaw, 0);
    actor.missionMotion = animation;
    actor.missionMotionTime = animationTime;
    const speed =
      Vector3.Distance(before, actor.root.position) / Math.max(0.001, dt);
    this.options.animate(actor, dt, speed > 0.02, animation === "Run", speed);
  }
  private beginEvacuation(id: AreaId) {
    const leader = this.leader(id);
    if (!leader) return;
    if (!this.ambulance) {
      this.ambulance = createAmbulance(this.options.scene, this.options.shadow);
      this.ambulanceId = `${id}:ambulance:${++this.ambulanceSequence}`;
    }
    this.ambulance.root.setEnabled(false);
    if (!this.medics.length)
      for (let i = 0; i < 2; i++) {
        const a = this.options.createActor(
          i ? "সহায়তাকারী রুবেল" : "সহায়তাকারী রিনা",
          "civilian",
          Vector3.Zero(),
          i ? "#84a8a0" : "#d7ded0",
        );
        a.groups.push(...this.animationBank!.bind(a.root, a.name));
        this.medicAccessories.push(
          attachMissionAccessories(
            this.options.scene,
            a.root,
            this.options.shadow,
            true,
          ),
        );
        this.medics.push(a);
      }
    for (const m of this.medics) m.root.setEnabled(false);
    this.evacuation = new EvacuationController({
      heightAt: worldHeightAt,
      anchors: (p) => this.ambulance!.anchors(p),
      canVehicleStand: (x, z, yaw) => {
        const e = this.evacuation?.snapshot;
        const occupants = [
          this.options.player().root.position,
          ...this.options.actors
            .filter(
              (a) => a.root.isEnabled() && !(a === leader && e?.leaderAttached),
            )
            .map((a) => (a === leader && e ? e.leader : a.root.position)),
          ...this.medics
            .filter((a, i) => a.root.isEnabled() && !e?.medicsAttached[i])
            .map((a) => e?.medics[this.medics.indexOf(a)] ?? a.root.position),
        ];
        return rotatedFootprintClear(
          { x, y: 0, z, yaw },
          this.walkingObstacles(this.ambulanceId),
          (px, pz) => worldCanWalk(px, pz, [], 0.02),
          occupants,
        );
      },
      canActorStand: (x, z, who, interior = false) => {
        if (
          !worldCanWalk(
            x,
            z,
            this.walkingObstacles(interior ? this.ambulanceId : ""),
            0.32,
          ) ||
          distance2({ x, z }, this.options.player().root.position) < 0.7
        )
          return false;
        const e = this.evacuation?.snapshot;
        if (
          e &&
          !interior &&
          rotatedVehicleContains({ x, z }, e.ambulance, 0.32)
        )
          return false;
        const self =
          who === "leader" ? leader : this.medics[who === "medic-0" ? 0 : 1];
        return this.actorOccupants(self).every(
          (p) => distance2({ x, z }, p) > 0.62,
        );
      },
      pathTo: (from, to, who, interior = false) => {
        const actor =
          who === "leader" ? leader : this.medics[who === "medic-0" ? 0 : 1];
        const p = pathfindWorld(
          from,
          to,
          this.actorPathObstacles(actor, interior ? this.ambulanceId : ""),
        );
        return p.ok ? p.points : undefined;
      },
      staticPathTo: (from, to, _who, interior = false) => {
        const player = this.options.player().root.position;
        const p = pathfindWorld(from, to, [
          ...this.walkingObstacles(interior ? this.ambulanceId : ""),
          { x: player.x, z: player.z, w: 0.76, d: 0.76 },
        ]);
        return p.ok ? p.points : undefined;
      },
      onStage: (stage, snapshot) => {
        this.options.message(snapshot.message);
        this.history.push({
          at: this.elapsed,
          missionId: id,
          event: `ambulance:${stage}`,
          phase: this.state.missions[id].phase,
        });
      },
    });
    if (
      !this.evacuation.request(
        { missionId: id, ...areaById(id).ambulance },
        this.pose(leader),
      )
    ) {
      this.evacuation = undefined;
      this.evacuationRetryAt = this.elapsed + 1;
      this.options.message(
        "সহায়তার গাড়ির প্রবেশপথ খালি করুন। আবার পথ দেখা হচ্ছে।",
      );
    } else {
      const e = this.evacuation.snapshot;
      this.ambulance.root.setEnabled(true);
      this.ambulance.update(
        e.ambulance,
        e.wheelTravel,
        e.doorOpen,
        this.elapsed,
        e.siren,
      );
      this.medics.forEach((actor, i) => {
        actor.root.setEnabled(true);
        this.apply(
          actor,
          e.medics[i],
          e.medicAnimations[i],
          0,
          e.medicAnimationTimes[i],
        );
      });
    }
  }
  retry(id: AreaId) {
    if (this.state.missions[id].phase !== "restartable") return false;
    const clear = this.retryReady(id);
    if (!clear) {
      this.options.message("প্রবেশপথে বাধা আছে। পথ খালি হলে আবার চেষ্টা করুন।");
      return false;
    }
    if (!this.dispatch(id, { type: "retry", routeReady: true })) return false;
    for (const b of this.bindings.values())
      if (b.areaId === id) {
        b.actor.health = 100;
        b.actor.root.position.copyFrom(b.actor.base);
        b.actor.root.rotation.z = 0;
        b.lastHit = undefined;
        this.bind(b.actor, id, b.role);
      }
    this.evacuation?.resetRequest(id);
    this.route = [];
    this.navigationAt = 0;
    return true;
  }
  private retryReady(id: AreaId) {
    const area = areaById(id),
      obstacles = this.options.obstacles(),
      player = this.options.player().root.position;
    const bindings = [...this.bindings.values()].filter((b) => b.areaId === id);
    if (
      !bindings.some((b) => b.role === "leader") ||
      !worldCanWalk(area.entrance.x, area.entrance.z, obstacles, 0.42)
    )
      return false;
    return bindings.every(
      (b) =>
        worldCanWalk(b.actor.base.x, b.actor.base.z, obstacles, 0.32) &&
        distance2(b.actor.base, player) > 0.85 &&
        [...this.bindings.values()].every(
          (other) =>
            other.areaId === id ||
            !other.actor.root.isEnabled() ||
            distance2(b.actor.base, other.actor.root.position) > 0.7,
        ),
    );
  }
  tick(
    dt: number,
    facts: {
      tutorialSafe: boolean;
      paused: boolean;
      playerResolve: number;
      incoming?: Point2;
    },
  ) {
    if (facts.paused || this.resetting) return;
    this.elapsed += dt;
    this.updateRetired();
    this.navigationAt -= dt;
    this.statusAt += dt;
    const p = this.options.player().root.position,
      delta = distance2(p, this.lastPlayer);
    this.lastPlayer = { x: p.x, z: p.z };
    for (const area of worldAreas) {
      if (
        this.state.missions[area.id].phase === "undiscovered" &&
        distance2(p, area.center) < 35
      )
        this.dispatch(area.id, { type: "discover" });
      const handle = this.options.sectors.handles.find((h) => h.id === area.id);
      if (area.id !== "promise-junction" && handle?.active)
        this.createOuter(area.id);
    }
    const selected = this.state.selectedId;
    if (selected) {
      const m = this.state.missions[selected],
        area = this.area(selected);
      if (["selected", "approaching"].includes(m.phase)) {
        if (delta > 0.001)
          this.dispatch(selected, {
            type: "approach",
            moved: true,
            nearRoute: this.route.some((v) => distance2(v, p) < 30),
          });
        const ready =
          selected === "promise-junction" || this.outerCreated.has(selected);
        if (distance2(p, area.entrance) < 4)
          this.dispatch(selected, {
            type: "enter",
            position: p,
            sectorReady: ready,
            tutorialSafe: facts.tutorialSafe,
          });
      }
      if (this.navigationAt <= 0) {
        this.navigationAt = 1.2;
        const route = pathfindWorld(p, area.entrance, this.walkingObstacles());
        this.route = route.points;
        this.routeDistance = route.distance;
        this.routeMessage = route.message;
      }
    }
    const active = this.state.activeId;
    if (active && this.statusAt >= 0.4) {
      this.dispatch(active, {
        type: "player-status",
        position: p,
        resolve: facts.playerResolve,
        elapsedSeconds: Math.min(1, this.statusAt),
        tutorialSafe: facts.tutorialSafe,
      });
      this.statusAt = 0;
    }
    for (const b of this.bindings.values()) {
      if (active === b.areaId) b.engaged = true;
      if (!this.controlsActor(b.actor)) continue;
      if (this.retired.some((record) => record.leader === b.actor)) continue;
      const sector = this.options.sectors.handles.find(
        (handle) => handle.id === b.areaId,
      );
      if (b.areaId !== "promise-junction" && !sector?.active) {
        b.actor.root.setEnabled(false);
        b.accessories.phone.setEnabled(false);
        b.banner?.setEnabled(false);
        for (const group of b.actor.groups) group.stop();
        continue;
      }
      const m = this.state.missions[b.areaId],
        near = distance2(p, b.actor.root.position) < 43 || active === b.areaId;
      const done = m.phase === "completed";
      if (b.role === "leader" && done) {
        b.actor.root.setEnabled(false);
        for (const g of b.actor.groups) g.stop();
        continue;
      }
      b.actor.root.setEnabled(near);
      b.banner?.setEnabled(
        near && !done && m.phase !== "evacuation" && b.actor.health > 0,
      );
      if (!near) {
        for (const g of b.actor.groups) g.stop();
        continue;
      }
      if (
        this.evacuation?.snapshot.missionId === b.areaId &&
        b.role === "leader" &&
        m.phase === "evacuation"
      )
        continue;
      const leader = this.leader(b.areaId);
      const result = b.ai.tick(dt, {
        player: p,
        leader: leader?.root.position,
        active:
          active === b.areaId &&
          ["active", "leader-fleeing", "evacuation"].includes(m.phase),
        fleeing: m.fleeRequested,
        completed: done,
        defeated: b.actor.health <= 0,
        tutorialSafe: facts.tutorialSafe,
        siren: this.evacuation?.snapshot.siren
          ? this.evacuation.snapshot.ambulance
          : undefined,
        incoming: facts.incoming,
        traffic: this.options.traffic?.(),
        lastHit: b.lastHit,
      });
      b.accessories.phone.setEnabled(result.state === "phone");
      this.apply(b.actor, result.pose, result.animation, dt);
      for (const action of result.actions) {
        if (action.type === "paper-prop")
          this.options.paper(action.from, action.target);
        else {
          const line =
            action.cue === "notice"
              ? "নেতা: ওহে, কর্মীরা! একটু জায়গা করো!"
              : action.cue === "warn"
                ? "কর্মী: ভাই, দূরত্ব রাখেন!"
                : action.cue === "flee"
                  ? "নেতা: পরের প্রতিশ্রুতি পরের মোড়ে!"
                  : action.cue === "siren"
                    ? "পথচারী: সহায়তার গাড়ি আসছে, সরে দাঁড়ান!"
                    : "কর্মী: সভা শেষ, চায়ের দোকানে চলেন!";
          this.options.subtitle(line);
          this.options.sound(
            action.cue === "flee" ? "escape" : "slogan",
            result.pose,
            b.actor.name,
          );
        }
      }
      if (b.role === "leader" && m.phase === "active" && m.fleeRequested)
        this.dispatch(b.areaId, { type: "leader-fled", position: result.pose });
    }
    if (active) {
      const m = this.state.missions[active];
      if (
        m.phase === "evacuation" &&
        !this.evacuation &&
        !facts.tutorialSafe &&
        this.elapsed >= this.evacuationRetryAt
      )
        this.beginEvacuation(active);
      if (m.phase === "failed") {
        this.evacuation?.cancel(active);
        this.evacuation = undefined;
        this.ambulance?.root.setEnabled(false);
        for (const medic of this.medics) medic.root.setEnabled(false);
        this.dispatch(active, {
          type: "failure-cleaned",
          safeEntrance: worldCanWalk(
            areaById(active).entrance.x,
            areaById(active).entrance.z,
            this.options.obstacles(),
            0.42,
          ),
          actorsReady: this.retryReady(active),
        });
      }
    }
    if (this.evacuation && !facts.tutorialSafe) {
      const e = this.evacuation.tick(dt),
        id = e.missionId as AreaId,
        leader = this.leader(id);
      this.ambulance!.update(
        e.ambulance,
        e.wheelTravel,
        e.doorOpen,
        this.elapsed,
        e.siren,
      );
      if (leader)
        this.apply(
          leader,
          e.leader,
          e.leaderAnimation,
          dt,
          e.leaderAnimationTime,
        );
      e.medics.forEach((pose, i) =>
        this.apply(
          this.medics[i],
          pose,
          e.medicAnimations[i],
          dt,
          e.medicAnimationTimes[i],
        ),
      );
      if (e.siren && this.elapsed > this.sirenAt) {
        this.options.sound("siren", e.ambulance);
        this.sirenAt = this.elapsed + 2.5;
      }
      if (e.blocked) this.options.message(e.message);
      if (e.leaderAttached && e.medicsAttached.every(Boolean))
        this.dispatch(id, {
          type: "ambulance-loaded",
          leaderLoaded: true,
          personnelSafe: true,
        });
      if (e.completed) {
        const accepted = this.dispatch(id, {
          type: "ambulance-exited",
          position: e.ambulance,
          doorsClosed: e.doorOpen === 0,
        });
        if (accepted && leader) {
          this.retireAmbulance(id, leader, e);
          this.evacuation = undefined;
        }
      }
    }
  }
  mapData(
    extra: Pick<MissionMapData, "pickups" | "vehicles" | "safeStarts" | "checkpoint">,
  ): MissionMapData & { ambulances: Point2[] } {
    const ambulances = this.dynamicVehicles.map(({ x, z }) => ({ x, z }));
    return {
      selectedId: this.state.selectedId,
      activeId: this.state.activeId,
      phases: Object.fromEntries(
        worldAreas.map((a) => [a.id, this.state.missions[a.id].phase]),
      ) as MissionMapData["phases"],
      completed: this.state.completed.length,
      route: this.route,
      routeDistance: this.routeDistance,
      routeMessage: this.routeMessage,
      ambulance: this.evacuation?.snapshot.ambulance ?? ambulances[0] ?? null,
      ambulances,
      friends: [],
      ...extra,
    };
  }
  diagnostics() {
    return {
      state: this.state,
      history: this.history,
      ai: [...this.bindings.values()].map((b) => ({
        name: b.actor.name,
        area: b.areaId,
        state: b.ai.state,
        distanceMoved: b.ai.distanceMoved,
        blocked: b.ai.blocked,
        enabled: b.actor.root.isEnabled(),
      })),
      evacuation: this.evacuation?.snapshot ?? null,
      resources: {
        bindings: this.bindings.size,
        outerAreas: [...this.outerCreated],
        medics: this.medics.length,
        retiredAmbulances: this.retired.length,
      },
    };
  }
  dispose() {
    this.evacuation?.cancel(this.evacuation.snapshot.missionId);
    for (const record of this.retired) this.releaseRetired(record);
    this.retired = [];
    for (const accessory of this.medicAccessories) accessory.dispose();
    this.medicAccessories = [];
    for (const medic of this.medics) this.options.releaseActor(medic);
    this.medics = [];
    for (const binding of [...this.bindings.values()])
      this.dropBinding(binding, binding.areaId !== "promise-junction");
    this.ambulance?.dispose();
    this.animationBank?.dispose();
  }
}
