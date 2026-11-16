import {
  distance2,
  hubDaisObstacle,
  pointInRect,
  walkRegions,
  worldGraph,
  worldHeightAt,
  type Point2,
  type WorldRect,
} from "./world-layout.ts";

export type NavigationObstacle = { x: number; z: number; w: number; d: number };
export type NavigationResult =
  | { ok: true; points: Point2[]; distance: number; message: string }
  | { ok: false; points: []; distance: 0; message: string };
const finitePoint = (p: Point2) => Number.isFinite(p.x) && Number.isFinite(p.z);
const maximumVisibilitySpan = 27;
const maximumRoadSubspan = 12;
function inflated(o: NavigationObstacle, radius: number): WorldRect {
  return {
    minX: o.x - o.w / 2 - radius,
    maxX: o.x + o.w / 2 + radius,
    minZ: o.z - o.d / 2 - radius,
    maxZ: o.z + o.d / 2 + radius,
  };
}

/** Conservative circle clearance matches the hub's inflated walking AABBs. */
export function worldCanWalk(
  x: number,
  z: number,
  obstacles: readonly NavigationObstacle[],
  radius = 0.32,
) {
  const p = { x, z };
  return (
    finitePoint(p) &&
    Number.isFinite(radius) &&
    radius >= 0 &&
    radius <= 5 &&
    walkRegions.some((rect) => pointInRect(p, rect, radius)) &&
    !obstacles.some(
      (o) => !hubDaisObstacle(o) && pointInRect(p, inflated(o, radius)),
    )
  );
}

/** Closed segment intersection against an axis-aligned rectangle (slab method). */
function segmentInterval(
  a: Point2,
  b: Point2,
  rect: WorldRect,
): [number, number] | undefined {
  let lo = 0,
    hi = 1;
  // Avoid allocating per-axis arrays for each visibility pair.
  for (let axis = 0; axis < 2; axis++) {
    const start = axis === 0 ? a.x : a.z,
      end = axis === 0 ? b.x : b.z;
    const min = axis === 0 ? rect.minX : rect.minZ,
      max = axis === 0 ? rect.maxX : rect.maxZ;
    const delta = end - start;
    if (Math.abs(delta) < 1e-10) {
      if (start < min || start > max) return;
    } else {
      const t1 = (min - start) / delta,
        t2 = (max - start) / delta;
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
      if (lo > hi) return;
    }
  }
  return [lo, hi];
}
function coveredByWalkRegions(a: Point2, b: Point2, radius: number) {
  const intervals = walkRegions
    .map((r) =>
      segmentInterval(a, b, {
        minX: r.minX + radius,
        maxX: r.maxX - radius,
        minZ: r.minZ + radius,
        maxZ: r.maxZ - radius,
      }),
    )
    .filter((i): i is [number, number] => !!i)
    .sort((u, v) => u[0] - v[0]);
  let end = 0;
  for (const interval of intervals) {
    if (interval[0] > end + 1e-8) return false;
    end = Math.max(end, interval[1]);
    if (end >= 1 - 1e-8) return true;
  }
  return false;
}
export function segmentClear(
  a: Point2,
  b: Point2,
  obstacles: readonly NavigationObstacle[],
  radius = 0.32,
) {
  return (
    worldCanWalk(a.x, a.z, obstacles, radius) &&
    worldCanWalk(b.x, b.z, obstacles, radius) &&
    coveredByWalkRegions(a, b, radius) &&
    !obstacles.some(
      (o) => !hubDaisObstacle(o) && segmentInterval(a, b, inflated(o, radius)),
    ) &&
    continuousSurface(a, b)
  );
}

function continuousSurface(a: Point2, b: Point2) {
  // The protected hub curb is .32m high. Preserve that movement contract and
  // reject the .46m unsupported speech-platform ledges in either direction.
  // ledges in either direction; the east ramp is the actual assistance path.
  if (
    Math.max(a.x, b.x) < -0.3 ||
    Math.min(a.x, b.x) > 5.1 ||
    Math.max(a.z, b.z) < 9 ||
    Math.min(a.z, b.z) > 12.2
  )
    return true;
  const steps = Math.max(1, Math.ceil(distance2(a, b) / 0.08));
  let last = worldHeightAt(a.x, a.z);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps,
      y = worldHeightAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    if (Math.abs(y - last) > 0.34) return false;
    last = y;
  }
  return true;
}

/** A bounded A* search over authored roads with endpoint and blocker-corner
 * visibility links. Every returned segment is checked against current blockers,
 * not just metadata; an unreachable target yields a Bengali no-route result. */
export function pathfindWorld(
  start: Point2,
  goal: Point2,
  obstacles: readonly NavigationObstacle[],
  radius = 0.32,
): NavigationResult {
  // Babylon Vector3 exposes x/z through prototype accessors. Object spread
  // copies its _x/_z storage instead of coordinates; normalize at the boundary.
  start = { x: start.x, z: start.z };
  goal = { x: goal.x, z: goal.z };
  const noRoute: NavigationResult = {
    ok: false,
    points: [],
    distance: 0,
    message: "এখন নিরাপদ পথ পাওয়া যাচ্ছে না। বাধা সরে গেলে আবার পথ দেখুন।",
  };
  if (
    !worldCanWalk(start.x, start.z, obstacles, radius) ||
    !worldCanWalk(goal.x, goal.z, obstacles, radius)
  )
    return noRoute;
  if (segmentClear(start, goal, obstacles, radius))
    return {
      ok: true,
      points: [{ ...start }, { ...goal }],
      distance: distance2(start, goal),
      message: "চিহ্নিত নিরাপদ পথ ধরে এগোন।",
    };
  const graphNodes = worldGraph.nodes.filter((p) =>
    worldCanWalk(p.x, p.z, obstacles, radius),
  );
  const nodes: Point2[] = [
    { ...start },
    { ...goal },
    ...graphNodes.map(({ x, z }) => ({ x, z })),
  ];
  const graphIndex = new Map(graphNodes.map((p, i) => [p.id, i + 2]));
  // An obstacle can break a long authored edge near either junction. Add a
  // bounded set of intermediate road points so its corner detour can reconnect
  // within the local visibility limit. These are candidates only: every point
  // and connecting segment still must clear the complete current blockers.
  for (const edge of worldGraph.edges) {
    if (edge.width < radius * 2) continue;
    const from = worldGraph.nodes.find((node) => node.id === edge.from)!,
      to = worldGraph.nodes.find((node) => node.id === edge.to)!,
      length = distance2(from, to);
    if (length <= maximumVisibilitySpan) continue;
    const spans = Math.ceil(length / maximumRoadSubspan);
    for (let i = 1; i < spans; i++) {
      const t = i / spans,
        point = {
          x: from.x + (to.x - from.x) * t,
          z: from.z + (to.z - from.z) * t,
        };
      if (worldCanWalk(point.x, point.z, obstacles, radius)) nodes.push(point);
    }
  }
  // Four corners per obstacle preserve real around-the-wall alternatives. Bound
  // work even for malformed/public data; distant blockers need no corner nodes.
  const critical = obstacles.filter(
    (o) =>
      !hubDaisObstacle(o) &&
      worldGraph.edges.some((edge) => {
        const from = worldGraph.nodes.find((n) => n.id === edge.from)!,
          to = worldGraph.nodes.find((n) => n.id === edge.to)!;
        return !!segmentInterval(from, to, inflated(o, radius));
      }),
  );
  const nearby = obstacles
    .map((o) => ({
      obstacle: o,
      distance: Math.min(distance2(start, o), distance2(goal, o)),
    }))
    .filter((o) => o.distance < 35)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 24)
    .map((o) => o.obstacle);
  // A mid-road obstruction may be distant from both endpoints. Include its
  // corners before local clutter so a long selected route can detour honestly.
  const relevant = [...new Set([...critical, ...nearby])].slice(0, 32);
  for (const obstacle of relevant) {
    const r = inflated(obstacle, radius + 0.06);
    for (const x of [r.minX, r.maxX])
      for (const z of [r.minZ, r.maxZ])
        if (worldCanWalk(x, z, obstacles, radius)) nodes.push({ x, z });
  }
  const count = nodes.length,
    authoredEdges = new Set<number>(),
    visibility = new Map<number, boolean>();
  const edgeKey = (i: number, j: number) =>
    Math.min(i, j) * count + Math.max(i, j);
  // Long street spans are authored edges, not an all-pairs visibility mesh.
  for (const edge of worldGraph.edges) {
    const from = graphIndex.get(edge.from),
      to = graphIndex.get(edge.to);
    if (from !== undefined && to !== undefined && edge.width >= radius * 2)
      authoredEdges.add(edgeKey(from, to));
  }
  const cost = new Float64Array(count).fill(Infinity),
    parent = new Int32Array(count).fill(-1);
  const open = new Set<number>([0]),
    closed = new Set<number>();
  cost[0] = 0;
  while (open.size) {
    let current = -1,
      best = Infinity;
    for (const candidate of open) {
      const estimate = cost[candidate] + distance2(nodes[candidate], goal);
      if (estimate < best) {
        best = estimate;
        current = candidate;
      }
    }
    if (current === 1) {
      const points: Point2[] = [];
      for (let at = 1; at !== -1; at = parent[at]) points.unshift(nodes[at]);
      return {
        ok: true,
        points,
        distance: cost[1],
        message: "চিহ্নিত নিরাপদ পথ ধরে এগোন।",
      };
    }
    open.delete(current);
    closed.add(current);
    // Resolve visibility only for expanded nodes. Do not construct an O(N²)
    // collision mesh every time one actor requests a short detour.
    for (let to = 0; to < count; to++) {
      if (to === current || closed.has(to)) continue;
      const key = edgeKey(current, to),
        distance = distance2(nodes[current], nodes[to]);
      if (distance > maximumVisibilitySpan && !authoredEdges.has(key)) continue;
      let clear = visibility.get(key);
      if (clear === undefined) {
        clear = segmentClear(nodes[current], nodes[to], obstacles, radius);
        visibility.set(key, clear);
      }
      if (!clear) continue;
      const next = cost[current] + distance;
      if (next < cost[to]) {
        cost[to] = next;
        parent[to] = current;
        open.add(to);
      }
    }
  }
  return noRoute;
}
