import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pathfindWorld,
  worldCanWalk,
  segmentClear,
  type NavigationObstacle,
} from "../packages/shared/src/navigation.ts";
import {
  worldAreas,
  areaById,
  worldToMap,
  worldBounds,
  worldSurfaceAt,
  worldHeightAt,
  onHubDais,
  onHubRamp,
  pointInRect,
  type Point2,
} from "../packages/shared/src/world-layout.ts";
import {
  streetHeightAt,
  streetSurfaceAt,
} from "../packages/shared/src/street-surfaces.ts";
import { factorySpawnRegistry } from "../packages/shared/src/spawns.ts";
import { allSectorObstacles } from "../apps/game/src/sectorBlueprints.ts";
import {
  ambulanceNavigationObstacles,
  rotatedVehicleContains,
} from "../apps/game/src/missionClearance.ts";

test("C navigation normalizes getter-backed runtime vectors for direct and detour routes", () => {
  class RuntimePoint {
    _x: number;
    _z: number;
    constructor(x: number, z: number) {
      this._x = x;
      this._z = z;
    }
    get x() {
      return this._x;
    }
    get z() {
      return this._z;
    }
  }
  const start = new RuntimePoint(6, 34),
    goal = new RuntimePoint(14, 34);
  assert.equal(Object.hasOwn(start, "x"), false);
  for (const obstacles of [[], [{ x: 10, z: 34, w: 2, d: 2 }]]) {
    const path = pathfindWorld(start, goal, obstacles);
    assert.equal(path.ok, true);
    assert.deepEqual(path.points[0], { x: 6, z: 34 });
    assert.deepEqual(path.points.at(-1), { x: 14, z: 34 });
    for (const p of path.points)
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
    for (let i = 1; i < path.points.length; i++)
      assert.equal(
        segmentClear(path.points[i - 1], path.points[i], obstacles),
        true,
      );
  }
});

// Authored B blocker footprints relevant to the actual protected hub routes.
const hub: NavigationObstacle[] = [
  { x: -12, z: 2, w: 8, d: 48 },
  { x: 12, z: 2, w: 8, d: 48 },
  { x: -6.7, z: 0.2, w: 1.25, d: 6 },
  { x: 1.8, z: 10.6, w: 4, d: 3 },
  { x: -4.1, z: -3.7, w: 1.6, d: 2.8 },
  { x: 4, z: 2, w: 1.64, d: 2.82 },
  { x: 3.1, z: 21.5, w: 2.6, d: 8.3 },
  { x: -0.2, z: 18.5, w: 0.7, d: 10 },
  { x: -7.2, z: -13.5, w: 0.45, d: 0.45 },
  { x: 7.2, z: 11.7, w: 0.45, d: 0.45 },
];
test("C connected roads reach all five entrances from B's protected starts without wall crossing", () => {
  for (const spawn of factorySpawnRegistry.locations.slice(0, 3)) {
    assert.equal(worldCanWalk(spawn.x, spawn.z, hub, 0.42), true);
    for (const area of worldAreas) {
      const result = pathfindWorld(spawn, area.entrance, hub, 0.32);
      assert.equal(
        result.ok,
        true,
        `${spawn.id} to ${area.id}: ${result.message}`,
      );
      for (let i = 1; i < result.points.length; i++)
        assert.equal(
          segmentClear(result.points[i - 1], result.points[i], hub, 0.32),
          true,
        );
    }
  }
});

test("C hub pedestrian gap accepts on-foot radius while the ambulance uses the wide west lane", () => {
  assert.equal(
    segmentClear({ x: 0.9, z: 16 }, { x: 0.9, z: 27 }, hub, 0.32),
    true,
  );
  assert.equal(
    segmentClear({ x: 0.9, z: 16 }, { x: 0.9, z: 27 }, hub, 1.1),
    false,
  );
  const ambulance = areaById("promise-junction").ambulance;
  for (let i = 1; i < ambulance.approach.length; i++)
    assert.equal(
      segmentClear(ambulance.approach[i - 1], ambulance.approach[i], hub, 1.1),
      true,
    );
  assert.equal(
    segmentClear({ x: 0, z: 12 }, { x: 0, z: 26 }, hub, 0.32),
    false,
  );
});

test("C paths reject unbuilt land, inflated blocked corners and a closed road", () => {
  assert.equal(worldCanWalk(-28, 0, [], 0.32), false);
  assert.equal(
    segmentClear({ x: 0, z: 34 }, { x: -48, z: 52 }, [], 0.32),
    false,
  );
  assert.equal(worldCanWalk(1000, 1000, [], 0.32), false);
  assert.equal(worldCanWalk(NaN, 34, [], 0.32), false);
  const wall = [{ x: -24, z: 34, w: 2, d: 30 }];
  assert.equal(
    pathfindWorld({ x: -2, z: 34 }, areaById("committee-lane").entrance, wall)
      .ok,
    false,
  );
  const tiny = [{ x: 10, z: 34, w: 2, d: 2 }];
  assert.equal(worldCanWalk(8.8, 34, tiny, 0.32), false);
  assert.equal(
    segmentClear({ x: 8, z: 34 }, { x: 12, z: 34 }, tiny, 0.32),
    false,
  );
  const detour = pathfindWorld({ x: 6, z: 34 }, { x: 14, z: 34 }, tiny);
  assert.equal(detour.ok, true);
  assert.ok(detour.points.some((p) => Math.abs(p.z - 34) > 1.32));
});

test("C committee route detours around the retained hub ambulance's whole solid body", () => {
  const start = { x: 0, z: 34 },
    goal = areaById("committee-lane").entrance,
    retiredVan = {
      ...areaById("promise-junction").ambulance.exit,
      y: 0,
      yaw: Math.PI,
    },
    staticObstacles = [...hub, ...allSectorObstacles],
    liveObstacles = [
      ...staticObstacles,
      ...ambulanceNavigationObstacles(retiredVan),
    ];
  assert.deepEqual(retiredVan, { x: -2.6, z: 34, y: 0, yaw: Math.PI });
  const staticRoute = pathfindWorld(start, goal, staticObstacles);
  assert.equal(staticRoute.ok, true);
  assert.ok(
    staticRoute.points.some(
      (point, index) =>
        index > 0 &&
        !segmentClear(staticRoute.points[index - 1], point, liveObstacles),
    ),
    "static-only guidance crosses the still-visible completed ambulance",
  );
  const route = pathfindWorld(start, goal, liveObstacles);
  assert.equal(route.ok, true, route.message);
  assert.deepEqual(route.points[0], start);
  assert.deepEqual(route.points.at(-1), goal);
  assert.ok(route.distance > staticRoute.distance);
  for (let i = 1; i < route.points.length; i++) {
    const from: Point2 = route.points[i - 1],
      to: Point2 = route.points[i];
    assert.equal(segmentClear(from, to, liveObstacles), true);
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.1);
    for (let step = 0; step <= steps; step++) {
      const t = step / steps,
        point = {
          x: from.x + (to.x - from.x) * t,
          z: from.z + (to.z - from.z) * t,
        };
      assert.equal(
        rotatedVehicleContains(point, retiredVan, 0.32),
        false,
        "every on-foot route sample clears the full retained vehicle plus player radius",
      );
    }
  }
});

test("C area anchors and evacuation route endpoints remain in authored walkable bounds", () => {
  for (const area of worldAreas.slice(1)) {
    const points = [
      area.entrance,
      area.leader,
      ...area.workers,
      ...area.crowd,
      ...area.civilians,
      area.teaShop,
      area.parking,
      ...area.cover,
      ...area.escapeRoute,
      ...area.ambulance.approach,
      ...area.ambulance.exitRoute,
    ];
    for (const p of points)
      assert.equal(
        worldCanWalk(p.x, p.z, [], 0.32),
        true,
        `${area.id} anchor ${JSON.stringify(p)}`,
      );
    for (const p of area.escapeRoute)
      assert.equal(pointInRect(p, area.encounterBounds), true);
    assert.deepEqual(area.ambulance.approach.at(-1), area.ambulance.bay);
    assert.deepEqual(area.ambulance.exitRoute.at(-1), area.ambulance.exit);
    for (let i = 1; i < area.ambulance.approach.length; i++)
      assert.equal(
        segmentClear(
          area.ambulance.approach[i - 1],
          area.ambulance.approach[i],
          [],
          1.1,
        ),
        true,
      );
  }
});

test("C every actor reset anchor clears the real outer-sector geometry and parked CNG", () => {
  const blockers = [...hub, ...allSectorObstacles];
  for (const area of worldAreas.slice(1)) {
    const anchors = [
      area.leader,
      ...area.workers,
      ...area.crowd,
      ...area.civilians,
    ];
    for (const anchor of anchors)
      assert.equal(
        worldCanWalk(anchor.x, anchor.z, blockers, 0.32),
        true,
        `${area.id} actor reset anchor ${JSON.stringify(anchor)}`,
      );
    const parked = { ...area.parking, y: 0.2, yaw: Math.PI };
    for (const civilian of area.civilians) {
      assert.equal(
        worldCanWalk(civilian.x, civilian.z - 1.5, blockers, 0.32) ||
          worldCanWalk(civilian.x, civilian.z + 1.5, blockers, 0.32),
        true,
        `${area.id} civilian has a reachable direction from its reset base`,
      );
      // The parked-body metadata participates in the check above; retain the
      // actual authored home/vehicle separation as an independent safeguard.
      assert.ok(Math.hypot(civilian.x - parked.x, civilian.z - parked.z) > 1.5);
    }
  }
});

test("C routes use the actual resident outer-sector collision blueprints", () => {
  const blockers = [...hub, ...allSectorObstacles];
  const from = { x: -6.3, z: -16 };
  for (const area of worldAreas.slice(1)) {
    const destinations = [
      area.entrance,
      area.leader,
      ...area.workers,
      area.teaShop,
      ...area.pickups.map((p) => p.position),
      ...area.cover,
      ...area.escapeRoute,
      // A parked CNG's center is occupied; walk to its actual boarding side.
      { x: area.parking.x + 1.38, z: area.parking.z + 0.08 },
    ];
    for (const goal of destinations) {
      const route = pathfindWorld(from, goal, blockers);
      assert.equal(route.ok, true, `${area.id}: ${JSON.stringify(goal)}`);
      for (let i = 1; i < route.points.length; i++)
        assert.equal(
          segmentClear(route.points[i - 1], route.points[i], blockers),
          true,
        );
    }
    for (let i = 1; i < area.ambulance.approach.length; i++)
      assert.equal(
        segmentClear(
          area.ambulance.approach[i - 1],
          area.ambulance.approach[i],
          blockers,
          1.1,
        ),
        true,
        `${area.id} ambulance approach ${i}`,
      );
    for (let i = 1; i < area.ambulance.exitRoute.length; i++)
      assert.equal(
        segmentClear(
          area.ambulance.exitRoute[i - 1],
          area.ambulance.exitRoute[i],
          blockers,
          1.1,
        ),
        true,
        `${area.id} ambulance exit ${i}`,
      );
    for (const route of [area.ambulance.approach, area.ambulance.exitRoute]) {
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1],
          b = route[i],
          yaw = Math.atan2(b.x - a.x, b.z - a.z);
        const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.2);
        for (let step = 0; step <= steps; step++)
          for (const lx of [-1.1, 0, 1.1])
            for (const lz of [-2.53, 0, 2.53]) {
              const x =
                a.x +
                ((b.x - a.x) * step) / steps +
                Math.cos(yaw) * lx +
                Math.sin(yaw) * lz;
              const z =
                a.z +
                ((b.z - a.z) * step) / steps -
                Math.sin(yaw) * lx +
                Math.cos(yaw) * lz;
              assert.equal(
                worldCanWalk(x, z, blockers, 0.02),
                true,
                `${area.id} ambulance footprint ${x}/${z}`,
              );
            }
      }
    }
  }
});

test("C surface facade preserves every sampled hub surface and height exactly", () => {
  for (let x = -7.5; x <= 7.5; x += 0.25)
    for (let z = -18; z <= 22; z += 0.25) {
      if (!onHubDais(x, z) && !onHubRamp(x, z)) {
        assert.equal(worldSurfaceAt(x, z), streetSurfaceAt(x, z));
        assert.equal(worldHeightAt(x, z), streetHeightAt(x, z));
      }
    }
  const committee = areaById("committee-lane");
  assert.equal(
    worldSurfaceAt(committee.teaShop.x, committee.teaShop.z),
    "shop",
  );
  assert.equal(
    worldSurfaceAt(committee.center.x + 7, committee.center.z),
    "brick",
  );
  assert.equal(worldHeightAt(committee.center.x + 7, committee.center.z), 0.2);
});

test("C original platform has a real traversable east ramp without a walk-through ledge", () => {
  const leader = areaById("promise-junction").leader;
  assert.equal(worldCanWalk(leader.x, leader.z, hub), true);
  assert.equal(worldHeightAt(leader.x, leader.z), 0.46);
  assert.ok(Math.abs(worldHeightAt(4.4, 10.6) - 0.23) < 1e-8);
  assert.equal(worldHeightAt(5, 10.6), 0);
  assert.equal(segmentClear(leader, { x: 5, z: 10.6 }, hub), true);
  assert.equal(segmentClear(leader, { x: -1, z: 10.6 }, hub), false);
  const approach = pathfindWorld({ x: 4.8, z: 8 }, leader, hub);
  assert.equal(approach.ok, true);
  assert.ok(
    approach.points.some((p) => p.x >= 4.8 && Math.abs(p.z - 10.6) < 0.1),
  );
  assert.equal(segmentClear({ x: 5, z: 10.6 }, { x: 6, z: 10.6 }, hub), true);
});

test("C map transform uses world bounds and all visible content uses Bengali Unicode", () => {
  assert.deepEqual(worldToMap({ x: worldBounds.minX, z: worldBounds.maxZ }), {
    x: 0,
    y: 0,
  });
  assert.deepEqual(worldToMap({ x: worldBounds.maxX, z: worldBounds.minZ }), {
    x: 1,
    y: 1,
  });
  for (const area of worldAreas)
    for (const text of [area.name, area.leaderName, area.objective]) {
      assert.match(text, /\p{Script=Bengali}/u);
      assert.doesNotMatch(text, /\p{Script=Devanagari}|\ufffd/u);
    }
});
