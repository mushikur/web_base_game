export const spawnWorldVersion = "dhaka-street-1" as const;
export type SpawnLocation = {
  id: string;
  name: string;
  enabled: boolean;
  x: number;
  z: number;
  facing: number;
};
export type SpawnRegistry = {
  schemaVersion: 1;
  worldVersion: typeof spawnWorldVersion;
  revision: number;
  source: "factory" | "admin-publication";
  publication: { id: string; at: string; by: string };
  locations: SpawnLocation[];
};
export type SpawnEnvironment = {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  obstacles: readonly { x: number; z: number; w: number; d: number }[];
  water: readonly { x: number; z: number; rx: number; rz: number }[];
  occupants: readonly {
    x: number;
    z: number;
    radius: number;
    kind?: "npc" | "crowd" | "traffic" | "player" | "vehicle";
  }[];
  canNavigate?: (x: number, z: number, radius: number) => boolean;
};
/** Original curated street publication. This is factory provenance, not a browser Admin action. */
export const factorySpawnRegistry: SpawnRegistry = {
  schemaVersion: 1,
  worldVersion: spawnWorldVersion,
  revision: 1,
  source: "factory",
  publication: {
    id: "factory-dhaka-street-1",
    at: "2026-11-03T00:00:00.000Z",
    by: "প্রকল্পের মৌলিক প্রকাশনা",
  },
  locations: [
    {
      id: "west-south",
      name: "পশ্চিম ফুটপাতের দক্ষিণ",
      enabled: true,
      x: -6.3,
      z: -16,
      facing: 0,
    },
    {
      id: "east-south",
      name: "পূর্ব ফুটপাতের দক্ষিণ",
      enabled: true,
      x: 6.3,
      z: -16,
      facing: 0,
    },
    {
      id: "west-middle",
      name: "পশ্চিম ফুটপাতের মাঝামাঝি",
      enabled: true,
      x: -6.3,
      z: -11,
      facing: 0,
    },
    {
      id: "east-middle",
      name: "পূর্ব ফুটপাতের মাঝামাঝি",
      enabled: true,
      x: 6.3,
      z: -11,
      facing: 0,
    },
    {
      id: "west-north",
      name: "পশ্চিম ফুটপাতের সামনের অংশ",
      enabled: true,
      x: -6.3,
      z: -9,
      facing: 0,
    },
    {
      id: "east-north",
      name: "পূর্ব ফুটপাতের সামনের অংশ",
      enabled: true,
      x: 6.3,
      z: -9,
      facing: 0,
    },
  ],
};
const factoryPublicationJson = JSON.stringify(factorySpawnRegistry);
const invalidRegistry = () =>
  new Error("নির্ধারিত নিরাপদ স্থানের প্রকাশনা সঠিক নয়।");
const finite = (...values: number[]) => values.every(Number.isFinite);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const bengali = (value: unknown) =>
  typeof value === "string" &&
  value.length <= 120 &&
  /[\u0985-\u09b9\u09ce\u09dc-\u09df]/u.test(value) &&
  !/\p{Script=Devanagari}/u.test(value) &&
  !value.includes("\ufffd");
const token = (value: unknown) =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{1,79}$/.test(value);
/** Call only on shipped content or a trusted same-origin publication read, never player input. */
export function parseSpawnRegistry(input: unknown): SpawnRegistry {
  if (
    !record(input) ||
    input.schemaVersion !== 1 ||
    input.worldVersion !== spawnWorldVersion ||
    !Number.isSafeInteger(input.revision) ||
    Number(input.revision) < 1 ||
    !["factory", "admin-publication"].includes(String(input.source)) ||
    !record(input.publication) ||
    !token(input.publication.id) ||
    !bengali(input.publication.by) ||
    typeof input.publication.at !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
      input.publication.at,
    ) ||
    !Number.isFinite(Date.parse(input.publication.at)) ||
    !Array.isArray(input.locations) ||
    input.locations.length < 1 ||
    input.locations.length > 128
  )
    throw invalidRegistry();
  const ids = new Set<string>();
  const locations: SpawnLocation[] = input.locations.map(
    (location: unknown) => {
      if (
        !record(location) ||
        !token(location.id) ||
        ids.has(String(location.id)) ||
        !bengali(location.name) ||
        typeof location.enabled !== "boolean" ||
        typeof location.x !== "number" ||
        typeof location.z !== "number" ||
        typeof location.facing !== "number" ||
        !finite(location.x, location.z, location.facing) ||
        Math.abs(location.x) > 10000 ||
        Math.abs(location.z) > 10000 ||
        Math.abs(location.facing) > Math.PI * 2 ||
        "y" in location ||
        "approved" in location
      )
        throw invalidRegistry();
      ids.add(String(location.id));
      return {
        id: String(location.id),
        name: String(location.name),
        enabled: location.enabled,
        x: location.x,
        z: location.z,
        facing: location.facing,
      };
    },
  );
  const parsed: SpawnRegistry = {
    schemaVersion: 1,
    worldVersion: spawnWorldVersion,
    revision: Number(input.revision),
    source: input.source as SpawnRegistry["source"],
    publication: {
      id: String(input.publication.id),
      at: input.publication.at,
      by: String(input.publication.by),
    },
    locations,
  };
  // A client cannot turn a new coordinate into a factory point by adding an approval flag.
  if (
    parsed.source === "factory" &&
    JSON.stringify(parsed) !== factoryPublicationJson
  )
    throw invalidRegistry();
  return parsed;
}
function overlapsWater(
  x: number,
  z: number,
  radius: number,
  water: SpawnEnvironment["water"][number],
) {
  const px = Math.abs(x - water.x),
    pz = Math.abs(z - water.z),
    a = water.rx,
    b = water.rz;
  if (!finite(a * a, b * b, a * px, b * pz)) return true;
  if ((px / a) ** 2 + (pz / b) ** 2 <= 1) return true;
  // Closest point on an ellipse: bounded bisection avoids the diagonal gaps from
  // simply adding radius to both ellipse axes.
  let low = 0,
    high = 2 * Math.max(a * px, b * pz, 1);
  const equation = (t: number) =>
    ((a * px) / (t + a * a)) ** 2 + ((b * pz) / (t + b * b)) ** 2;
  for (let i = 0; i < 64; i++) {
    const mid = (low + high) / 2;
    if (equation(mid) > 1) low = mid;
    else high = mid;
  }
  const qx = (a * a * px) / (high + a * a),
    qz = (b * b * pz) / (high + b * b);
  return Math.hypot(px - qx, pz - qz) <= radius;
}
/** Validates the entire circular footprint and fails closed on malformed world data. */
export function safeSpawnPoint(
  point: { x: number; z: number },
  environment: SpawnEnvironment,
  radius = 0.42,
) {
  const { x, z } = point,
    { bounds, obstacles, water, occupants } = environment;
  if (
    !finite(x, z, radius, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ) ||
    radius <= 0 ||
    bounds.minX >= bounds.maxX ||
    bounds.minZ >= bounds.maxZ ||
    x - radius <= bounds.minX ||
    x + radius >= bounds.maxX ||
    z - radius <= bounds.minZ ||
    z + radius >= bounds.maxZ
  )
    return false;
  if (
    obstacles.some(
      (o) =>
        !finite(o.x, o.z, o.w, o.d) ||
        o.w <= 0 ||
        o.d <= 0 ||
        Math.hypot(
          Math.max(Math.abs(x - o.x) - o.w / 2, 0),
          Math.max(Math.abs(z - o.z) - o.d / 2, 0),
        ) <= radius,
    )
  )
    return false;
  if (
    water.some(
      (w) =>
        !finite(w.x, w.z, w.rx, w.rz) ||
        w.rx <= 0 ||
        w.rz <= 0 ||
        overlapsWater(x, z, radius, w),
    )
  )
    return false;
  if (
    occupants.some(
      (o) =>
        !finite(o.x, o.z, o.radius) ||
        o.radius < 0 ||
        Math.hypot(x - o.x, z - o.z) <= radius + o.radius,
    )
  )
    return false;
  return !environment.canNavigate || environment.canNavigate(x, z, radius);
}
/** One finite shuffle, one validation pass. No unapproved fallback or random retry. */
export function chooseSafeSpawn(
  registry: SpawnRegistry,
  environment: SpawnEnvironment,
  random: () => number = Math.random,
): SpawnLocation | null {
  const candidates = parseSpawnRegistry(registry).locations.filter(
    (location) => location.enabled,
  );
  for (let i = candidates.length - 1; i > 0; i--) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1)
      throw new Error("নিরাপদ স্থান বাছাই করা যায়নি। আবার চেষ্টা করুন।");
    const j = Math.floor(sample * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return (
    candidates.find((location) => safeSpawnPoint(location, environment)) ?? null
  );
}
