import type { Surface } from "./audio.ts";
import { streetHeightAt, streetSurfaceAt } from "./street-surfaces.ts";

export type Point2 = { x: number; z: number };
export type WorldRect = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};
export type AreaId =
  | "promise-junction"
  | "committee-lane"
  | "microphone-square"
  | "poster-quarter"
  | "power-house";
export type WorldArea = {
  id: AreaId;
  name: string;
  leaderName: string;
  objective: string;
  center: Point2;
  bounds: WorldRect;
  encounterBounds: WorldRect;
  entrance: Point2;
  leader: Point2;
  workers: Point2[];
  crowd: Point2[];
  civilians: Point2[];
  teaShop: Point2;
  pickups: { kind: "egg" | "sandal"; position: Point2 }[];
  parking: Point2;
  cover: Point2[];
  escapeRoute: Point2[];
  ambulance: {
    approach: Point2[];
    bay: Point2;
    exitRoute: Point2[];
    exit: Point2;
    alternateApproaches?: Point2[][];
    alternateExits?: Point2[][];
  };
};
export const missionWorldVersion = "dhaka-missions-c1";
export const hubBounds: WorldRect = {
  minX: -21.4,
  maxX: 21.4,
  minZ: -18.8,
  maxZ: 22.5,
};
export const worldBounds: WorldRect = {
  minX: -67,
  maxX: 97,
  minZ: -19,
  maxZ: 111,
};
export const pointInRect = (point: Point2, rect: WorldRect, inset = 0) =>
  point.x >= rect.minX + inset &&
  point.x <= rect.maxX - inset &&
  point.z >= rect.minZ + inset &&
  point.z <= rect.maxZ - inset;
export const distance2 = (a: Point2, b: Point2) =>
  Math.hypot(a.x - b.x, a.z - b.z);

function outerArea(
  id: AreaId,
  name: string,
  leaderName: string,
  x: number,
  z: number,
): WorldArea {
  const p = (dx: number, dz: number): Point2 => ({ x: x + dx, z: z + dz });
  // Leave the whole ambulance radius on authored road at the visible entrance.
  const bay = p(-4.5, -3),
    exit = p(-4.5, -15);
  return {
    id,
    name,
    leaderName,
    objective: `${leaderName}র সভায় আটকে থাকা পথ খুলুন। পথচারীদের নিরাপদে রাখুন।`,
    center: p(0, 0),
    bounds: { minX: x - 17, maxX: x + 17, minZ: z - 18, maxZ: z + 18 },
    encounterBounds: { minX: x - 19, maxX: x + 19, minZ: z - 20, maxZ: z + 20 },
    entrance: p(0, -10),
    leader: p(0, 4),
    workers: [p(-2, 1), p(2, 1), p(0, -1)],
    crowd: [p(-4, 7), p(4, 7), p(-5, 5), p(5, 5)],
    // The western side of the parked CNG needs a complete pedestrian radius,
    // including the home position used by a mission retry.
    civilians: [p(-7, -8), p(6, -9), p(7, 1)],
    teaShop: p(-8, -4),
    pickups: [
      { kind: "egg", position: p(-1.4, -7) },
      { kind: "sandal", position: p(1.4, -5) },
    ],
    parking: p(8, -7),
    cover: [p(3, 5), p(-2, 8)],
    escapeRoute: [p(3, 4), p(3, 9), p(-2, 9), p(-2, 12)],
    ambulance: {
      approach: [exit, p(-4.5, -9), bay],
      bay,
      exitRoute: [bay, p(-4.5, -9), exit],
      exit,
      // A finite staging/bypass path stays on this authored block. It is only
      // selected from an actually blocked vehicle pose after full body checks.
      // An occupied bay remains a wait; this never substitutes another bay.
      alternateApproaches: [[p(-2, -13), p(-2, -5.6), p(-4.5, -4.6), bay]],
      alternateExits: [[p(-1.5, -4.5), p(-1.5, -11), p(-4.5, -13), exit]],
    },
  };
}

export const worldAreas: readonly WorldArea[] = [
  {
    id: "promise-junction",
    name: "প্রতিশ্রুতি মোড়",
    leaderName: "বজলু প্রতিশ্রুতি",
    objective:
      "বজলু প্রতিশ্রুতির সভায় আটকে থাকা পথ খুলুন। পথচারীদের নিরাপদে রাখুন।",
    center: { x: 0, z: 0 },
    bounds: hubBounds,
    encounterBounds: { minX: -7.5, maxX: 7.5, minZ: -17, maxZ: 32 },
    entrance: { x: 0, z: 4.65 },
    leader: { x: 1.8, z: 10.6 },
    workers: [
      { x: -1.8, z: 7.8 },
      { x: 3.3, z: 7.4 },
      { x: 0.1, z: 6.6 },
    ],
    crowd: [
      { x: -3, z: 5.5 },
      { x: -3.4, z: 3.8 },
      { x: 3.3, z: 4.9 },
    ],
    civilians: [
      { x: -6.1, z: -7 },
      { x: 6.3, z: 5.8 },
      { x: -6.1, z: 8 },
      { x: 6.4, z: -10 },
      { x: -8.4, z: 0.6 },
    ],
    teaShop: { x: -5.5, z: 0 },
    pickups: [
      { kind: "egg", position: { x: -1.4, z: -5.7 } },
      { kind: "sandal", position: { x: 1.25, z: -3.4 } },
    ],
    parking: { x: 4, z: 2 },
    cover: [
      { x: 4.5, z: 13 },
      { x: 1, z: 16 },
    ],
    escapeRoute: [
      { x: 4.5, z: 10.6 },
      { x: 4.5, z: 13 },
      { x: 1, z: 16 },
    ],
    ambulance: {
      approach: [
        { x: -2.6, z: 34 },
        { x: -2.6, z: 26 },
        { x: -2.6, z: 8 },
      ],
      bay: { x: -2.6, z: 8 },
      exitRoute: [
        { x: -2.6, z: 8 },
        { x: -2.6, z: 26 },
        { x: -2.6, z: 34 },
      ],
      exit: { x: -2.6, z: 34 },
      // The junction has turning room for this early partial obstruction. A
      // centre-lane block alongside the median has no valid bypass: wait there.
      alternateApproaches: [
        [
          { x: -2.6, z: 35 },
          { x: 0, z: 34 },
          { x: 0, z: 27.5 },
          { x: -2.6, z: 26.5 },
          { x: -2.6, z: 8 },
        ],
      ],
      alternateExits: [
        [
          { x: -2.6, z: 26.5 },
          { x: 0, z: 27.5 },
          { x: 0, z: 34 },
          { x: -2.6, z: 34 },
        ],
      ],
    },
  },
  outerArea("committee-lane", "কমিটি গলি", "কুদরত কমিটি", -48, 52),
  outerArea("microphone-square", "মাইক চত্বর", "মকবুল মাইক", 22, 82),
  outerArea("poster-quarter", "পোস্টার পট্টি", "পটল পোস্টার", 66, 24),
  outerArea("power-house", "ক্ষমতা ভবন", "হাবুল হিসাব", 78, 91),
];
export const areaById = (id: AreaId) => worldAreas.find((a) => a.id === id)!;
export const isAreaId = (id: unknown): id is AreaId =>
  typeof id === "string" && worldAreas.some((a) => a.id === id);

export type RoadCorridor = {
  id: string;
  from: Point2;
  to: Point2;
  width: number;
};
export const roadCorridors: readonly RoadCorridor[] = [
  { id: "north-link", from: { x: 0, z: 22 }, to: { x: 0, z: 34 }, width: 12 },
  {
    id: "committee-cross",
    from: { x: -48, z: 34 },
    to: { x: 0, z: 34 },
    width: 12,
  },
  {
    id: "committee-entry",
    from: { x: -48, z: 34 },
    to: { x: -48, z: 52 },
    width: 12,
  },
  { id: "east-cross", from: { x: 0, z: 34 }, to: { x: 66, z: 34 }, width: 12 },
  {
    id: "square-entry",
    from: { x: 22, z: 34 },
    to: { x: 22, z: 82 },
    width: 12,
  },
  {
    id: "poster-entry",
    from: { x: 66, z: 24 },
    to: { x: 66, z: 34 },
    width: 12,
  },
  {
    id: "office-north",
    from: { x: 66, z: 34 },
    to: { x: 66, z: 91 },
    width: 12,
  },
  {
    id: "office-entry",
    from: { x: 66, z: 91 },
    to: { x: 78, z: 91 },
    width: 12,
  },
];
export const corridorRect = (road: RoadCorridor): WorldRect => ({
  minX: Math.min(road.from.x, road.to.x) - road.width / 2,
  maxX: Math.max(road.from.x, road.to.x) + road.width / 2,
  minZ: Math.min(road.from.z, road.to.z) - road.width / 2,
  maxZ: Math.max(road.from.z, road.to.z) + road.width / 2,
});
export const walkRegions: readonly WorldRect[] = [
  ...worldAreas.map((a) => a.bounds),
  ...roadCorridors.map(corridorRect),
];

/** The authored hub retains its exact footstep and height contract. */
export function worldSurfaceAt(x: number, z: number): Surface {
  if (onHubDais(x, z) || onHubRamp(x, z)) return "shop";
  if (pointInRect({ x, z }, hubBounds)) return streetSurfaceAt(x, z);
  const area = worldAreas.slice(1).find((a) => pointInRect({ x, z }, a.bounds));
  if (area) {
    if (
      Math.abs(x - area.teaShop.x) < 2.2 &&
      Math.abs(z - area.teaShop.z) < 2.8
    )
      return "shop";
    return Math.abs(x - area.center.x) >= 6
      ? area.id === "committee-lane"
        ? "brick"
        : "concrete"
      : "asphalt";
  }
  return "asphalt";
}
export function worldHeightAt(x: number, z: number) {
  if (onHubDais(x, z)) return 0.46;
  if (onHubRamp(x, z)) return (0.46 * (5 - x)) / 1.2;
  if (pointInRect({ x, z }, hubBounds)) return streetHeightAt(x, z);
  const area = worldAreas.slice(1).find((a) => pointInRect({ x, z }, a.bounds));
  return area && Math.abs(x - area.center.x) >= 6 ? 0.2 : 0;
}

export const onHubDais = (x: number, z: number) =>
  x >= -0.2 && x <= 3.8 && z >= 9.1 && z <= 12.1;
export const onHubRamp = (x: number, z: number) =>
  x >= 3.8 && x <= 5 && z >= 9.9 && z <= 11.3;
/** C adds visible access to the existing low speech platform. Only its exact
 * authored walking footprint is replaced by the walkable floor and ramp;
 * physics and camera layers retain their real platform collider. */
export const hubDaisObstacle = (obstacle: {
  x: number;
  z: number;
  w: number;
  d: number;
}) =>
  Math.abs(obstacle.x - 1.8) < 1e-6 &&
  Math.abs(obstacle.z - 10.6) < 1e-6 &&
  Math.abs(obstacle.w - 4) < 1e-6 &&
  Math.abs(obstacle.d - 3) < 1e-6;

export type NavigationNode = Point2 & { id: string };
export type NavigationEdge = { from: string; to: string; width: number };
const mainNodes: NavigationNode[] = [
  { id: "hub-stage", x: 1.8, z: 10.6 },
  { id: "hub-ramp-top", x: 3.7, z: 10.6 },
  { id: "hub-ramp-toe", x: 5, z: 10.6 },
  { id: "hub-south-west", x: -2.6, z: -15 },
  { id: "hub-center-west", x: -2.6, z: 4.65 },
  { id: "hub-north-west", x: -2.6, z: 12 },
  { id: "hub-lane-west", x: -2.6, z: 26 },
  { id: "hub-marker", x: 0, z: 4.65 },
  { id: "hub-east", x: 0.9, z: 16 },
  { id: "hub-east-gap", x: 0.9, z: 23 },
  { id: "hub-east-exit", x: 0.9, z: 27 },
  { id: "north-junction", x: 0, z: 34 },
  { id: "committee-junction", x: -48, z: 34 },
  { id: "square-junction", x: 22, z: 34 },
  { id: "poster-junction", x: 66, z: 34 },
  { id: "office-road-south", x: 66, z: 53 },
  { id: "office-road-north", x: 66, z: 72 },
  { id: "office-junction", x: 66, z: 91 },
];
const mainPairs = [
  ["hub-stage", "hub-ramp-top"],
  ["hub-ramp-top", "hub-ramp-toe"],
  ["hub-south-west", "hub-center-west"],
  ["hub-center-west", "hub-north-west"],
  ["hub-north-west", "hub-lane-west"],
  ["hub-lane-west", "north-junction"],
  ["hub-center-west", "hub-marker"],
  ["hub-marker", "hub-east"],
  ["hub-east", "hub-east-gap"],
  ["hub-east-gap", "hub-east-exit"],
  ["hub-east-exit", "north-junction"],
  ["north-junction", "committee-junction"],
  ["north-junction", "square-junction"],
  ["square-junction", "poster-junction"],
  ["poster-junction", "office-road-south"],
  ["office-road-south", "office-road-north"],
  ["office-road-north", "office-junction"],
] as const;
export const worldGraph: { nodes: NavigationNode[]; edges: NavigationEdge[] } =
  {
    nodes: [...mainNodes],
    edges: mainPairs.map(([from, to]) => ({
      from,
      to,
      width: from.startsWith("hub-east") ? 1.05 : 3.2,
    })),
  };
for (const area of worldAreas.slice(1)) {
  const entrance = `${area.id}:entrance`,
    center = `${area.id}:center`;
  worldGraph.nodes.push(
    { id: entrance, ...area.entrance },
    { id: center, ...area.center },
  );
  const junction =
    area.id === "committee-lane"
      ? "committee-junction"
      : area.id === "microphone-square"
        ? "square-junction"
        : area.id === "poster-quarter"
          ? "poster-junction"
          : "office-junction";
  worldGraph.edges.push(
    { from: junction, to: entrance, width: 4 },
    { from: entrance, to: center, width: 4 },
  );
}

/** Normalized map coordinates; aspect ratio is left to the real viewport. */
export function worldToMap(point: Point2, bounds = worldBounds) {
  return {
    x: (point.x - bounds.minX) / (bounds.maxX - bounds.minX),
    y: 1 - (point.z - bounds.minZ) / (bounds.maxZ - bounds.minZ),
  };
}
