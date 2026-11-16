import assert from "node:assert/strict";
import { test } from "node:test";
import {
  newCombatRecord,
  parseCombatRecord,
  recordCombatHit,
} from "../packages/shared/src/combat.ts";
import {
  newMatchMissions,
  parseMissionCheckpoint,
  reduceMission,
  type MissionEvent,
} from "../packages/shared/src/missions.ts";
import { worldAreas } from "../packages/shared/src/world-layout.ts";
import { createNewspaper } from "../apps/game/src/newspaper.ts";

test("civilian contact resets the combo, gives zero points, and changes the Bengali ending", () => {
  const record = newCombatRecord();
  record.used.baton = 2;
  record.used.sound = 1;
  record.elapsed = 127.9;
  record.evidence = ["promise-junction", "committee-lane", "power-house"];
  const completed = worldAreas.map(({ id }) => id);
  const first = recordCombatHit(record, "baton", "worker", 0);
  const second = recordCombatHit(record, "sound", "leader", first.combo);
  assert.deepEqual(second, { reward: 15, combo: 2 });
  const calm = createNewspaper(
    completed,
    record,
    "photo",
    new Date("2026-11-05T04:00:00Z"),
  );
  const civilian = recordCombatHit(record, "spark", "civilian", second.combo);
  assert.deepEqual(civilian, { reward: 0, combo: 0 });
  const angry = createNewspaper(
    completed,
    record,
    "photo",
    new Date("2026-11-05T04:00:00Z"),
  );
  assert.equal(angry.score, 27);
  assert.equal(angry.bestCombo, 2);
  assert.equal(angry.outrage, 14);
  assert.notEqual(angry.headline, calm.headline);
  assert.match(angry.article, /পথচারীর গায়ে লেগেছে ১ বার/);
  assert.equal(angry.areas.length, 5);
  assert.equal(angry.evidence.length, 3);
  assert.equal(
    angry.used.find(({ label }) => label === "ফোলানো লাঠি")?.count,
    2,
  );
  assert.equal(angry.elapsed, 127);
  assert.equal(angry.image, "photo");
});

test("mixed action hits require a real encounter and final evacuation to finish each area", () => {
  let state = newMatchMissions();
  type Event = MissionEvent extends infer E
    ? E extends MissionEvent
      ? Omit<E, "seq">
      : never
    : never;
  function send(event: Event) {
    const result = reduceMission(state, {
      ...event,
      seq: state.sequence + 1,
    } as MissionEvent);
    if (result.accepted) state = result.state;
    return result;
  }
  for (const area of worldAreas) {
    assert.ok(
      send({ type: "select", missionId: area.id, routeReady: true }).accepted,
    );
    assert.ok(
      send({
        type: "enter",
        missionId: area.id,
        position: area.entrance,
        sectorReady: true,
        tutorialSafe: false,
      }).accepted,
    );
    const hit = {
      type: "impact",
      missionId: area.id,
      target: "leader",
      observed: true,
      tutorialSafe: false,
    } as const;
    const first = {
      ...hit,
      item: "sound" as const,
      projectileId: `${area.id}-sound`,
    };
    assert.ok(send(first).accepted);
    assert.equal(send(first).accepted, false);
    assert.ok(
      send({ ...hit, item: "spark", projectileId: `${area.id}-spark` })
        .accepted,
    );
    assert.ok(
      send({ ...hit, item: "baton", projectileId: `${area.id}-baton` })
        .accepted,
    );
    assert.equal(state.missions[area.id].resolve, 14);
    assert.ok(
      send({ ...hit, item: "egg", projectileId: `${area.id}-egg` }).accepted,
    );
    assert.equal(state.missions[area.id].phase, "evacuation");
    const exit = {
      type: "ambulance-exited",
      missionId: area.id,
      position: area.ambulance.exit,
      doorsClosed: true,
    } as const;
    assert.equal(send(exit).accepted, false);
    assert.ok(
      send({
        type: "ambulance-loaded",
        missionId: area.id,
        leaderLoaded: true,
        personnelSafe: true,
      }).accepted,
    );
    assert.ok(send(exit).accepted);
  }
  const restored = parseMissionCheckpoint(
    JSON.stringify({ ...state, combat: { record: newCombatRecord() } }),
  );
  assert.deepEqual(
    restored.completed,
    worldAreas.map(({ id }) => id),
  );
  assert.equal(restored.activeId, null);
  assert.deepEqual(parseCombatRecord(undefined), newCombatRecord());
  assert.deepEqual(
    parseCombatRecord({ evidence: ["power-house", "fake", "power-house"] })
      .evidence,
    ["power-house"],
  );
});
