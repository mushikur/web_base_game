import {
  aiDistance,
  clearAISegment,
  localActorPath,
  type AIPoint,
  type AIPose,
} from "./missionAI.ts";

export type EvacuationStage =
  | "idle"
  | "approach"
  | "exit-medics"
  | "assist"
  | "load"
  | "return-medics"
  | "close-doors"
  | "depart"
  | "completed"
  | "cancelled";
export type EvacuationDefinition = {
  missionId: string;
  approach: readonly AIPoint[];
  bay: AIPoint;
  exitRoute: readonly AIPoint[];
  exit: AIPoint;
  /** Finite authored alternatives; never generated teleports. */
  alternateApproaches?: readonly (readonly AIPoint[])[];
  alternateExits?: readonly (readonly AIPoint[])[];
};
export type EvacuationSnapshot = {
  missionId: string;
  stage: EvacuationStage;
  ambulance: AIPose;
  medics: [AIPose, AIPose];
  medicAnimations: [string, string];
  medicAnimationTimes: [number, number];
  leader: AIPose;
  leaderAnimation: string;
  leaderAnimationTime: number;
  leaderAttached: boolean;
  medicsAttached: [boolean, boolean];
  doorOpen: number;
  siren: boolean;
  blocked: boolean;
  message: string;
  vehicleTravel: number;
  wheelTravel: number;
  completed: boolean;
  stageTime: number;
};
export type EvacuationOptions = {
  canVehicleStand(x: number, z: number, yaw: number): boolean;
  canActorStand(
    x: number,
    z: number,
    actor: "leader" | "medic-0" | "medic-1",
    interior?: boolean,
  ): boolean;
  heightAt(x: number, z: number): number;
  pathTo?(
    from: AIPoint,
    to: AIPoint,
    actor: "leader" | "medic-0" | "medic-1",
    interior?: boolean,
  ): AIPoint[] | undefined;
  /** Static/vehicle route scaffold only. Every resulting move is still tested
   * against actual live occupancy by canActorStand; no collision is ignored. */
  staticPathTo?(
    from: AIPoint,
    to: AIPoint,
    actor: "leader" | "medic-0" | "medic-1",
    interior?: boolean,
  ): AIPoint[] | undefined;
  /** The supplied model's anchors, expressed in world space for this vehicle pose. */
  anchors(pose: AIPose): {
    rear: AIPose;
    rest: AIPose;
    seats: [AIPose, AIPose];
    exits: [AIPose, AIPose];
  };
  onStage?(stage: EvacuationStage, snapshot: EvacuationSnapshot): void;
  onCompleted?(missionId: string): void;
};
const copy = (pose: AIPose): AIPose => ({ ...pose });
const yawTo = (a: AIPoint, b: AIPoint, fallback = 0) =>
  aiDistance(a, b) < 0.0001 ? fallback : Math.atan2(b.x - a.x, b.z - a.z);
const limitedTurn = (a: number, b: number, dt: number) =>
  a +
  Math.max(
    -3 * dt,
    Math.min(3 * dt, Math.atan2(Math.sin(b - a), Math.cos(b - a))),
  );
/** Advances only after observed pose/anchor contact. Delays here are finite
 * skeletal assistance/door clips; they never complete an obstructed journey. */
export class EvacuationController {
  private options: EvacuationOptions;
  private definition?: EvacuationDefinition;
  private requests = new Set<string>();
  private elapsed = 0;
  private blockedFor = 0;
  private route: AIPoint[] = [];
  private alternate = 0;
  private actorPaths = new Map<
    string,
    { goal: AIPoint; points: AIPoint[]; retry: number }
  >();
  private assistingAt?: [AIPoint, AIPoint];
  private loadPhase: "to-rear" | "to-rest" = "to-rear";
  private data: EvacuationSnapshot = {
    missionId: "",
    stage: "idle",
    ambulance: { x: 0, y: 0, z: 0, yaw: 0 },
    medics: [
      { x: 0, y: 0, z: 0, yaw: 0 },
      { x: 0, y: 0, z: 0, yaw: 0 },
    ],
    medicAnimations: ["Idle", "Idle"],
    medicAnimationTimes: [0, 0],
    leader: { x: 0, y: 0, z: 0, yaw: 0 },
    leaderAnimation: "Resting",
    leaderAnimationTime: 0,
    leaderAttached: false,
    medicsAttached: [true, true],
    doorOpen: 0,
    siren: false,
    blocked: false,
    message: "",
    vehicleTravel: 0,
    wheelTravel: 0,
    completed: false,
    stageTime: 0,
  };
  constructor(options: EvacuationOptions) {
    this.options = options;
  }
  get state() {
    return this.data.stage;
  }
  get snapshot(): EvacuationSnapshot {
    return {
      ...this.data,
      stageTime: this.elapsed,
      ambulance: copy(this.data.ambulance),
      medics: this.data.medics.map(copy) as [AIPose, AIPose],
      medicAnimations: [...this.data.medicAnimations],
      medicAnimationTimes: [...this.data.medicAnimationTimes],
      leader: copy(this.data.leader),
      medicsAttached: [...this.data.medicsAttached],
    };
  }
  request(definition: EvacuationDefinition, leader: AIPose) {
    if (
      this.requests.has(definition.missionId) ||
      !["idle", "completed", "cancelled"].includes(this.state) ||
      definition.approach.length < 2 ||
      definition.exitRoute.length < 2
    )
      return false;
    const first = definition.approach[0],
      next = definition.approach[1];
    const vehicle = {
      ...first,
      y: this.options.heightAt(first.x, first.z),
      yaw: yawTo(first, next),
    };
    if (!this.options.canVehicleStand(vehicle.x, vehicle.z, vehicle.yaw))
      return false;
    this.requests.add(definition.missionId);
    this.definition = definition;
    this.data = {
      ...this.data,
      missionId: definition.missionId,
      stage: "idle",
      ambulance: vehicle,
      leader: copy(leader),
      leaderAnimation: "Defeated",
      leaderAnimationTime: 0,
      leaderAttached: false,
      medicsAttached: [true, true],
      medicAnimations: ["Seated", "Seated"],
      medicAnimationTimes: [0, 0],
      doorOpen: 0,
      siren: true,
      blocked: false,
      message: "স্বস্তি সেবার গাড়ি আসছে—পথটা খোলা রাখুন।",
      vehicleTravel: 0,
      wheelTravel: 0,
      completed: false,
    };
    this.route = definition.approach.slice(1).map((p) => ({ ...p }));
    if (aiDistance(this.route.at(-1)!, definition.bay) > 0.05)
      this.route.push({ ...definition.bay });
    this.alternate = 0;
    this.actorPaths.clear();
    this.assistingAt = undefined;
    this.loadPhase = "to-rear";
    this.attachPassengers();
    this.stage("approach");
    return true;
  }
  /** Retry removes only this failed encounter's request token. Existing complete
   * missions and any other encounter retain exactly-once completion. */
  resetRequest(missionId: string) {
    if (
      this.data.missionId === missionId &&
      !["idle", "completed", "cancelled"].includes(this.state)
    )
      return false;
    this.requests.delete(missionId);
    return true;
  }
  cancel(missionId: string) {
    if (
      this.data.missionId !== missionId ||
      ["completed", "idle"].includes(this.state)
    )
      return false;
    this.data.siren = false;
    this.data.message = "সহায়তার যাত্রা স্থগিত হয়েছে।";
    this.stage("cancelled");
    return true;
  }
  private stage(stage: EvacuationStage) {
    this.data.stage = stage;
    this.elapsed = 0;
    this.blockedFor = 0;
    this.data.blocked = false;
    this.actorPaths.clear();
    this.options.onStage?.(stage, this.snapshot);
  }
  private blocked(message: string, dt: number) {
    this.data.blocked = true;
    this.blockedFor += dt;
    this.data.message = message;
  }
  private attachPassengers() {
    const anchors = this.options.anchors(this.data.ambulance);
    for (const index of [0, 1] as const)
      if (this.data.medicsAttached[index])
        this.data.medics[index] = copy(anchors.seats[index]);
    if (this.data.leaderAttached) this.data.leader = copy(anchors.rest);
  }
  private moveActor(
    pose: AIPose,
    target: AIPose,
    who: "leader" | "medic-0" | "medic-1",
    speed: number,
    dt: number,
    interior = false,
  ) {
    const clear = (x: number, z: number) =>
      this.options.canActorStand(x, z, who, interior);
    let path = this.actorPaths.get(who);
    if (path) path.retry -= dt;
    if (
      !path ||
      aiDistance(path.goal, target) > 0.2 ||
      (!path.points.length &&
        aiDistance(pose, target) > 0.05 &&
        path.retry <= 0)
    ) {
      path = {
        goal: { x: target.x, z: target.z },
        // Escort bodies are moving collaborators, not a reason to reroute the
        // patient into a static corner. Keep the patient on the body-safe world
        // scaffold; every incremental move still checks their live occupancy.
        points:
          (who === "leader" && !interior
            ? this.options.staticPathTo?.(pose, target, who, interior)
            : undefined) ??
          (clearAISegment(
            pose,
            target,
            clear,
            interior ? undefined : this.options.heightAt,
          )
            ? [{ ...target }]
            : (localActorPath(
                pose,
                target,
                clear,
                interior ? undefined : this.options.heightAt,
              ) ??
              this.options.pathTo?.(pose, target, who, interior) ??
              this.options.staticPathTo?.(pose, target, who, interior) ??
              [])),
        retry: 0.75,
      };
      this.actorPaths.set(who, path);
    }
    while (path.points.length && aiDistance(pose, path.points[0]) < 0.02)
      path.points.shift();
    const next = path.points[0];
    if (!next) {
      if (aiDistance(pose, target) <= 0.045) {
        pose.y += Math.max(-0.5 * dt, Math.min(0.5 * dt, target.y - pose.y));
        pose.yaw = limitedTurn(pose.yaw, target.yaw, dt);
        return Math.abs(pose.y - target.y) < 0.035;
      }
      this.blocked("পথে বাধা আছে—সহায়তাকারীদের যাওয়ার জায়গা দিন।", dt);
      return false;
    }
    const span = aiDistance(pose, next),
      travel = Math.min(span, speed * dt),
      t = span ? travel / span : 0;
    const candidate = {
      x: pose.x + (next.x - pose.x) * t,
      z: pose.z + (next.z - pose.z) * t,
    };
    if (
      !clearAISegment(
        pose,
        candidate,
        clear,
        interior ? undefined : this.options.heightAt,
      )
    ) {
      this.blocked("দরজার সামনে বাধা আছে—একটু সরে দাঁড়ান।", dt);
      path.points = [];
      return false;
    }
    pose.yaw = limitedTurn(pose.yaw, yawTo(pose, next, pose.yaw), dt);
    pose.x = candidate.x;
    pose.z = candidate.z;
    const desiredY = interior
      ? target.y
      : this.options.heightAt(candidate.x, candidate.z);
    pose.y += Math.max(-0.65 * dt, Math.min(0.65 * dt, desiredY - pose.y));
    return (
      aiDistance(pose, target) < 0.045 && Math.abs(pose.y - target.y) < 0.035
    );
  }
  private moveVehicle(dt: number) {
    const target = this.route[0];
    if (!target) return true;
    const pose = this.data.ambulance,
      span = aiDistance(pose, target),
      speed =
        this.data.stage === "approach" && this.route.length === 1 ? 2.2 : 5.5;
    const travel = Math.min(span, speed * dt),
      t = span ? travel / span : 0;
    const movementYaw = yawTo(pose, target, pose.yaw),
      // Reverse out of a loading bay or back away to a selected alternate's
      // staging point. Default approaches retain their forward-only motion.
      // Turning180degrees in place would sweep through the hub dais.
      reverse =
        (this.state === "depart" ||
          (this.state === "approach" && this.alternate > 0)) &&
        Math.abs(
          Math.atan2(
            Math.sin(movementYaw - pose.yaw),
            Math.cos(movementYaw - pose.yaw),
          ),
        ) >
          Math.PI / 2,
      yaw = movementYaw + (reverse ? Math.PI : 0),
      nextYaw = limitedTurn(pose.yaw, yaw, dt);
    const candidate = {
      x: pose.x + (target.x - pose.x) * t,
      z: pose.z + (target.z - pose.z) * t,
    };
    if (
      !clearAISegment(pose, candidate, (x, z) =>
        this.options.canVehicleStand(x, z, nextYaw),
      )
    ) {
      this.blocked("স্বস্তি সেবার গাড়ির পথ বন্ধ—সামনের জায়গা খালি করুন।", dt);
      if (this.blockedFor > 2.5) this.tryAlternate();
      return false;
    }
    pose.x = candidate.x;
    pose.z = candidate.z;
    pose.yaw = nextYaw;
    pose.y = this.options.heightAt(pose.x, pose.z);
    this.data.vehicleTravel += travel;
    this.data.wheelTravel += reverse ? -travel : travel;
    if (aiDistance(pose, target) < 0.025) this.route.shift();
    this.attachPassengers();
    return !this.route.length;
  }
  /** A narrow footpath cannot fit a rigid three-abreast carry formation. Keep
   * helpers alongside or behind the checked patient route, with reachable
   * separate goals; never ask one to stand inside a divider or in front of the
   * patient and then wait for that same patient to move through them. */
  private moveEscorts(dt: number) {
    const leader = this.data.leader;
    const next = this.actorPaths
      .get("leader")
      ?.points.find((p) => aiDistance(leader, p) > 0.04);
    const heading = next ? yawTo(leader, next, leader.yaw) : leader.yaw;
    const chosen: AIPoint[] = [];
    for (const index of [0, 1] as const) {
      const medic = this.data.medics[index],
        who = `medic-${index}` as const;
      const clear = (x: number, z: number) =>
        this.options.canActorStand(x, z, who, false);
      const candidates = [0.85, 1.4, 1.95]
        .flatMap((radius) =>
          [
            Math.PI,
            -Math.PI * 0.75,
            Math.PI * 0.75,
            -Math.PI / 2,
            Math.PI / 2,
          ].map((offset) => ({
            x: leader.x + Math.sin(heading + offset) * radius,
            z: leader.z + Math.cos(heading + offset) * radius,
          })),
        )
        .filter(
          (p) =>
            clear(p.x, p.z) &&
            chosen.every((other) => aiDistance(other, p) > 0.7),
        )
        .sort((a, b) => aiDistance(medic, a) - aiDistance(medic, b));
      const point = candidates.find(
        (p) =>
          clearAISegment(medic, p, clear, this.options.heightAt) ||
          !!this.options.pathTo?.(medic, p, who, false)?.length ||
          !!localActorPath(medic, p, clear, this.options.heightAt)?.length,
      );
      if (point) {
        chosen.push(point);
        this.moveActor(
          medic,
          {
            ...point,
            y: this.options.heightAt(point.x, point.z),
            yaw: heading,
          },
          who,
          1.3,
          dt,
        );
      }
      this.data.medicAnimations[index] = "Carry";
    }
  }
  private tryAlternate() {
    const candidates =
      this.state === "depart"
        ? this.definition?.alternateExits
        : this.definition?.alternateApproaches;
    while (candidates && this.alternate < candidates.length) {
      const route = candidates[this.alternate++];
      let from: AIPoint = this.data.ambulance;
      if (
        route.every((point) => {
          const safe = clearAISegment(from, point, (x, z) =>
            this.options.canVehicleStand(
              x,
              z,
              yawTo(from, point, this.data.ambulance.yaw),
            ),
          );
          from = point;
          return safe;
        })
      ) {
        this.route = route.map((p) => ({ ...p }));
        this.blockedFor = 0;
        return;
      }
    }
  }
  tick(delta: number, paused = false): EvacuationSnapshot {
    const dt = Math.max(0, Math.min(0.05, Number.isFinite(delta) ? delta : 0));
    if (
      paused ||
      !dt ||
      ["idle", "completed", "cancelled"].includes(this.state)
    )
      return this.snapshot;
    const previousLeaderAnimation = this.data.leaderAnimation,
      previousMedicAnimations = [...this.data.medicAnimations];
    this.elapsed += dt;
    this.data.blocked = false;
    const anchors = this.options.anchors(this.data.ambulance);
    if (this.state === "approach") {
      if (
        this.data.leaderAnimation === "Defeated" &&
        this.data.leaderAnimationTime >= 1.2
      )
        this.data.leaderAnimation = "Resting";
      if (
        this.moveVehicle(dt) &&
        aiDistance(this.data.ambulance, this.definition!.bay) < 0.05
      ) {
        this.data.message = "শান্ত থাকুন, আমরা সাহায্য করছি।";
        this.data.medicsAttached = [false, false];
        this.stage("exit-medics");
      }
    } else if (this.state === "exit-medics") {
      this.data.doorOpen = Math.min(1, this.data.doorOpen + dt / 1.1);
      let arrived = true;
      for (const index of [0, 1] as const) {
        this.data.medicAnimations[index] = "ExitVehicle";
        arrived =
          this.moveActor(
            this.data.medics[index],
            anchors.exits[index],
            `medic-${index}`,
            1.05,
            dt,
            true,
          ) && arrived;
      }
      if (arrived && this.data.doorOpen >= 1) {
        const leader = this.data.leader;
        const chosen: AIPoint[] = [];
        for (const index of [0, 1] as const) {
          const who = `medic-${index}` as const,
            medic = this.data.medics[index];
          const offsets =
            index === 0
              ? [
                  [-0.72, 0],
                  [0, -0.72],
                  [-0.52, -0.52],
                  [0, 0.72],
                  [-0.52, 0.52],
                  [0.72, 0],
                ]
              : [
                  [0.72, 0],
                  [0, 0.72],
                  [0.52, 0.52],
                  [0, -0.72],
                  [0.52, -0.52],
                  [-0.72, 0],
                ];
          const candidate = offsets
            .map(([x, z]) => ({ x: leader.x + x, z: leader.z + z }))
            .find((p) => {
              const clear = (x: number, z: number) =>
                this.options.canActorStand(x, z, who, false);
              return (
                clear(p.x, p.z) &&
                chosen.every((other) => aiDistance(other, p) > 0.65) &&
                (clearAISegment(medic, p, clear, this.options.heightAt) ||
                  !!this.options.pathTo?.(medic, p, who, false)?.length)
              );
            });
          if (candidate) chosen.push(candidate);
        }
        if (chosen.length !== 2) {
          this.blocked("সহায়তার জন্য পাশে একটু জায়গা দিন।", dt);
          return this.snapshot;
        }
        this.assistingAt = chosen as [AIPoint, AIPoint];
        this.stage("assist");
      }
    } else if (this.state === "assist") {
      let arrived = true;
      for (const index of [0, 1] as const) {
        const point = this.assistingAt![index],
          target = {
            ...point,
            y: this.options.heightAt(point.x, point.z),
            yaw: yawTo(point, this.data.leader),
          };
        const reached = this.moveActor(
          this.data.medics[index],
          target,
          `medic-${index}`,
          1.5,
          dt,
        );
        this.data.medicAnimations[index] = reached ? "Assist" : "Walk";
        arrived = reached && arrived;
      }
      if (!arrived) this.elapsed = 0;
      else if (this.elapsed >= 2.1) {
        this.data.leaderAnimation = "AssistedWalk";
        this.stage("load");
      }
    } else if (this.state === "load") {
      const target = this.loadPhase === "to-rear" ? anchors.rear : anchors.rest;
      this.data.leaderAnimation =
        this.loadPhase === "to-rest" ? "Loading" : "AssistedWalk";
      const arrived = this.moveActor(
        this.data.leader,
        target,
        "leader",
        0.85,
        dt,
        this.loadPhase === "to-rest",
      );
      if (this.loadPhase === "to-rear") this.moveEscorts(dt);
      if (arrived && this.loadPhase === "to-rear") {
        this.loadPhase = "to-rest";
        this.actorPaths.delete("leader");
      } else if (arrived) {
        this.data.leaderAttached = true;
        this.data.leaderAnimation = "Resting";
        this.data.message = "সব ঠিক আছে। স্বস্তি ক্লিনিকে নিয়ে যাচ্ছি।";
        this.attachPassengers();
        this.stage("return-medics");
      }
    } else if (this.state === "return-medics") {
      let arrived = true;
      for (const index of [0, 1] as const) {
        const reached = this.moveActor(
          this.data.medics[index],
          anchors.seats[index],
          `medic-${index}`,
          1.2,
          dt,
          true,
        );
        this.data.medicAnimations[index] = reached ? "Seated" : "EnterVehicle";
        this.data.medicsAttached[index] = reached;
        arrived = reached && arrived;
      }
      if (arrived) this.stage("close-doors");
    } else if (this.state === "close-doors") {
      this.data.doorOpen = Math.max(0, this.data.doorOpen - dt / 1.1);
      if (this.data.doorOpen <= 0) {
        this.route = this.definition!.exitRoute.map((p) => ({ ...p }));
        while (
          this.route.length &&
          aiDistance(this.data.ambulance, this.route[0]) < 0.025
        )
          this.route.shift();
        if (
          !this.route.length ||
          aiDistance(this.route.at(-1)!, this.definition!.exit) > 0.05
        )
          this.route.push({ ...this.definition!.exit });
        this.alternate = 0;
        this.stage("depart");
      }
    } else if (this.state === "depart") {
      if (
        this.moveVehicle(dt) &&
        aiDistance(this.data.ambulance, this.definition!.exit) < 0.05 &&
        this.data.leaderAttached &&
        this.data.medicsAttached.every(Boolean) &&
        this.data.doorOpen <= 0
      ) {
        this.data.siren = false;
        this.data.completed = true;
        this.data.message =
          "সহায়তার গাড়ি স্বস্তি ক্লিনিকের পথে। রাস্তা আবার খোলা!";
        this.stage("completed");
        this.options.onCompleted?.(this.data.missionId);
      }
    }
    if (!this.data.blocked) this.blockedFor = 0;
    this.data.leaderAnimationTime =
      previousLeaderAnimation === this.data.leaderAnimation
        ? this.data.leaderAnimationTime + dt
        : 0;
    for (const index of [0, 1] as const)
      this.data.medicAnimationTimes[index] =
        previousMedicAnimations[index] === this.data.medicAnimations[index]
          ? this.data.medicAnimationTimes[index] + dt
          : 0;
    this.attachPassengers();
    return this.snapshot;
  }
}
