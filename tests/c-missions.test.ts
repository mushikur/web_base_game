import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newMatchMissions,
  reduceMission,
  parseMissionCheckpoint,
  missionCheckpoint,
  nextMissionId,
  type MatchMissionState,
  type MissionEvent,
} from "../packages/shared/src/missions.ts";
import {
  areaById,
  worldAreas,
  type AreaId,
} from "../packages/shared/src/world-layout.ts";

function runner(initial = newMatchMissions()) {
  let state = initial;
  return {
    get state() {
      return state;
    },
    send(event: Omit<MissionEvent, "seq">) {
      const result = reduceMission(state, {
        ...event,
        seq: state.sequence + 1,
      } as MissionEvent);
      if (result.accepted) state = result.state;
      return result;
    },
  };
}
// Omit on unions loses variant properties; the strongly typed wrapper keeps
// each actual call checked without forcing test events to carry a sequence.
type WithoutSeq<T> = T extends unknown ? Omit<T, "seq"> : never;
function dispatch(
  r: ReturnType<typeof runner>,
  event: WithoutSeq<MissionEvent>,
) {
  return r.send(event);
}
const select = (r: ReturnType<typeof runner>, id: AreaId) =>
  dispatch(r, { type: "select", missionId: id, routeReady: true });
function enter(r: ReturnType<typeof runner>, id: AreaId) {
  assert.equal(select(r, id).accepted, true);
  return dispatch(r, {
    type: "enter",
    missionId: id,
    position: areaById(id).entrance,
    sectorReady: true,
    tutorialSafe: false,
  });
}
function hit(
  r: ReturnType<typeof runner>,
  id: AreaId,
  projectileId: string,
  item: "egg" | "sandal" = "sandal",
) {
  return dispatch(r, {
    type: "impact",
    missionId: id,
    projectileId,
    item,
    target: "leader",
    observed: true,
    tutorialSafe: false,
  });
}
function complete(r: ReturnType<typeof runner>, id: AreaId) {
  assert.equal(enter(r, id).accepted, true);
  for (let i = 0; i < 3; i++)
    assert.equal(hit(r, id, `${id}-${i}`).accepted, true);
  assert.equal(
    dispatch(r, {
      type: "ambulance-loaded",
      missionId: id,
      leaderLoaded: true,
      personnelSafe: true,
    }).accepted,
    true,
  );
  return dispatch(r, {
    type: "ambulance-exited",
    missionId: id,
    position: areaById(id).ambulance.exit,
    doorsClosed: true,
  });
}

test("C discovery, route and entrance observations guard real state progression", () => {
  const r = runner(),
    id = "promise-junction";
  assert.equal(r.state.missions[id].phase, "undiscovered");
  assert.equal(dispatch(r, { type: "discover", missionId: id }).accepted, true);
  assert.equal(r.state.missions[id].phase, "discovered");
  const before = r.state;
  assert.equal(
    dispatch(r, { type: "select", missionId: id, routeReady: false }).accepted,
    false,
  );
  assert.equal(r.state, before);
  select(r, id);
  assert.equal(
    dispatch(r, {
      type: "approach",
      missionId: id,
      moved: false,
      nearRoute: true,
    }).accepted,
    false,
  );
  assert.equal(
    dispatch(r, {
      type: "approach",
      missionId: id,
      moved: true,
      nearRoute: true,
    }).accepted,
    true,
  );
  assert.equal(r.state.missions[id].phase, "approaching");
  assert.equal(
    dispatch(r, {
      type: "enter",
      missionId: id,
      position: areaById(id).entrance,
      sectorReady: true,
      tutorialSafe: true,
    }).accepted,
    false,
  );
  assert.equal(
    dispatch(r, {
      type: "enter",
      missionId: id,
      position: { x: 90, z: 90 },
      sectorReady: true,
      tutorialSafe: false,
    }).accepted,
    false,
  );
  assert.equal(
    dispatch(r, {
      type: "enter",
      missionId: id,
      position: areaById(id).entrance,
      sectorReady: false,
      tutorialSafe: false,
    }).accepted,
    false,
  );
  assert.equal(
    dispatch(r, {
      type: "enter",
      missionId: id,
      position: areaById(id).entrance,
      sectorReady: true,
      tutorialSafe: false,
    }).accepted,
    true,
  );
  assert.equal(r.state.activeId, id);
  assert.equal(select(r, "committee-lane").accepted, false);
});

test("C reroute replaces only a selected objective and leaves known areas discovered", () => {
  const r = runner();
  select(r, "promise-junction");
  select(r, "committee-lane");
  assert.equal(r.state.selectedId, "committee-lane");
  assert.equal(r.state.missions["promise-junction"].phase, "discovered");
  assert.equal(r.state.activeId, null);
});

test("C actual impacts are single-use, civilian-safe and request fleeing before observed route entry", () => {
  const r = runner(),
    id = "promise-junction";
  enter(r, id);
  const a = hit(r, id, "egg-first", "egg");
  assert.equal(a.effects.find((e) => e.type === "score")?.points, 5);
  assert.equal(r.state.missions[id].resolve, 75);
  assert.equal(hit(r, id, "egg-first").accepted, false);
  const civilian = dispatch(r, {
    type: "impact",
    missionId: id,
    projectileId: "civilian",
    target: "civilian",
    item: "egg",
    observed: true,
    tutorialSafe: false,
  });
  assert.equal(
    civilian.effects.some((e) => e.type === "score"),
    false,
  );
  assert.equal(r.state.missions[id].resolve, 75);
  const b = hit(r, id, "sandal-second");
  assert.equal(b.effects.filter((e) => e.type === "flee-requested").length, 1);
  assert.equal(r.state.missions[id].phase, "active");
  assert.equal(
    dispatch(r, {
      type: "leader-fled",
      missionId: id,
      position: { x: -10, z: -10 },
    }).accepted,
    false,
  );
  assert.equal(
    dispatch(r, {
      type: "leader-fled",
      missionId: id,
      position: areaById(id).escapeRoute[0],
    }).accepted,
    true,
  );
  assert.equal(r.state.missions[id].phase, "leader-fleeing");
  const c = hit(r, id, "last");
  assert.equal(
    c.effects.filter((e) => e.type === "evacuation-requested").length,
    1,
  );
  assert.equal(r.state.missions[id].resolve, 0);
  assert.equal(r.state.missions[id].phase, "evacuation");
  assert.equal(hit(r, id, "late").accepted, false);
});

test("C zero resolve requests evacuation without an impossible extra flee event", () => {
  const r = runner(),
    id = "committee-lane";
  enter(r, id);
  hit(r, id, "a");
  hit(r, id, "b");
  hit(r, id, "c");
  assert.equal(r.state.missions[id].phase, "evacuation");
  assert.equal(r.state.missions[id].ambulanceRequested, true);
  assert.equal(
    dispatch(r, {
      type: "ambulance-exited",
      missionId: id,
      position: areaById(id).ambulance.exit,
      doorsClosed: true,
    }).accepted,
    false,
  );
  assert.equal(
    dispatch(r, {
      type: "ambulance-loaded",
      missionId: id,
      leaderLoaded: true,
      personnelSafe: false,
    }).accepted,
    false,
  );
  assert.equal(
    dispatch(r, {
      type: "ambulance-loaded",
      missionId: id,
      leaderLoaded: true,
      personnelSafe: true,
    }).accepted,
    true,
  );
  assert.equal(
    dispatch(r, {
      type: "ambulance-exited",
      missionId: id,
      position: areaById(id).ambulance.bay,
      doorsClosed: true,
    }).accepted,
    false,
  );
  assert.equal(
    dispatch(r, {
      type: "ambulance-exited",
      missionId: id,
      position: areaById(id).ambulance.exit,
      doorsClosed: false,
    }).accepted,
    false,
  );
  const done = dispatch(r, {
    type: "ambulance-exited",
    missionId: id,
    position: areaById(id).ambulance.exit,
    doorsClosed: true,
  });
  assert.equal(done.accepted, true);
  assert.equal(done.effects.filter((e) => e.type === "completed").length, 1);
  assert.equal(
    dispatch(r, {
      type: "ambulance-exited",
      missionId: id,
      position: areaById(id).ambulance.exit,
      doorsClosed: true,
    }).accepted,
    false,
  );
  assert.deepEqual(r.state.completed, [id]);
});

test("C bounds warning, return, failure cleanup and retry preserve earlier completion", () => {
  const r = runner();
  complete(r, "promise-junction");
  enter(r, "committee-lane");
  const id = "committee-lane",
    outside = { x: 80, z: -10 };
  const status = (position = outside, resolve = 100) =>
    dispatch(r, {
      type: "player-status",
      missionId: id,
      position,
      resolve,
      elapsedSeconds: 1,
      tutorialSafe: false,
    });
  assert.equal(
    status().effects.filter((e) => e.type === "bounds-warning").length,
    1,
  );
  assert.equal(status().effects.length, 0);
  status(areaById(id).entrance);
  assert.equal(r.state.missions[id].outsideSeconds, 0);
  for (let i = 0; i < 8; i++) status();
  assert.equal(r.state.missions[id].phase, "failed");
  assert.equal(r.state.missions[id].failure, "bounds");
  assert.equal(
    dispatch(r, { type: "retry", missionId: id, routeReady: true }).accepted,
    false,
  );
  assert.equal(
    dispatch(r, {
      type: "failure-cleaned",
      missionId: id,
      safeEntrance: true,
      actorsReady: true,
    }).accepted,
    true,
  );
  assert.equal(
    dispatch(r, { type: "retry", missionId: id, routeReady: true }).accepted,
    true,
  );
  assert.equal(r.state.missions[id].attempt, 2);
  assert.equal(r.state.missions[id].resolve, 100);
  assert.deepEqual(r.state.completed, ["promise-junction"]);
  dispatch(r, {
    type: "enter",
    missionId: id,
    position: areaById(id).entrance,
    sectorReady: true,
    tutorialSafe: false,
  });
  status(areaById(id).entrance, 0);
  assert.equal(r.state.missions[id].failure, "player");
});

test("C tutorial gate prevents hits and dangerous failure observations", () => {
  const r = runner(),
    id = "promise-junction";
  enter(r, id);
  const before = r.state;
  assert.equal(
    dispatch(r, {
      type: "impact",
      missionId: id,
      projectileId: "lesson",
      item: "egg",
      target: "leader",
      observed: true,
      tutorialSafe: true,
    }).accepted,
    false,
  );
  assert.equal(
    dispatch(r, {
      type: "player-status",
      missionId: id,
      position: { x: 100, z: 100 },
      resolve: 0,
      elapsedSeconds: 1,
      tutorialSafe: true,
    }).accepted,
    false,
  );
  assert.equal(r.state, before);
});

test("C all five completion facts survive checkpoint and corrupted records repair independently", () => {
  const r = runner();
  for (const area of worldAreas) {
    assert.equal(nextMissionId(r.state), area.id);
    assert.equal(complete(r, area.id).accepted, true);
  }
  assert.equal(nextMissionId(r.state), null);
  assert.equal(r.state.completed.length, 5);
  assert.deepEqual(parseMissionCheckpoint(missionCheckpoint(r.state)), r.state);
  const damaged = JSON.parse(missionCheckpoint(r.state));
  damaged.missions["poster-quarter"].resolve = NaN;
  const repaired = parseMissionCheckpoint(damaged);
  assert.equal(repaired.missions["poster-quarter"].phase, "undiscovered");
  assert.equal(repaired.completed.length, 4);
  assert.equal(repaired.missions["power-house"].phase, "completed");
  assert.deepEqual(parseMissionCheckpoint("{broken"), newMatchMissions());
  assert.deepEqual(
    parseMissionCheckpoint({ ...r.state, worldVersion: "another-world" }),
    newMatchMissions(),
  );
});

test("C stale sequence and replayed effect cannot award another result", () => {
  const r = runner();
  enter(r, "promise-junction");
  const e: MissionEvent = {
    seq: r.state.sequence + 1,
    missionId: "promise-junction",
    type: "impact",
    projectileId: "once",
    item: "sandal",
    target: "leader",
    observed: true,
    tutorialSafe: false,
  };
  const first = reduceMission(r.state, e);
  assert.equal(first.accepted, true);
  assert.equal(reduceMission(first.state, e).accepted, false);
  const resumed: MatchMissionState = parseMissionCheckpoint(
    missionCheckpoint(first.state),
  );
  assert.equal(
    reduceMission(resumed, { ...e, seq: resumed.sequence + 1 }).accepted,
    false,
  );
});
