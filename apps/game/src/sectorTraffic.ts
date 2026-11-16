import {
  Mesh,
  Scene,
  ShadowGenerator,
  Vector3,
  type TransformNode,
} from "./engine";
import type { Material } from "@babylonjs/core/Materials/material";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { createCNG, type ParkedVehicle } from "./vehicles";
import type { BoardingPose } from "./boarding";
import { acquireSectorResources } from "./sectorSceneResources";
import {
  TrafficDriver,
  trafficBlocked,
  trafficLoops,
  type TrafficOccupant,
} from "./sectorTrafficPath";

type TrafficInstance = {
  vehicle: ParkedVehicle;
  wheels: TransformNode[];
  casters: Mesh[];
  casting: boolean;
  releaseDriver?: () => void;
};
type TrafficOptions = {
  createDriver?: (
    vehicle: ParkedVehicle,
    localPose: BoardingPose,
  ) => () => void;
};
export class SectorTraffic {
  private readonly scene: Scene;
  private readonly shadow: ShadowGenerator;
  private readonly lease: ReturnType<typeof acquireSectorResources>;
  private readonly drivers = trafficLoops.map(
    (loop) => new TrafficDriver(loop),
  );
  private readonly instances = new Map<string, TrafficInstance>();
  private disposed = false;
  private quality = {
    prefetchDistance: 65,
    activeDistance: 34,
    shadowDistance: 35,
  };
  private readonly options: TrafficOptions;
  constructor(
    scene: Scene,
    shadow: ShadowGenerator,
    options: TrafficOptions = {},
  ) {
    this.scene = scene;
    this.shadow = shadow;
    this.lease = acquireSectorResources(scene);
    this.options = options;
  }
  private create(driver: TrafficDriver) {
    const beforeMaterials = new Set(this.scene.materials),
      beforeTextures = new Set(this.scene.textures),
      pose = driver.pose;
    const vehicle = createCNG(
      this.scene,
      this.shadow,
      new Vector3(pose.x, 0, pose.z),
      pose.yaw,
      { movingWheels: true },
    );
    vehicle.id = `traffic:${driver.loop.id}`;
    vehicle.name = "পাড়ার চলন্ত সিএনজি";
    const referenced = new Set<Material | BaseTexture>();
    const casters = new Set(this.shadow.getShadowMap()?.renderList ?? []);
    const casting: Mesh[] = [];
    for (const mesh of vehicle.root.getChildMeshes()) {
      mesh.metadata = {
        ...mesh.metadata,
        staticBatchExclude: true,
        trafficId: vehicle.id,
      };
      if (mesh instanceof Mesh && casters.has(mesh)) casting.push(mesh);
      if (!mesh.material) continue;
      referenced.add(mesh.material);
      for (const tex of mesh.material.getActiveTextures()) referenced.add(tex);
    }
    for (const mat of this.scene.materials)
      if (!beforeMaterials.has(mat))
        this.lease.pool.register(mat, () => mat.dispose(false, false));
    for (const tex of this.scene.textures)
      if (!beforeTextures.has(tex))
        this.lease.pool.register(tex, () => tex.dispose());
    this.lease.pool.retain(vehicle.id, [...referenced]);
    this.lease.pool.sweep();
    const instance: TrafficInstance = {
      vehicle,
      wheels: vehicle.wheels ?? [],
      casters: casting,
      casting: true,
    };
    this.instances.set(driver.loop.id, instance);
    // Driver factory owns its rig/animations/materials; call it after capturing
    // the vehicle-only resource delta so those lifetimes remain independent.
    instance.releaseDriver = this.options.createDriver?.(vehicle, {
      x: 0,
      y: 0.31,
      z: 0.38,
      yaw: 0,
    });
  }
  private release(id: string) {
    const instance = this.instances.get(id);
    if (!instance) return;
    instance.releaseDriver?.();
    for (const mesh of instance.vehicle.root.getChildMeshes())
      this.shadow.removeShadowCaster(mesh);
    instance.vehicle.root.dispose(false, false);
    this.lease.pool.release(instance.vehicle.id);
    this.instances.delete(id);
  }
  tick(
    dt: number,
    player: TrafficOccupant,
    actors: readonly TrafficOccupant[],
    siren: boolean,
    tutorialSafe: boolean,
    paused: boolean,
  ) {
    if (this.disposed) return;
    const occupants = [player, ...actors];
    for (const driver of this.drivers) {
      const pose = driver.pose;
      const distance = Math.hypot(player.x - pose.x, player.z - pose.z);
      let instance = this.instances.get(driver.loop.id);
      if (
        !instance &&
        distance < this.quality.prefetchDistance &&
        !trafficBlocked(pose, occupants, 0)
      ) {
        this.create(driver);
        instance = this.instances.get(driver.loop.id);
      }
      if (!instance) continue;
      if (distance > this.quality.prefetchDistance + 17) {
        this.release(driver.loop.id);
        continue;
      }
      const previousMoved = driver.moved;
      driver.tick(
        dt,
        occupants,
        siren,
        tutorialSafe,
        paused || distance > this.quality.activeDistance + 14,
      );
      const next = driver.pose,
        moved = driver.moved - previousMoved;
      instance.vehicle.root.position.set(next.x, 0, next.z);
      instance.vehicle.root.rotation.y = next.yaw;
      instance.vehicle.root.computeWorldMatrix(true);
      for (const wheel of instance.wheels) wheel.rotation.x += moved / 0.285;
      const cast = distance < this.quality.shadowDistance;
      if (cast !== instance.casting) {
        instance.casting = cast;
        for (const mesh of instance.casters)
          if (cast) this.shadow.addShadowCaster(mesh);
          else this.shadow.removeShadowCaster(mesh);
      }
    }
  }
  setQuality(profile: {
    prefetchDistance: number;
    activeDistance: number;
    shadowDistance: number;
  }) {
    this.quality = { ...profile };
  }
  get poses() {
    return this.drivers.flatMap((driver) =>
      this.instances.has(driver.loop.id)
        ? [
            {
              id: `traffic:${driver.loop.id}`,
              name: "চলন্ত সিএনজি",
              ...driver.pose,
              speed: driver.speed,
              distance: driver.moved,
              waiting: driver.reason,
            },
          ]
        : [],
    );
  }
  get vehicles() {
    return [...this.instances.values()].map((instance) => instance.vehicle);
  }
  get obstacles() {
    return this.poses.map((pose) => ({
      id: pose.id,
      x: pose.x,
      z: pose.z,
      w:
        Math.abs(Math.cos(pose.yaw)) * 1.6 + Math.abs(Math.sin(pose.yaw)) * 2.9,
      d:
        Math.abs(Math.sin(pose.yaw)) * 1.6 + Math.abs(Math.cos(pose.yaw)) * 2.9,
      h: 1.9,
    }));
  }
  get cameraObstacles() {
    return this.obstacles.map((o) => ({ ...o, name: o.id, y: 0.95 }));
  }
  diagnostics() {
    return {
      loaded: this.instances.size,
      vehicles: this.poses,
      wheelRoots: [...this.instances.values()].reduce(
        (n, i) => n + i.wheels.length,
        0,
      ),
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const id of [...this.instances.keys()]) this.release(id);
    this.lease.release();
  }
}
