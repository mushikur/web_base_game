import {
  worldAreas,
  roadCorridors,
  corridorRect,
  type AreaId,
  type WorldArea,
  type Point2,
} from "../../../packages/shared/src/world-layout.ts";
import type { SectorRegion } from "./sectorPolicy.ts";

export type SectorObstacle = {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
};
export type BuildingSpec = SectorObstacle & {
  floors: number;
  shop: string;
  tint: string;
  kind: "tailor" | "print" | "tea" | "grocer" | "office";
};
const intersectsRoad = (b: SectorObstacle) =>
  roadCorridors.some((r) => {
    const rect = corridorRect(r);
    return (
      b.x + b.w / 2 > rect.minX - 0.5 &&
      b.x - b.w / 2 < rect.maxX + 0.5 &&
      b.z + b.d / 2 > rect.minZ - 0.5 &&
      b.z - b.d / 2 < rect.maxZ + 0.5
    );
  });

/** These footprints are resident metadata. Render streaming cannot make an
 * unloaded wall cease to exist for route selection or safe spawn validation. */
export function sectorBuildings(area: WorldArea): BuildingSpec[] {
  const p = (x: number, z: number) => ({
    x: area.center.x + x,
    z: area.center.z + z,
  });
  const buildings: BuildingSpec[] = [
    {
      id: `${area.id}:south-west`,
      ...p(-12, -13),
      w: 7,
      d: 6,
      h: 10.5,
      floors: 3,
      shop: "বন্ধন বস্ত্রালয়",
      tint: "#c5b9a4",
      kind: "tailor",
    },
    {
      id: `${area.id}:south-east`,
      ...p(12, -13),
      w: 7,
      d: 6,
      h: 13.2,
      floors: 4,
      shop: "ভাই ভাই ভাণ্ডার",
      tint: "#a9bdb2",
      kind: "grocer",
    },
    {
      id: `${area.id}:north-west`,
      ...p(-12, 13),
      w: 7,
      d: 6,
      h: 13.2,
      floors: 4,
      shop: "নতুন সকাল ছাপাখানা",
      tint: "#c3afa5",
      kind: "print",
    },
    {
      id: `${area.id}:north-east`,
      ...p(12, 13),
      w: 7,
      d: 6,
      h: 10.5,
      floors: 3,
      shop: "আড্ডা সমিতি",
      tint: "#b8c0b3",
      kind: "office",
    },
  ];
  if (area.id === "committee-lane") {
    buildings[0].shop = "সেলাই সংসদ";
    buildings[1].shop = "কমিটি কাপড় ঘর";
    buildings[2].shop = "মামার গামছা";
  } else if (area.id === "poster-quarter") {
    buildings[0].shop = "পোস্টার পট্টি ছাপাখানা";
    buildings[1].shop = "রঙতুলি বাঁধাই ঘর";
    buildings[2].shop = "কাগজের প্রতিশ্রুতি";
    buildings[1].kind = "print";
  } else if (area.id === "microphone-square") {
    buildings[0].shop = "মাইক মেরামত কেন্দ্র";
    buildings[1].shop = "সুরের তার ইলেকট্রনিক্স";
  }
  if (area.id === "power-house")
    buildings.push({
      id: `${area.id}:office`,
      ...p(0, 16),
      w: 16,
      d: 4,
      h: 13.5,
      floors: 4,
      shop: "ক্ষমতা ভবন",
      tint: "#bdb8a5",
      kind: "office",
    });
  return buildings.filter((b) => !intersectsRoad(b));
}
export const areaRegions: SectorRegion[] = worldAreas
  .filter((a) => a.id !== "promise-junction")
  .map((area) => ({ id: area.id, ...area.bounds, encounter: true }));
export const connectorRegions: SectorRegion[] = roadCorridors.map((road) => ({
  id: `road:${road.id}`,
  ...corridorRect(road),
  encounter: false,
}));
export const sectorRegions: SectorRegion[] = [
  ...areaRegions,
  ...connectorRegions,
];

export type SectorActorAnchor = Point2 & {
  id: string;
  areaId: AreaId;
  role: "leader" | "worker" | "civilian";
  behavior: "leader" | "worker" | "crowd" | "civilian";
  name: string;
  yaw: number;
  route: Point2[];
};
export function sectorActorAnchors(area: WorldArea): SectorActorAnchor[] {
  const anchor = (
    id: string,
    point: Point2,
    role: SectorActorAnchor["role"],
    behavior: SectorActorAnchor["behavior"],
    name: string,
    route: Point2[] = [],
  ): SectorActorAnchor => ({
    id: `${area.id}:${id}`,
    areaId: area.id,
    ...point,
    role,
    behavior,
    name,
    yaw: Math.PI,
    route,
  });
  const workers = ["হাসান ব্যানার", "মিজান মিছিল", "বাবুল স্লোগান"];
  const civilians = ["নাসিমা আপা", "আজাদ ভাই", "ফারুক চাচা"];
  return [
    anchor(
      "leader",
      area.leader,
      "leader",
      "leader",
      area.leaderName,
      area.escapeRoute,
    ),
    ...area.workers.map((p, i) =>
      anchor(`worker-${i}`, p, "worker", "worker", workers[i % workers.length]),
    ),
    ...area.crowd.map((p, i) =>
      anchor(
        `crowd-${i}`,
        p,
        "civilian",
        "crowd",
        ["শফিক", "মরিয়ম", "ইমন", "শিউলি"][i % 4],
      ),
    ),
    ...area.civilians.map((p, i) =>
      anchor(
        `civilian-${i}`,
        p,
        "civilian",
        "civilian",
        civilians[i % civilians.length],
        [
          p,
          { x: p.x, z: p.z + 3 },
          { x: p.x + (i % 2 ? -1 : 1), z: p.z + 3 },
          p,
        ],
      ),
    ),
  ];
}
export function sectorObstacles(area: WorldArea): SectorObstacle[] {
  const p = (dx: number, dz: number) => ({
    x: area.center.x + dx,
    z: area.center.z + dz,
  });
  const obstacles: SectorObstacle[] = [
    ...sectorBuildings(area),
    // Tea counter is out of the full-width ambulance approach lane.
    {
      id: `${area.id}:tea-counter`,
      x: area.center.x - 11.7,
      z: area.center.z - 4,
      w: 1.1,
      d: 4.2,
      h: 1.1,
    },
    {
      id: `${area.id}:tea-back`,
      x: area.center.x - 14.8,
      z: area.center.z - 4,
      w: 0.2,
      d: 5.6,
      h: 2.5,
    },
    { id: `${area.id}:divider`, ...p(5.7, -1), w: 1.8, d: 0.2, h: 1.25 },
    { id: `${area.id}:cover-crate`, ...p(3.9, 5), w: 0.7, d: 1.6, h: 1.05 },
    { id: `${area.id}:cover-planter`, ...p(-3.2, 8), w: 1.2, d: 0.6, h: 0.85 },
    { id: `${area.id}:utility-pole`, ...p(7.6, 9), w: 0.24, d: 0.24, h: 9.3 },
    ...[-2.6, 2.6].map((dz, i) => ({
      id: `${area.id}:tea-pole-${i}`,
      ...p(-9.6, -4 + dz),
      w: 0.11,
      d: 0.11,
      h: 3.2,
    })),
    ...[-1.4, 1.3].map((dz, i) => ({
      id: `${area.id}:tea-bench-${i}`,
      ...p(-9.35, -4 + dz),
      w: 1.4,
      d: 0.5,
      h: 0.7,
    })),
    // A navigable doorway/seat hierarchy is separate from this walk footprint.
    { id: `${area.id}:parked-cng`, ...area.parking, w: 1.6, d: 2.9, h: 1.9 },
  ];
  if (area.id === "poster-quarter")
    obstacles.push(
      { id: `${area.id}:poster-wall`, ...p(12, 0), w: 0.3, d: 8.8, h: 3.2 },
      {
        id: `${area.id}:parked-rickshaw`,
        ...p(13.7, -6.8),
        w: 2.2,
        d: 3.4,
        h: 2.3,
      },
    );
  if (area.id === "microphone-square")
    obstacles.push(
      { id: `${area.id}:parked-bus`, ...p(16.2, 7), w: 2.6, d: 7, h: 3.1 },
      {
        id: `${area.id}:shelter-bench`,
        ...p(13.1, 2),
        w: 2.6,
        d: 0.45,
        h: 0.9,
      },
      ...[-1.45, 1.45].flatMap((dx, j) =>
        [-2.5, 2.5].map((dz, i) => ({
          id: `${area.id}:shelter-post-${j}-${i}`,
          ...p(13.1 + dx, 1.1 + dz),
          w: 0.1,
          d: 0.1,
          h: 3.3,
        })),
      ),
    );
  if (area.id === "power-house")
    obstacles.push(
      ...[-6, -3, 0, 3, 6].map((dx, i) => ({
        id: `${area.id}:arcade-column-${i}`,
        ...p(dx, 12.4),
        w: 0.38,
        d: 0.6,
        h: 3.2,
      })),
    );
  return obstacles;
}
export const allSectorObstacles: SectorObstacle[] = worldAreas
  .filter((area) => area.id !== "promise-junction")
  .flatMap(sectorObstacles);
for (const road of roadCorridors) {
  const horizontal = Math.abs(road.to.x - road.from.x) > 0.01;
  if (Math.hypot(road.to.x - road.from.x, road.to.z - road.from.z) <= 25)
    continue;
  allSectorObstacles.push({
    id: `road:${road.id}:utility-pole`,
    x: (road.from.x + road.to.x) / 2 + (horizontal ? 0 : 6.5),
    z: (road.from.z + road.to.z) / 2 + (horizontal ? 6.5 : 0),
    w: 0.24,
    d: 0.24,
    h: 9.3,
  });
}
