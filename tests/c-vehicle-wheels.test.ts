import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial.js";

// Production uses Vite extension resolution. This test's native Node loader
// resolves the same TS/JS entry points without changing the production sources.
const loader = registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ERR_MODULE_NOT_FOUND")
        throw error;
      for (const suffix of [".ts", ".js"]) {
        try {
          return next(specifier + suffix, context);
        } catch {
          /* try next suffix */
        }
      }
      throw error;
    }
  },
});
// NullEngine verifies actual geometry/hierarchies, not typography. This no-op
// canvas exists only for the factory's existing text-painting calls; screenshot
// and Bengali-shaping acceptance still require the real browser renderer.
class PaintCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return new Proxy(
      {},
      {
        get: (_, property) =>
          property === "measureText" ? () => ({ width: 10 }) : () => {},
      },
    );
  }
  remove() {}
}

test("moving CNG retains all three real wheel centers and default parked silhouette", async (t) => {
  const oldCanvas = Object.getOwnPropertyDescriptor(
    globalThis,
    "OffscreenCanvas",
  );
  Object.defineProperty(globalThis, "OffscreenCanvas", {
    configurable: true,
    value: PaintCanvas,
  });
  const engine = new NullEngine(),
    scene = new Scene(engine);
  t.after(() => {
    engine.dispose();
    loader.deregister();
    if (oldCanvas)
      Object.defineProperty(globalThis, "OffscreenCanvas", oldCanvas);
    else Reflect.deleteProperty(globalThis, "OffscreenCanvas");
  });
  const { createCNG } = await import("../apps/game/src/vehicles.ts");
  const light = new DirectionalLight(
    "test sunlight",
    new Vector3(1, -1, 1),
    scene,
  );
  const shadow = new ShadowGenerator(64, light);
  const parked = createCNG(scene, shadow, new Vector3(0, 0, 0), 0);
  const moving = createCNG(scene, shadow, new Vector3(0, 0, 0), 0, {
    movingWheels: true,
  });
  assert.equal(parked.wheels?.length, 0);
  assert.equal(moving.wheels?.length, 3);
  const parkedBounds = parked.root.getHierarchyBoundingVectors(true);
  const movingBounds = moving.root.getHierarchyBoundingVectors(true);
  assert.ok(Vector3.Distance(parkedBounds.min, movingBounds.min) < 0.001);
  assert.ok(Vector3.Distance(parkedBounds.max, movingBounds.max) < 0.001);
  moving.root.position.set(50, 0, 34);
  moving.root.rotation.y = Math.PI / 2;
  const wheelLocal = [
    new Vector3(-0.59, 0.285, -0.73),
    new Vector3(0.59, 0.285, -0.73),
    new Vector3(0, 0.285, 1.02),
  ];
  for (let i = 0; i < 3; i++) {
    const wheel: TransformNode = moving.wheels![i];
    const expected = Vector3.TransformCoordinates(
      wheelLocal[i],
      moving.root.computeWorldMatrix(true),
    );
    wheel.computeWorldMatrix(true);
    assert.ok(Vector3.Distance(wheel.getAbsolutePosition(), expected) < 0.0001);
    assert.ok(
      wheel.getChildMeshes().length <= 3,
      "detailed spokes/tread batch per material",
    );
    const before: number[][] = wheel
      .getChildMeshes()
      .map((mesh) => [...(mesh.getVerticesData("position") ?? [])]);
    wheel.rotation.x = Math.PI / 2;
    for (const mesh of wheel.getChildMeshes()) mesh.computeWorldMatrix(true);
    assert.ok(Vector3.Distance(wheel.getAbsolutePosition(), expected) < 0.0001);
    assert.deepEqual(
      wheel
        .getChildMeshes()
        .map((mesh) => [...(mesh.getVerticesData("position") ?? [])]),
      before,
    );
  }
  const { SectorManager } = await import("../apps/game/src/sectors.ts");
  const { SectorTraffic } = await import("../apps/game/src/sectorTraffic.ts");
  const manager = new SectorManager(scene, shadow);
  const foreign = new PBRMaterial("Later root-owned character material", scene);
  manager.update({ x: 0, z: 0 });
  assert.ok(manager.handles.length > 0);
  const firstLoad = manager.handles.map((handle) => ({
    id: handle.id,
    meshes: handle.meshes.length,
  }));
  assert.ok(
    manager.handles.every((handle) => handle.meshes.length < 115),
    "detailed architecture and parked vehicles are locally batched",
  );
  manager.update({ x: 78, z: 91 });
  manager.update({ x: -48, z: 52 });
  manager.update({ x: 1000, z: 1000 });
  const cold = {
    meshes: scene.meshes.length,
    materials: scene.materials.length,
    textures: scene.textures.length,
  };
  for (let tour = 0; tour < 3; tour++) {
    manager.update({ x: 0, z: 0 });
    manager.update({ x: 78, z: 91 });
    manager.update({ x: -48, z: 52 });
    manager.update({ x: 1000, z: 1000 });
  }
  assert.deepEqual(
    {
      meshes: scene.meshes.length,
      materials: scene.materials.length,
      textures: scene.textures.length,
    },
    cold,
    "repeated sector tours must release real Babylon meshes/materials/textures",
  );
  let driversCreated = 0,
    driversReleased = 0;
  const traffic = new SectorTraffic(scene, shadow, {
    createDriver(_vehicle, pose) {
      driversCreated++;
      assert.deepEqual(pose, { x: 0, y: 0.31, z: 0.38, yaw: 0 });
      return () => driversReleased++;
    },
  });
  traffic.tick(0.05, { x: 30, z: 34 }, [], false, false, false);
  assert.equal(traffic.vehicles.length, 2);
  manager.dispose();
  assert.ok(
    scene.materials.includes(foreign),
    "environment disposal must preserve later root-owned resources",
  );
  for (const vehicle of traffic.vehicles)
    for (const mesh of vehicle.root.getChildMeshes())
      if (mesh.material)
        assert.ok(
          scene.materials.includes(mesh.material),
          "remaining traffic retains shared paint",
        );
  traffic.dispose();
  traffic.dispose();
  assert.equal(driversCreated, 2);
  assert.equal(driversReleased, 2);
  t.diagnostic(
    JSON.stringify({
      mode: "NullEngine geometry/resource checks; no visual or FPS claim",
      firstLoad,
      coldAfterWarmTour: cold,
      repeatedTours: 3,
      trafficDrivers: driversCreated,
    }),
  );
});
