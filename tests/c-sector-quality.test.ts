import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { qualitySettings } from "../packages/shared/src/quality.ts";
import { worldCanWalk } from "../packages/shared/src/navigation.ts";
import { allSectorObstacles } from "../apps/game/src/sectorBlueprints.ts";

test("sector quality limits real shadow casters independently and preserves retained PBR geometry", async (t) => {
  const loader = registerHooks({
    resolve(specifier, context, next) {
      try {
        return next(specifier, context);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ERR_MODULE_NOT_FOUND")
          throw error;
        for (const suffix of [".ts", ".js"])
          try {
            return next(specifier + suffix, context);
          } catch {
            /* Match production Vite's TS/JS extension resolution. */
          }
        throw error;
      }
    },
  });
  const priorCanvas = Object.getOwnPropertyDescriptor(
    globalThis,
    "OffscreenCanvas",
  );
  // This records real Babylon geometry/resource behavior. A no-op text canvas
  // does not verify Bengali glyph shaping, rendered shadows or device FPS.
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
          get: (_target, key) =>
            key === "measureText" ? () => ({ width: 10 }) : () => {},
        },
      );
    }
    remove() {}
  }
  Object.defineProperty(globalThis, "OffscreenCanvas", {
    configurable: true,
    value: PaintCanvas,
  });
  const engine = new NullEngine(),
    scene = new Scene(engine);
  t.after(() => {
    engine.dispose();
    loader.deregister();
    if (priorCanvas)
      Object.defineProperty(globalThis, "OffscreenCanvas", priorCanvas);
    else Reflect.deleteProperty(globalThis, "OffscreenCanvas");
  });
  const { SectorManager } = await import("../apps/game/src/sectors.ts");
  const light = new DirectionalLight(
      "test sunlight",
      new Vector3(1, -1, 1),
      scene,
    ),
    shadow = new ShadowGenerator(64, light);
  const manager = new SectorManager(scene, shadow);
  const point = { x: -9.5, z: 34 };
  assert.ok(
    worldCanWalk(point.x, point.z, allSectorObstacles),
    "fixed profile comparison uses an actual authored connecting road",
  );
  const counts = () => ({
    meshes: scene.meshes.length,
    materials: scene.materials.length,
    textures: scene.textures.length,
  });
  const casterCount = () => shadow.getShadowMap()?.renderList?.length ?? 0;
  manager.setQuality(qualitySettings.desktop);
  manager.update(point);
  const high = manager.diagnostics(),
    highCasters = casterCount();
  assert.equal(high.active, 2);
  assert.equal(high.shadowed, 2);
  assert.ok(highCasters > 0);
  assert.equal(high.budgets.active, 34);
  assert.equal(high.budgets.prefetch, 65);
  assert.equal(high.shadowDistance, 34);
  const committee = manager.handles.find(
    (handle) => handle.id === "committee-lane",
  )!;
  const retainedGeometry = committee.meshes.map((mesh) => ({
    mesh,
    geometry: mesh.geometry,
    material: mesh.material,
    textures: mesh.material?.getActiveTextures() ?? [],
    vertices: mesh.getTotalVertices(),
  }));
  const poster = manager.handles.find(
    (handle) => handle.id === "poster-quarter",
  )!;
  assert.equal(poster.visible, true);
  manager.setQuality(qualitySettings["mobile-low"]);
  manager.update(point);
  const low = manager.diagnostics();
  assert.equal(low.budgets.active, 22);
  assert.equal(low.budgets.prefetch, 45);
  assert.equal(low.shadowDistance, 20);
  assert.equal(low.active, 1);
  assert.ok(low.visible < high.visible);
  assert.equal(
    committee.active,
    true,
    "21.5m committee stays inside the low AI radius",
  );
  assert.equal(
    committee.shadows,
    false,
    "a lower shadow radius is independent from still-active AI",
  );
  assert.equal(low.shadowed, 0);
  assert.equal(casterCount(), 0);
  assert.equal(
    poster.visible,
    false,
    "58.5m poster geometry exceeds the new58m visible hysteresis",
  );
  let pbrCount = 0,
    signCount = 0;
  for (const retained of retainedGeometry) {
    assert.ok(!retained.mesh.isDisposed());
    assert.equal(retained.mesh.geometry, retained.geometry);
    assert.equal(retained.mesh.material, retained.material);
    assert.equal(retained.mesh.getTotalVertices(), retained.vertices);
    if (retained.material instanceof PBRMaterial) pbrCount++;
    else {
      // Existing vehicle lettering uses textured ink rather than a PBR body
      // material. It must keep its real Bengali sign texture on profile changes.
      assert.ok(
        retained.material instanceof StandardMaterial &&
          retained.material.diffuseTexture instanceof DynamicTexture,
        `${retained.mesh.name}: non-PBR geometry must carry a real sign texture`,
      );
      signCount++;
    }
    assert.ok(scene.materials.includes(retained.material!));
    assert.deepEqual(retained.material!.getActiveTextures(), retained.textures);
    for (const texture of retained.textures)
      assert.ok(scene.textures.includes(texture));
  }
  assert.ok(pbrCount > 0, "retained architecture and vehicles use PBR materials");
  assert.ok(signCount > 0, "retained Bengali vehicle signs stay textured");
  // Warm one round before comparing repeated profile changes: an initial
  // prefetch can construct a new palette entry without being a resource leak.
  manager.setQuality(qualitySettings.desktop);
  manager.update(point);
  manager.setQuality(qualitySettings["mobile-low"]);
  manager.update(point);
  const warmedLow = counts();
  for (let cycle = 0; cycle < 3; cycle++) {
    manager.setQuality(qualitySettings.desktop);
    manager.update(point);
    manager.setQuality(qualitySettings["mobile-low"]);
    manager.update(point);
    assert.deepEqual(
      counts(),
      warmedLow,
      "profile toggles preserve bounded real mesh/material/texture ownership",
    );
    assert.equal(casterCount(), 0);
  }
  manager.setQuality(qualitySettings.desktop);
  const committeeShadow = () =>
    manager.handles.find((handle) => handle.id === "committee-lane")!.shadows;
  for (const [x, expected] of [
    [3, true],
    [8, true],
    [10, false],
    [8, false],
    [3, true],
  ] as const) {
    assert.ok(worldCanWalk(x, 34, allSectorObstacles));
    manager.update({ x, z: 34 });
    assert.equal(
      committeeShadow(),
      expected,
      `High shadow entry34m/exit40m hysteresis atx${x}`,
    );
    assert.ok(manager.diagnostics().active <= 2);
    assert.ok(manager.diagnostics().shadowed <= 2);
    assert.ok(
      manager.handles
        .filter((handle) => handle.id.startsWith("road:"))
        .every((handle) => !handle.shadows),
      "road sectors do not silently enter the old encounter-only shadow pass",
    );
  }
  manager.update({ x: 66, z: 45 });
  const overlap = manager.diagnostics();
  assert.ok(
    overlap.status.filter(
      (status) => !status.id.startsWith("road:") && status.distance < 34,
    ).length >= 3,
  );
  assert.equal(overlap.active, 2);
  assert.equal(overlap.shadowed, 2);
  const foreign = new PBRMaterial("Later unrelated character paint", scene);
  manager.dispose();
  manager.dispose();
  assert.ok(
    scene.materials.includes(foreign),
    "sector cleanup cannot dispose root-owned later materials",
  );
  assert.equal(
    casterCount(),
    0,
    "disposal unregisters the actual shadow render list",
  );
  foreign.dispose();
  t.diagnostic(
    JSON.stringify({
      mode: "NullEngine geometry/resource test; no visual/FPS acceptance",
      high: {
        active: high.active,
        visible: high.visible,
        shadowed: high.shadowed,
        casters: highCasters,
      },
      low: { active: low.active, visible: low.visible, shadowed: low.shadowed },
      repeatedProfileCycles: 3,
      warmedLow,
    }),
  );
});
