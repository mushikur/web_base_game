import assert from "node:assert/strict";
import { test } from "node:test";
import {
  worldAreas,
  worldHeightAt,
} from "../packages/shared/src/world-layout.ts";
import {
  pathfindWorld,
  worldCanWalk,
  type NavigationObstacle,
} from "../packages/shared/src/navigation.ts";
import { allSectorObstacles } from "../apps/game/src/sectorBlueprints.ts";
import { EvacuationController } from "../apps/game/src/evacuation.ts";
import { ambulanceAnchorsAt } from "../apps/game/src/ambulanceGeometry.ts";
import {
  rotatedFootprintClear,
  rotatedVehicleContains,
  ambulanceNavigationObstacles,
} from "../apps/game/src/missionClearance.ts";
import type { AIPose } from "../apps/game/src/missionAI.ts";
import { MissionActorAI } from "../apps/game/src/missionAI.ts";

// Exactly the protected world's physical walking footprints, including its
// median, raised speech dais, CNG, bus, counter and utility poles.
const hub: NavigationObstacle[] = [
  { x: -12, z: 2, w: 8, d: 48 },
  { x: 12, z: 2, w: 8, d: 48 },
  { x: -6.7, z: 0.2, w: 1.25, d: 6 },
  { x: 1.8, z: 10.6, w: 4, d: 3 },
  { x: -4.1, z: -3.7, w: 1.6, d: 2.8 },
  { x: 4, z: 2, w: 1.6, d: 2.9 },
  { x: 3.1, z: 21.5, w: 2.6, d: 8.3 },
  { x: -0.2, z: 18.5, w: 0.7, d: 10 },
  { x: -7.2, z: -13.5, w: 0.45, d: 0.45 },
  { x: 7.2, z: 11.7, w: 0.45, d: 0.45 },
];
const obstacles = [...hub, ...allSectorObstacles];
const pose = (x: number, z: number, yaw = 0): AIPose => ({
  x,
  z,
  y: worldHeightAt(x, z),
  yaw,
});
test("full rotated body detects thin posts, inside-body NPCs and conservative walking detours", () => {
  const p = pose(0, 0, Math.PI / 4);
  assert.equal(
    rotatedFootprintClear(
      p,
      [{ x: 0.3, z: 0.1, w: 0.11, d: 0.11 }],
      () => true,
    ),
    false,
  );
  assert.equal(
    rotatedFootprintClear(p, [], () => true, [{ x: 0, z: 0 }]),
    false,
  );
  assert.equal(rotatedVehicleContains({ x: 0.3, z: 0.1 }, p, 0.32), true);
  assert.equal(rotatedVehicleContains({ x: 4, z: 4 }, p, 0.32), false);
  const body = ambulanceNavigationObstacles(p)[0];
  assert.ok(body.w > 5 && body.d > 5);
});
test("all5 authored ambulance approaches clear their complete actual body footprint", () => {
  for (const area of worldAreas) {
    const route = area.ambulance.approach;
    for (let segment = 1; segment < route.length; segment++) {
      const a = route[segment - 1],
        b = route[segment],
        span = Math.hypot(b.x - a.x, b.z - a.z),
        steps = Math.ceil(span / 0.1),
        yaw = Math.atan2(b.x - a.x, b.z - a.z);
      for (let i = 0; i <= steps; i++) {
        const p = pose(
          a.x + ((b.x - a.x) * i) / steps,
          a.z + ((b.z - a.z) * i) / steps,
          yaw,
        );
        assert.equal(
          rotatedFootprintClear(p, obstacles, (x, z) =>
            worldCanWalk(x, z, obstacles, 0.02),
          ),
          true,
          `${area.id}: full ambulance body at ${JSON.stringify(p)}`,
        );
      }
    }
  }
});
test("each real area can evacuate a leader from its dais/escape position via actual body-safe doors", () => {
  for (const area of worldAreas) {
    const bodyObstacles = () => [
      ...obstacles,
      ...ambulanceNavigationObstacles(controller.snapshot.ambulance),
    ];
    const controller: EvacuationController = new EvacuationController({
      heightAt: worldHeightAt,
      anchors: ambulanceAnchorsAt,
      canVehicleStand: (x, z, yaw) =>
        rotatedFootprintClear(pose(x, z, yaw), obstacles, (a, b) =>
          worldCanWalk(a, b, obstacles, 0.02),
        ),
      canActorStand: (x, z, _who, interior) =>
        worldCanWalk(x, z, interior ? obstacles : bodyObstacles(), 0.32),
      pathTo: (from, to, _who, interior) => {
        const result = pathfindWorld(
          from,
          to,
          interior ? obstacles : bodyObstacles(),
          0.32,
        );
        return result.ok ? result.points : undefined;
      },
    });
    const leader =
      area.id === "promise-junction" ? area.leader : area.escapeRoute.at(-1)!;
    assert.equal(
      controller.request(
        { missionId: area.id, ...area.ambulance },
        pose(leader.x, leader.z),
      ),
      true,
      `${area.id} approach must start`,
    );
    const stages = new Set<string>();
    for (
      let frame = 0;
      frame < 24000 && controller.state !== "completed";
      frame++
    ) {
      const s = controller.tick(1 / 60);
      stages.add(s.stage);
    }
    assert.equal(
      controller.state,
      "completed",
      `${area.id}: stuck ${JSON.stringify(controller.snapshot)} stages=${[...stages]}`,
    );
    assert.ok(
      stages.has("assist") && stages.has("load") && stages.has("depart"),
    );
  }
});
test("an occupied actual hub bay waits until the worker really yields to the approaching siren", () => {
  const area = worldAreas[0];
  const worker = new MissionActorAI({
    id: "হাসান কর্মী",
    role: "worker",
    pose: pose(-2.6, 8.2),
    clear: (x, z) => worldCanWalk(x, z, obstacles, 0.32),
    heightAt: worldHeightAt,
    pathTo: (from, to, radius) => {
      const route = pathfindWorld(from, to, obstacles, radius);
      return route.ok ? route.points : undefined;
    },
  });
  const controller = new EvacuationController({
    heightAt: worldHeightAt,
    anchors: ambulanceAnchorsAt,
    canVehicleStand: (x, z, yaw) =>
      rotatedFootprintClear(
        pose(x, z, yaw),
        obstacles,
        (a, b) => worldCanWalk(a, b, obstacles, 0.02),
        [worker.pose],
      ),
    canActorStand: (x, z) => worldCanWalk(x, z, obstacles, 0.32),
    pathTo: (from, to) => {
      const path = pathfindWorld(from, to, obstacles, 0.32);
      return path.ok ? path.points : undefined;
    },
  });
  assert.equal(
    controller.request(
      { missionId: area.id, ...area.ambulance },
      pose(area.leader.x, area.leader.z),
    ),
    true,
  );
  for (let frame = 0; frame < 1200 && !controller.snapshot.blocked; frame++)
    controller.tick(1 / 60);
  assert.equal(controller.snapshot.blocked, true);
  assert.equal(controller.state, "approach");
  const stopped = { ...controller.snapshot.ambulance };
  for (let frame = 0; frame < 180; frame++) controller.tick(1 / 60);
  assert.deepEqual(controller.snapshot.ambulance, stopped);
  for (
    let frame = 0;
    frame < 18000 && controller.snapshot.stage !== "completed";
    frame++
  ) {
    const s = controller.snapshot;
    worker.tick(1 / 60, {
      player: { x: -6, z: -6 },
      leader: area.leader,
      active: true,
      siren: s.siren ? s.ambulance : undefined,
    });
    controller.tick(1 / 60);
  }
  assert.ok(worker.distanceMoved > 2.5);
  assert.equal(controller.state, "completed");
});
test("all5 full evacuations and every hub cover/escape anchor retain real crew occupancy", () => {
  const hubArea = worldAreas[0];
  const starts = [
    ...worldAreas.map((area) => ({
      area,
      leaderStart:
        area.id === "promise-junction" ? area.leader : area.escapeRoute.at(-1)!,
    })),
    ...[...hubArea.cover, ...hubArea.escapeRoute].map((leaderStart) => ({
      area: hubArea,
      leaderStart,
    })),
    // The rendered gameplay's real third-sandal defeat was just off its cover
    // anchor; cover validation must not depend on exact authored coordinates.
    { area: hubArea, leaderStart: { x: 1.19423, z: 16.044055 } },
  ];
  for (const { area, leaderStart } of starts) {
    let rendered = {
      leader: pose(leaderStart.x, leaderStart.z),
      medics: [pose(0, 0), pose(0, 0)],
    };
    const player = { x: area.center.x - 6, z: area.center.z - 10 };
    const controller: EvacuationController = new EvacuationController({
      heightAt: worldHeightAt,
      anchors: ambulanceAnchorsAt,
      canVehicleStand: (x, z, yaw) => {
        const s = controller.snapshot;
        const occupants = [
          player,
          ...(s.leaderAttached ? [] : [rendered.leader]),
          ...rendered.medics.filter((_p, i) => !s.medicsAttached[i]),
        ];
        return rotatedFootprintClear(
          pose(x, z, yaw),
          obstacles,
          (a, b) => worldCanWalk(a, b, [], 0.02),
          occupants,
        );
      },
      canActorStand: (x, z, who, interior = false) => {
        if (
          !worldCanWalk(x, z, obstacles, 0.32) ||
          Math.hypot(x - player.x, z - player.z) < 0.7
        )
          return false;
        const s = controller.snapshot;
        if (!interior && rotatedVehicleContains({ x, z }, s.ambulance, 0.32))
          return false;
        return [
          { id: "leader", p: s.leader },
          ...s.medics.map((p, i) => ({ id: `medic-${i}`, p })),
        ].every(
          (actor) =>
            actor.id === who || Math.hypot(x - actor.p.x, z - actor.p.z) > 0.62,
        );
      },
      pathTo: (from, to, who, interior = false) => {
        const s = controller.snapshot;
        const people = [
          { id: "leader", p: s.leader },
          ...s.medics.map((p, i) => ({ id: `medic-${i}`, p })),
        ]
          .filter((a) => a.id !== who)
          .map((a) => ({ x: a.p.x, z: a.p.z, w: 0.6, d: 0.6 }));
        const result = pathfindWorld(from, to, [
          ...obstacles,
          ...(!interior
            ? ambulanceNavigationObstacles(controller.snapshot.ambulance)
            : []),
          ...people,
          { ...player, w: 0.76, d: 0.76 },
        ]);
        return result.ok ? result.points : undefined;
      },
      staticPathTo: (from, to, _who, interior = false) => {
        const result = pathfindWorld(from, to, [
          ...obstacles,
          ...(!interior
            ? ambulanceNavigationObstacles(controller.snapshot.ambulance)
            : []),
          { ...player, w: 0.76, d: 0.76 },
        ]);
        return result.ok ? result.points : undefined;
      },
    });
    assert.equal(
      controller.request(
        { missionId: area.id, ...area.ambulance },
        rendered.leader,
      ),
      true,
    );
    for (
      let frame = 0;
      frame < 18000 && controller.state !== "completed";
      frame++
    ) {
      const previous = controller.snapshot;
      const s = controller.tick(1 / 60);
      const people = [s.leader, ...s.medics];
      for (let i = 0; i < people.length; i++)
        for (let j = i + 1; j < people.length; j++)
          assert.ok(
            Math.hypot(people[i].x - people[j].x, people[i].z - people[j].z) >
              0.62,
            `${area.id}: leader/medic occupied body envelopes must stay separated`,
          );
      [previous.leader, ...previous.medics].forEach((before, i) =>
        assert.ok(
          Math.hypot(people[i].x - before.x, people[i].z - before.z) < 0.12,
          `${area.id}: occupied crew move continuously, including attachment`,
        ),
      );
      rendered = { leader: s.leader, medics: s.medics };
    }
    assert.equal(
      controller.state,
      "completed",
      `${area.id} from ${JSON.stringify(leaderStart)}: dynamic occupancy deadlocked ${JSON.stringify(controller.snapshot)}`,
    );
  }
});
