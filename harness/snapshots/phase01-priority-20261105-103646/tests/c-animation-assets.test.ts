import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

type Accessor = {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
};
type Gltf = {
  nodes: { name: string; translation: number[]; children?: number[] }[];
  animations: {
    name: string;
    extras: { durationSeconds: number; loop: boolean };
    samplers: { input: number; output: number }[];
    channels: { sampler: number; target: { node: number; path: string } }[];
  }[];
  accessors: Accessor[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
  meshes?: unknown[];
};
function readGlb(path: string) {
  const bytes = readFileSync(path);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12),
    json = JSON.parse(
      bytes.subarray(20, 20 + jsonLength).toString("utf8"),
    ) as Gltf;
  return { bytes, json, bin: bytes.subarray(28 + jsonLength) };
}
const bank = readGlb("public/assets/models/mission-animations.glb"),
  base = readGlb("public/assets/models/dhaka-character.glb");
const array = (accessor: Accessor) => {
  assert.equal(accessor.componentType, 5126);
  const view = bank.json.bufferViews[accessor.bufferView],
    offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0),
    width = accessor.type === "VEC4" ? 4 : accessor.type === "VEC3" ? 3 : 1;
  return Array.from({ length: accessor.count * width }, (_, i) =>
    bank.bin.readFloatLE(offset + i * 4),
  );
};
test("mission motion bank preserves every base byte and matches all17 real rest joints", () => {
  assert.equal(
    createHash("sha256").update(base.bytes).digest("hex"),
    "41798de6425d8faa6308183dab5825951dfeef287b2d2c442fb04ae4ba4cf789",
  );
  assert.equal(bank.json.nodes.length, 17);
  for (const node of bank.json.nodes) {
    const original = base.json.nodes.find((n) => n.name === node.name);
    assert.ok(original);
    assert.deepEqual(node.translation, original.translation);
  }
  assert.equal(
    bank.json.meshes?.length ?? 0,
    0,
    "independent bank must not duplicate geometry or static portraits",
  );
  assert.ok(bank.bytes.length < 180_000);
});
test("required gestures contain finite normalized joint motions with positive exact durations and seamless loops", () => {
  const names = [
    "Speech",
    "Warn",
    "Cover",
    "Phone",
    "EggReact",
    "SandalReact",
    "Defeated",
    "Resting",
    "Assist",
    "Carry",
    "AssistedWalk",
    "Loading",
  ];
  assert.deepEqual(
    bank.json.animations.map((a) => a.name),
    names,
  );
  for (const animation of bank.json.animations) {
    assert.equal(animation.channels.length, 18);
    assert.ok(animation.extras.durationSeconds > 0);
    let changes = 0;
    for (const channel of animation.channels) {
      const sampler = animation.samplers[channel.sampler],
        input = array(bank.json.accessors[sampler.input]),
        values = array(bank.json.accessors[sampler.output]);
      assert.equal(input[0], 0);
      assert.ok(
        Math.abs(input.at(-1)! - animation.extras.durationSeconds) < 1e-6,
      );
      assert.ok(input.every((time, i) => i === 0 || time > input[i - 1]));
      assert.ok(values.every(Number.isFinite));
      const width = channel.target.path === "rotation" ? 4 : 3;
      for (let i = width; i < values.length; i++)
        if (Math.abs(values[i] - values[i - width]) > 1e-4) changes++;
      if (width === 4)
        for (let i = 0; i < values.length; i += 4)
          assert.ok(Math.abs(Math.hypot(...values.slice(i, i + 4)) - 1) < 1e-6);
      if (animation.extras.loop)
        for (let i = 0; i < width; i++)
          assert.ok(
            Math.abs(values[i] - values[values.length - width + i]) < 1e-6,
            `${animation.name}/${bank.json.nodes[channel.target.node].name} has a seamless loop`,
          );
    }
    assert.ok(changes > 5, `${animation.name} needs actual skeletal motion`);
  }
});
test("defeated and resting pelvis poses join without a positional pop", () => {
  const pelvis = (name: string) => {
    const animation = bank.json.animations.find((a) => a.name === name)!,
      channel = animation.channels.find(
        (c) => c.target.path === "translation",
      )!;
    return array(
      bank.json.accessors[animation.samplers[channel.sampler].output],
    );
  };
  const defeated = pelvis("Defeated"),
    resting = pelvis("Resting");
  for (let i = 0; i < 3; i++)
    assert.ok(Math.abs(defeated[defeated.length - 3 + i] - resting[i]) < 1e-6);
  assert.ok(defeated[1] - defeated[defeated.length - 2] > 0.3);
});

test("Babylon actually imports the meshless bank and maps its motions onto real skinned instance joints", async () => {
  const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
  const { Scene } = await import("@babylonjs/core/scene.js");
  const { TransformNode } =
    await import("@babylonjs/core/Meshes/transformNode.js");
  const { LoadAssetContainerAsync } =
    await import("@babylonjs/core/Loading/sceneLoader.js");
  await import("@babylonjs/loaders/glTF/index.js");
  const engine = new NullEngine(),
    scene = new Scene(engine);
  const source = await LoadAssetContainerAsync(
    new Uint8Array(bank.bytes),
    scene,
    { pluginExtension: ".glb" },
  );
  const model = await LoadAssetContainerAsync(
    new Uint8Array(base.bytes),
    scene,
    { pluginExtension: ".glb" },
  );
  const instance = model.instantiateModelsToScene(
    (name) => `পরীক্ষা/${name}`,
    false,
    { doNotInstantiate: true },
  );
  const root = new TransformNode("পরীক্ষার চরিত্র", scene);
  instance.rootNodes.forEach((node) => {
    node.parent = root;
  });
  const leaf = (name: string) => name.slice(name.lastIndexOf("/") + 1);
  const nodes = new Map(
    root.getDescendants(false).map((node) => [leaf(node.name), node]),
  );
  const targetNodes = new Set(nodes.values());
  const clones = source.animationGroups.map((group) =>
    group.clone(
      `পরীক্ষা/${group.name}`,
      (target) => nodes.get(leaf(target.name)),
      true,
      false,
    ),
  );
  try {
    assert.equal(source.transformNodes.length, 17);
    assert.equal(clones.length, 12);
    assert.equal(instance.skeletons.length, 1);
    for (const group of clones)
      for (const targeted of group.targetedAnimations)
        assert.ok(
          targetNodes.has(targeted.target),
          "all animation channels map to this actual skinned instance, never the unloaded source bank",
        );
    const speech = clones.find((group) => group.name.endsWith("/Speech"))!,
      arm = nodes.get("UpperArm.R") as InstanceType<typeof TransformNode>;
    speech.start(true);
    speech.goToFrame(speech.from + 0.8 * 60);
    assert.ok(
      Math.abs(arm.rotationQuaternion!.x) > 0.1,
      "authored speech changes actual instance arm transform",
    );
    instance.skeletons[0].prepare();
    assert.ok(
      Array.from(
        instance.skeletons[0].getTransformMatrices(
          instance
            .rootNodes[0] as import("@babylonjs/core/Meshes/abstractMesh.js").AbstractMesh,
        ),
      ).every(Number.isFinite),
    );
    const before = root.getChildMeshes().length;
    for (const group of clones) group.dispose();
    assert.equal(
      root.getChildMeshes().length,
      before,
      "disposing bound animation groups never deletes the character geometry",
    );
    assert.ok(!root.isDisposed());
  } finally {
    for (const group of clones) group.dispose();
    instance.dispose();
    source.dispose();
    model.dispose();
    root.dispose();
    scene.dispose();
    engine.dispose();
  }
});
