import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial.js";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import "@babylonjs/loaders/glTF/index.js";

test("carried banner follows the original rig and releases only its owned resources", async (t) => {
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
            /* Vite resolves the same original TS/JS entry points. */
          }
        throw error;
      }
    },
  });
  const written: string[] = [],
    priorCanvas = Object.getOwnPropertyDescriptor(
      globalThis,
      "OffscreenCanvas",
    );
  // Geometry/ownership tests do not verify typography. Painting is recorded;
  // real Bengali glyph shaping remains the browser acceptance gate.
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
            key === "fillText"
              ? (text: string) => written.push(text)
              : key === "measureText"
                ? () => ({ width: 10 })
                : () => {},
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
  const { attachWorkerBanner } =
    await import("../apps/game/src/workerBanner.ts");
  const bytes = await readFile("public/assets/models/dhaka-character.glb");
  const source = await LoadAssetContainerAsync(new Uint8Array(bytes), scene, {
    pluginExtension: ".glb",
  });
  const instance = source.instantiateModelsToScene(
    (name) => `কর্মী/${name}`,
    false,
    { doNotInstantiate: true },
  );
  const actor = new TransformNode("পরীক্ষার কর্মী", scene);
  instance.rootNodes.forEach((node) => {
    node.parent = actor;
  });
  actor.position.set(37, 0.2, 54);
  actor.rotation.y = 0.4;
  const light = new DirectionalLight("test", new Vector3(1, -1, 1), scene),
    shadow = new ShadowGenerator(64, light);
  const counts = () => ({
    meshes: scene.meshes.length,
    materials: scene.materials.length,
    textures: scene.textures.length,
  });
  const baseline = counts(),
    baseMeshCount = actor.getChildMeshes().length;
  const banner = attachWorkerBanner(scene, actor, shadow, "নেতা এগিয়ে চলো!");
  const hand = actor
    .getDescendants(false)
    .find((node) => node.name.endsWith("/Hand.L")) as TransformNode;
  const carried = actor
    .getDescendants(false)
    .find(
      (node) => node.name === "পরীক্ষার কর্মী হাতের ব্যানার",
    ) as TransformNode;
  assert.equal(carried.parent, hand);
  assert.equal(
    carried.getChildMeshes().length,
    6,
    "detailed parts batch into six owned material groups",
  );
  const front = carried
    .getChildMeshes()
    .find((mesh) => mesh.name.endsWith("বাংলা লেখা সামনে"))!;
  const back = carried
    .getChildMeshes()
    .find((mesh) => mesh.name.endsWith("লেখাহীন পেছন"))!;
  assert.notEqual(
    front.material,
    back.material,
    "back never mirrors the front lettering",
  );
  const z = front
    .getVerticesData("position")!
    .filter((_value, index) => index % 3 === 2);
  assert.ok(
    Math.max(...z) - Math.min(...z) > 0.02,
    "actual cloth has draped folds, not a flat proxy",
  );
  const update = () => {
    actor.computeWorldMatrix(true);
    for (const node of actor.getDescendants(false))
      if (node instanceof TransformNode) node.computeWorldMatrix(true);
  };
  update();
  const first = Vector3.TransformCoordinates(
    new Vector3(0.7, 1, 0),
    carried.getWorldMatrix(),
  );
  hand.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, 0.45);
  update();
  const after = Vector3.TransformCoordinates(
    new Vector3(0.7, 1, 0),
    carried.getWorldMatrix(),
  );
  assert.ok(
    Vector3.Distance(first, after) > 0.2,
    "real hand motion moves the mounted cloth",
  );
  assert.ok(
    Vector3.Distance(
      carried.getAbsolutePosition(),
      hand.getAbsolutePosition(),
    ) < 0.12,
    "local batching does not bake and double the actor world position",
  );
  assert.deepEqual(written, ["নেতা এগিয়ে চলো!", "পথ খোলা রাখুন • সভা শেষে চা"]);
  banner.setEnabled(false);
  assert.equal(carried.isEnabled(), false);
  banner.setEnabled(true);
  assert.equal(carried.isEnabled(), true);
  const foreign = new PBRMaterial("Later unrelated material", scene);
  banner.dispose();
  banner.dispose();
  banner.setEnabled(true);
  assert.ok(carried.isDisposed());
  assert.ok(!actor.isDisposed());
  assert.equal(actor.getChildMeshes().length, baseMeshCount);
  assert.deepEqual(counts(), {
    ...baseline,
    materials: baseline.materials + 1,
  });
  assert.equal(scene.getMaterialByName(foreign.name), foreign);
  assert.equal(shadow.getShadowMap()?.renderList?.length ?? 0, 0);
  foreign.dispose();
  const invalidRoot = new TransformNode("নেই", scene),
    beforeInvalid = counts();
  assert.throws(
    () => attachWorkerBanner(scene, invalidRoot, shadow, "মাইক চলবে!"),
    /অস্থি/,
  );
  assert.deepEqual(
    counts(),
    beforeInvalid,
    "invalid rig cannot leak partial artwork",
  );
  invalidRoot.dispose();
  instance.dispose();
  source.dispose();
  actor.dispose();
  scene.dispose();
});
