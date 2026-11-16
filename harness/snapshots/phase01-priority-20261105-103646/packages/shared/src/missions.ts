import {
  areaById,
  distance2,
  isAreaId,
  missionWorldVersion,
  pointInRect,
  worldAreas,
  type AreaId,
  type Point2,
} from "./world-layout.ts";

export type MissionPhase =
  | "undiscovered"
  | "discovered"
  | "selected"
  | "approaching"
  | "active"
  | "leader-fleeing"
  | "evacuation"
  | "completed"
  | "failed"
  | "restartable";
export const missionPhaseLabels: Record<MissionPhase, string> = {
  undiscovered: "অপরিচিত এলাকা",
  discovered: "এলাকা দেখা হয়েছে",
  selected: "গন্তব্য বেছে নেওয়া হয়েছে",
  approaching: "গন্তব্যের পথে",
  active: "রাস্তা খোলার কাজ চলছে",
  "leader-fleeing": "নেতা সরে যাচ্ছেন",
  evacuation: "নিরাপদে তুলে নেওয়া হচ্ছে",
  completed: "পথ খুলেছে",
  failed: "একটু বিরতি নিন",
  restartable: "আবার চেষ্টা করা যাবে",
};
export type MissionRuntime = {
  id: AreaId;
  phase: MissionPhase;
  resolve: number;
  attempt: number;
  hitCount: number;
  fleeRequested: boolean;
  outsideSeconds: number;
  boundsWarning: boolean;
  ambulanceRequested: boolean;
  leaderLoaded: boolean;
  completionSequence: number | null;
  failure: "" | "bounds" | "player";
};
export type MatchMissionState = {
  version: 1;
  worldVersion: typeof missionWorldVersion;
  sequence: number;
  selectedId: AreaId | null;
  activeId: AreaId | null;
  missions: Record<AreaId, MissionRuntime>;
  completed: AreaId[];
  consumedImpacts: string[];
};
type Envelope = { seq: number; missionId: AreaId };
export type MissionEvent = Envelope &
  (
    | { type: "discover" }
    | { type: "select"; routeReady: boolean }
    | { type: "approach"; moved: boolean; nearRoute: boolean }
    | {
        type: "enter";
        position: Point2;
        sectorReady: boolean;
        tutorialSafe: boolean;
      }
    | {
        type: "impact";
        projectileId: string;
        item: "egg" | "sandal";
        target: "leader" | "worker" | "civilian";
        observed: boolean;
        tutorialSafe: boolean;
      }
    | { type: "leader-fled"; position: Point2 }
    | {
        type: "ambulance-loaded";
        leaderLoaded: boolean;
        personnelSafe: boolean;
      }
    | { type: "ambulance-exited"; position: Point2; doorsClosed: boolean }
    | {
        type: "player-status";
        position: Point2;
        resolve: number;
        elapsedSeconds: number;
        tutorialSafe: boolean;
      }
    | { type: "failure-cleaned"; safeEntrance: boolean; actorsReady: boolean }
    | { type: "retry"; routeReady: boolean }
  );
export type MissionEffect = {
  id: string;
  missionId: AreaId;
  type:
    | "discovered"
    | "selected"
    | "started"
    | "score"
    | "civilian-warning"
    | "flee-requested"
    | "leader-fleeing"
    | "evacuation-requested"
    | "loaded"
    | "completed"
    | "failed"
    | "bounds-warning"
    | "retry";
  message: string;
  points?: number;
};
export type MissionReduction = {
  state: MatchMissionState;
  effects: MissionEffect[];
  accepted: boolean;
  error: string;
};
export const missionCheckpointKey = "neta-solo-missions-c1";
export const missionBoundsGraceSeconds = 8;
const encounterPhases: MissionPhase[] = [
  "active",
  "leader-fleeing",
  "evacuation",
];
const allPhases = Object.keys(missionPhaseLabels) as MissionPhase[];
function freshRuntime(id: AreaId): MissionRuntime {
  return {
    id,
    phase: "undiscovered",
    resolve: 100,
    attempt: 1,
    hitCount: 0,
    fleeRequested: false,
    outsideSeconds: 0,
    boundsWarning: false,
    ambulanceRequested: false,
    leaderLoaded: false,
    completionSequence: null,
    failure: "",
  };
}
export function newMatchMissions(): MatchMissionState {
  return {
    version: 1,
    worldVersion: missionWorldVersion,
    sequence: 0,
    selectedId: null,
    activeId: null,
    missions: Object.fromEntries(
      worldAreas.map((a) => [a.id, freshRuntime(a.id)]),
    ) as Record<AreaId, MissionRuntime>,
    completed: [],
    consumedImpacts: [],
  };
}
export function nextMissionId(state: MatchMissionState): AreaId | null {
  return (
    worldAreas.find((a) => state.missions[a.id].phase !== "completed")?.id ??
    null
  );
}
const observedPoint = (p: Point2) =>
  Number.isFinite(p.x) && Number.isFinite(p.z);

/** Pure single-player authority. Every transition beyond selection consumes a
 * concrete observation; UI clicks/timers cannot manufacture a completed job. */
export function reduceMission(
  state: MatchMissionState,
  event: MissionEvent,
): MissionReduction {
  const reject = (error: string): MissionReduction => ({
    state,
    effects: [],
    accepted: false,
    error,
  });
  if (
    !isAreaId(event.missionId) ||
    !Number.isSafeInteger(event.seq) ||
    event.seq <= state.sequence
  )
    return reject("পুরোনো বা অচেনা ঘটনার অনুরোধ গ্রহণ করা যায়নি।");
  const previous = state.missions[event.missionId],
    area = areaById(event.missionId);
  const current = { ...previous },
    effects: MissionEffect[] = [];
  const next: MatchMissionState = {
    ...state,
    sequence: event.seq,
    missions: { ...state.missions, [event.missionId]: current },
    completed: [...state.completed],
    consumedImpacts: [...state.consumedImpacts],
  };
  const effect = (
    type: MissionEffect["type"],
    message: string,
    points?: number,
  ) =>
    effects.push({
      id: `${event.missionId}:${current.attempt}:${event.seq}:${type}`,
      missionId: event.missionId,
      type,
      message,
      ...(points === undefined ? {} : { points }),
    });
  const ownsEncounter =
    state.activeId === event.missionId &&
    encounterPhases.includes(current.phase);
  switch (event.type) {
    case "discover":
      if (current.phase !== "undiscovered")
        return reject("এলাকাটি আগে থেকেই চেনা আছে।");
      current.phase = "discovered";
      effect("discovered", area.objective);
      break;
    case "select":
      if (state.activeId && state.activeId !== event.missionId)
        return reject("চলমান এলাকার কাজ শেষ করে পরের গন্তব্য বেছে নিন।");
      if (state.activeId) return reject("এই এলাকার কাজ এখন চলছে।");
      if (!event.routeReady)
        return reject("এখন গন্তব্যের নিরাপদ পথ পাওয়া যাচ্ছে না।");
      if (["completed", "failed", "restartable"].includes(current.phase))
        return reject("এই অবস্থায় নতুন গন্তব্য হিসেবে এলাকাটি নেওয়া যায় না।");
      if (state.selectedId && state.selectedId !== event.missionId) {
        const old = state.missions[state.selectedId];
        if (["selected", "approaching"].includes(old.phase))
          next.missions[old.id] = { ...old, phase: "discovered" };
      }
      current.phase = "selected";
      next.selectedId = event.missionId;
      effect("selected", `${area.name}র চিহ্নিত পথ ধরে এগোন।`);
      break;
    case "approach":
      if (
        state.selectedId !== event.missionId ||
        !["selected", "approaching"].includes(current.phase) ||
        !event.moved ||
        !event.nearRoute
      )
        return reject("গন্তব্যের পথে চলার পর্যবেক্ষণ মেলেনি।");
      current.phase = "approaching";
      break;
    case "enter":
      if (event.tutorialSafe)
        return reject("পরিচিতি শেষ হলে এলাকার কাজ শুরু হবে।");
      if (
        state.activeId ||
        state.selectedId !== event.missionId ||
        !["selected", "approaching"].includes(current.phase)
      )
        return reject("আগে এই এলাকার গন্তব্য বেছে নিন।");
      if (
        !event.sectorReady ||
        !observedPoint(event.position) ||
        distance2(event.position, area.entrance) > 4
      )
        return reject("প্রবেশপথ ও এলাকার প্রস্তুতি এখনো মেলেনি।");
      current.phase = "active";
      next.activeId = event.missionId;
      effect("started", area.objective);
      break;
    case "impact": {
      if (
        event.tutorialSafe ||
        !event.observed ||
        !ownsEncounter ||
        !["active", "leader-fleeing"].includes(current.phase)
      )
        return reject("এখন এই আঘাত এলাকার কাজে যোগ হবে না।");
      if (
        !event.projectileId ||
        event.projectileId.length > 100 ||
        state.consumedImpacts.includes(event.projectileId) ||
        state.consumedImpacts.length >= 2048
      )
        return reject("এই ছোড়া জিনিসের ফল আগে গোনা হয়েছে বা পরিচয় সঠিক নয়।");
      next.consumedImpacts.push(event.projectileId);
      if (event.target === "civilian") {
        effect("civilian-warning", "পথচারীকে নয়! তাঁদের চলার পথ নিরাপদ রাখুন।");
        break;
      }
      effect("score", "সঠিক লক্ষ্য!", event.item === "egg" ? 5 : 8);
      if (event.target !== "leader") break;
      current.hitCount++;
      current.resolve = Math.max(
        0,
        current.resolve - (event.item === "egg" ? 25 : 40),
      );
      if (current.resolve === 0) {
        current.phase = "evacuation";
        current.ambulanceRequested = true;
        effect(
          "evacuation-requested",
          "নেতা বিশ্রাম নিচ্ছেন। সহায়তার গাড়িকে পথ দিন।",
        );
      } else if (
        !current.fleeRequested &&
        (current.resolve <= 50 || current.hitCount >= 2)
      ) {
        current.fleeRequested = true;
        effect(
          "flee-requested",
          "নেতা সরে যাওয়ার পথ খুঁজছেন। নিরাপদ দূরত্বে অনুসরণ করুন।",
        );
      }
      break;
    }
    case "leader-fled":
      if (
        !ownsEncounter ||
        current.phase !== "active" ||
        !current.fleeRequested ||
        !observedPoint(event.position) ||
        !area.escapeRoute.some((p) => distance2(p, event.position) <= 1.2)
      )
        return reject("নেতার পালানোর পথে পৌঁছানো এখনো দেখা যায়নি।");
      current.phase = "leader-fleeing";
      effect(
        "leader-fleeing",
        "নেতা সরে যাচ্ছেন। এলাকার সীমার মধ্যে অনুসরণ করুন।",
      );
      break;
    case "ambulance-loaded":
      if (
        !ownsEncounter ||
        current.phase !== "evacuation" ||
        current.leaderLoaded ||
        !event.leaderLoaded ||
        !event.personnelSafe
      )
        return reject("নিরাপদে গাড়িতে তোলার পর্যবেক্ষণ এখনো মেলেনি।");
      current.leaderLoaded = true;
      effect("loaded", "সবাই নিরাপদে উঠেছেন। গাড়িকে বের হওয়ার পথ দিন।");
      break;
    case "ambulance-exited":
      if (
        !ownsEncounter ||
        current.phase !== "evacuation" ||
        !current.leaderLoaded ||
        !event.doorsClosed ||
        !observedPoint(event.position) ||
        distance2(event.position, area.ambulance.exit) > 2
      )
        return reject("সহায়তার গাড়ি নিরাপদে বের হওয়া এখনো দেখা যায়নি।");
      current.phase = "completed";
      current.completionSequence = event.seq;
      next.completed.push(event.missionId);
      next.activeId = null;
      next.selectedId = null;
      effect(
        "completed",
        `${area.name}র পথ খুলেছে! পরের এলাকা মানচিত্রে দেখুন।`,
      );
      break;
    case "player-status": {
      if (!ownsEncounter || event.tutorialSafe)
        return reject("এখন এলাকার বিপদ-পর্যবেক্ষণ বন্ধ আছে।");
      if (
        !observedPoint(event.position) ||
        !Number.isFinite(event.resolve) ||
        !Number.isFinite(event.elapsedSeconds) ||
        event.elapsedSeconds < 0 ||
        event.elapsedSeconds > 1
      )
        return reject("চলার পর্যবেক্ষণে সময় বা অবস্থান সঠিক নয়।");
      const outside = !pointInRect(event.position, area.encounterBounds);
      current.outsideSeconds = outside
        ? current.outsideSeconds + event.elapsedSeconds
        : 0;
      if (outside && !current.boundsWarning) {
        current.boundsWarning = true;
        effect(
          "bounds-warning",
          "এলাকার বাইরে যাচ্ছেন। চিহ্নিত সীমার মধ্যে ফিরে আসুন।",
        );
      }
      if (!outside) current.boundsWarning = false;
      if (
        event.resolve <= 0 ||
        current.outsideSeconds >= missionBoundsGraceSeconds
      ) {
        current.phase = "failed";
        current.failure = event.resolve <= 0 ? "player" : "bounds";
        effect(
          "failed",
          current.failure === "player"
            ? "একটু বিশ্রাম নিন। প্রস্তুত হলে আবার চেষ্টা করুন।"
            : "এলাকার কাজ থেমেছে। নিরাপদ প্রবেশপথ থেকে আবার চেষ্টা করুন।",
        );
      }
      break;
    }
    case "failure-cleaned":
      if (
        state.activeId !== event.missionId ||
        current.phase !== "failed" ||
        !event.safeEntrance ||
        !event.actorsReady
      )
        return reject("আবার শুরুর নিরাপদ প্রস্তুতি এখনো হয়নি।");
      current.phase = "restartable";
      next.activeId = null;
      break;
    case "retry":
      if (
        state.activeId ||
        current.phase !== "restartable" ||
        !event.routeReady
      )
        return reject("নিরাপদে প্রস্তুত হলে আবার চেষ্টা করা যাবে।");
      next.missions[event.missionId] = {
        ...freshRuntime(event.missionId),
        phase: "selected",
        attempt: current.attempt + 1,
      };
      next.selectedId = event.missionId;
      effect("retry", "প্রস্তুত! চিহ্নিত প্রবেশপথে ফিরে যান।");
      break;
  }
  return { state: next, effects, accepted: true, error: "" };
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
function validRuntime(value: unknown, id: AreaId): value is MissionRuntime {
  if (
    !record(value) ||
    value.id !== id ||
    !allPhases.includes(value.phase as MissionPhase)
  )
    return false;
  if (
    ![value.resolve, value.attempt, value.hitCount, value.outsideSeconds].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    )
  )
    return false;
  if (
    (value.resolve as number) < 0 ||
    (value.resolve as number) > 100 ||
    !Number.isSafeInteger(value.attempt) ||
    (value.attempt as number) < 1 ||
    !Number.isSafeInteger(value.hitCount) ||
    (value.hitCount as number) < 0 ||
    (value.outsideSeconds as number) < 0 ||
    (value.outsideSeconds as number) > 100
  )
    return false;
  if (
    ![
      value.fleeRequested,
      value.boundsWarning,
      value.ambulanceRequested,
      value.leaderLoaded,
    ].every((b) => typeof b === "boolean")
  )
    return false;
  if (!["", "bounds", "player"].includes(value.failure as string)) return false;
  if (
    value.completionSequence !== null &&
    (!Number.isSafeInteger(value.completionSequence) ||
      (value.completionSequence as number) <= 0)
  )
    return false;
  if (
    value.phase === "completed" &&
    (!(value.completionSequence as number) ||
      value.resolve !== 0 ||
      !value.leaderLoaded ||
      !value.ambulanceRequested)
  )
    return false;
  if (
    value.phase === "evacuation" &&
    (value.resolve !== 0 || !value.ambulanceRequested)
  )
    return false;
  if (
    value.leaderLoaded &&
    !["evacuation", "completed", "failed", "restartable"].includes(
      value.phase as string,
    )
  )
    return false;
  if (value.phase !== "completed" && value.completionSequence !== null)
    return false;
  if (value.phase === "leader-fleeing" && !value.fleeRequested) return false;
  if (
    ["failed", "restartable"].includes(value.phase as string) !==
    (value.failure !== "")
  )
    return false;
  if (
    value.resolve === 0 &&
    !["evacuation", "completed", "failed", "restartable"].includes(
      value.phase as string,
    )
  )
    return false;
  return true;
}

/** Repair only invalid records, never device audio/tutorial keys. Running
 * encounters remain running for the runtime to reconstruct their actors. */
export function parseMissionCheckpoint(raw: unknown): MatchMissionState {
  const initial = newMatchMissions();
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return initial;
    }
  }
  if (
    !record(value) ||
    value.version !== 1 ||
    value.worldVersion !== missionWorldVersion ||
    !record(value.missions)
  )
    return initial;
  for (const area of worldAreas) {
    const saved = value.missions[area.id];
    if (validRuntime(saved, area.id)) initial.missions[area.id] = { ...saved };
  }
  initial.sequence =
    Number.isSafeInteger(value.sequence) && (value.sequence as number) >= 0
      ? (value.sequence as number)
      : 0;
  initial.completed = worldAreas
    .filter((a) => initial.missions[a.id].phase === "completed")
    .map((a) => a.id)
    .sort(
      (a, b) =>
        initial.missions[a].completionSequence! -
        initial.missions[b].completionSequence!,
    );
  initial.sequence = Math.max(
    initial.sequence,
    ...initial.completed.map((id) => initial.missions[id].completionSequence!),
  );
  initial.consumedImpacts = Array.isArray(value.consumedImpacts)
    ? [
        ...new Set(
          value.consumedImpacts.filter(
            (id): id is string =>
              typeof id === "string" && id.length > 0 && id.length <= 100,
          ),
        ),
      ].slice(0, 2048)
    : [];
  const running = worldAreas.filter((a) =>
    [...encounterPhases, "failed"].includes(initial.missions[a.id].phase),
  );
  const active =
    isAreaId(value.activeId) && running.some((a) => a.id === value.activeId)
      ? value.activeId
      : (running[0]?.id ?? null);
  initial.activeId = active;
  for (const area of running)
    if (area.id !== active)
      initial.missions[area.id] = {
        ...freshRuntime(area.id),
        phase: "discovered",
      };
  initial.selectedId =
    active ??
    (isAreaId(value.selectedId) &&
    ["selected", "approaching", "restartable"].includes(
      initial.missions[value.selectedId].phase,
    )
      ? value.selectedId
      : null);
  for (const area of worldAreas)
    if (
      ["selected", "approaching"].includes(initial.missions[area.id].phase) &&
      initial.selectedId !== area.id
    )
      initial.missions[area.id] = {
        ...initial.missions[area.id],
        phase: "discovered",
      };
  return initial;
}
export const missionCheckpoint = (state: MatchMissionState) =>
  JSON.stringify(state);
