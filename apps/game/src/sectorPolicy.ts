export type SectorPoint = { x: number; z: number };
export type SectorRegion = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  encounter: boolean;
};
export type SectorResource = {
  setVisible(visible: boolean): void;
  setActive(active: boolean): void;
  dispose(): void;
};
export type SectorStatus = {
  id: string;
  state: "unloaded" | "visible" | "active" | "sleeping";
  pinned: boolean;
  distance: number;
  generation: number;
};
export type SectorChanges = {
  loaded: string[];
  released: string[];
  activityChanged: string[];
};
type SectorOptions = {
  prefetch: number;
  visibleUntil: number;
  active: number;
  activeUntil: number;
  release: number;
  warmLimit: number;
  activeLimit: number;
};

export function distanceToSector(point: SectorPoint, region: SectorRegion) {
  return Math.hypot(
    Math.max(region.minX - point.x, 0, point.x - region.maxX),
    Math.max(region.minZ - point.z, 0, point.z - region.maxZ),
  );
}

/** Synchronous factories deliberately own no asynchronous orphan generation. A
 * released sector reconstructs its visuals from the independent mission state. */
export class SectorCache<T extends SectorResource> {
  readonly resources = new Map<string, T>();
  private readonly records = new Map<
    string,
    SectorStatus & { lastVisible: number }
  >();
  private tick = 0;
  private disposed = false;
  readonly regions: readonly SectorRegion[];
  readonly options: SectorOptions;
  private readonly construct: (id: string) => T;
  constructor(
    regions: readonly SectorRegion[],
    construct: (id: string) => T,
    options = {
      prefetch: 65,
      visibleUntil: 78,
      active: 34,
      activeUntil: 40,
      release: 94,
      warmLimit: 2,
      activeLimit: 2,
    },
  ) {
    this.regions = regions;
    this.construct = construct;
    this.options = options;
    if (
      options.active > options.activeUntil ||
      options.prefetch > options.visibleUntil ||
      options.visibleUntil > options.release ||
      options.warmLimit < 0 ||
      options.activeLimit < 1 ||
      new Set(regions.map((r) => r.id)).size !== regions.length
    )
      throw new Error("সেক্টরের সীমা সঠিক নয়।");
    for (const region of regions)
      this.records.set(region.id, {
        id: region.id,
        state: "unloaded",
        pinned: false,
        distance: Infinity,
        generation: 0,
        lastVisible: 0,
      });
  }
  get status(): SectorStatus[] {
    return [...this.records.values()].map((record) => ({
      id: record.id,
      state: record.state,
      pinned: record.pinned,
      distance: record.distance,
      generation: record.generation,
    }));
  }
  update(point: SectorPoint, pins: readonly string[] = []): SectorChanges {
    if (this.disposed) throw new Error("বন্ধ সেক্টর আবার চালু করা যাবে না।");
    if (!Number.isFinite(point.x) || !Number.isFinite(point.z))
      throw new Error("খেলোয়াড়ের অবস্থান সঠিক নয়।");
    const changes: SectorChanges = {
      loaded: [],
      released: [],
      activityChanged: [],
    };
    this.tick++;
    const pinSet = new Set(pins);
    const ranked = this.regions
      .filter((region) => region.encounter)
      .map((region) => ({
        region,
        distance: distanceToSector(point, region),
      }))
      .sort(
        (a, b) =>
          Number(pinSet.has(b.region.id)) - Number(pinSet.has(a.region.id)) ||
          a.distance - b.distance ||
          a.region.id.localeCompare(b.region.id),
      );
    // Pinned evacuation routes retain geometry; only nearby encounters run AI.
    const activeIds = new Set(
      ranked
        .filter(({ region, distance }) => {
          const record = this.records.get(region.id)!;
          return (
            distance <=
            (record.state === "active"
              ? this.options.activeUntil
              : this.options.active)
          );
        })
        .slice(0, this.options.activeLimit)
        .map(({ region }) => region.id),
    );
    for (const region of this.regions) {
      const record = this.records.get(region.id)!;
      record.distance = distanceToSector(point, region);
      record.pinned = pinSet.has(region.id);
      const current = this.resources.get(region.id);
      const visible =
        record.pinned ||
        record.distance <=
          (current && record.state !== "sleeping"
            ? this.options.visibleUntil
            : this.options.prefetch);
      if (visible) {
        const resource = current ?? this.construct(region.id);
        if (!current) {
          this.resources.set(region.id, resource);
          record.generation++;
          changes.loaded.push(region.id);
        }
        const active = activeIds.has(region.id);
        if ((record.state === "active") !== active)
          changes.activityChanged.push(region.id);
        resource.setVisible(true);
        resource.setActive(active);
        record.state = active ? "active" : "visible";
        record.lastVisible = this.tick;
      } else if (current) {
        if (record.state === "active") changes.activityChanged.push(region.id);
        current.setActive(false);
        current.setVisible(false);
        record.state = "sleeping";
      }
    }
    const sleeping = [...this.records.values()]
      .filter((record) => record.state === "sleeping" && !record.pinned)
      .sort((a, b) => a.lastVisible - b.lastVisible || b.distance - a.distance);
    let excess = Math.max(0, sleeping.length - this.options.warmLimit);
    for (const record of sleeping)
      if (record.distance > this.options.release || excess-- > 0) {
        this.resources.get(record.id)!.dispose();
        this.resources.delete(record.id);
        record.state = "unloaded";
        changes.released.push(record.id);
      }
    return changes;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const resource of this.resources.values()) resource.dispose();
    this.resources.clear();
    for (const record of this.records.values()) record.state = "unloaded";
  }
}
