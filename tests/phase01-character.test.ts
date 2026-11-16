import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type Accessor = { bufferView: number; byteOffset?: number; count: number };
type Character = {
  nodes: { name: string; translation?: number[] }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
  accessors: Accessor[];
  skins: { joints: number[]; inverseBindMatrices: number }[];
  meshes: {
    name: string;
    primitives: { attributes: Record<string, number> }[];
  }[];
  animations: {
    name: string;
    channels: unknown[];
    samplers: { input: number; output: number }[];
  }[];
};

function load(filename: string) {
  const bytes = readFileSync(
    new URL(`../public/assets/models/${filename}.glb`, import.meta.url),
  );
  const jsonSize = bytes.readUInt32LE(12);
  const data = JSON.parse(
    bytes.toString("utf8", 20, 20 + jsonSize),
  ) as Character;
  return {
    data,
    size: bytes.length,
    buffer(index: number) {
      const a = data.accessors[index];
      const view = data.bufferViews[a.bufferView];
      const offset =
        28 + jsonSize + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
      return bytes.subarray(offset, offset + view.byteLength);
    },
  };
}

test("Phase 01 faces are bound to the unchanged animated rig and retain the original motion bank", () => {
  const base = load("dhaka-character");
  const revised = load("dhaka-character-phase01");
  const src = base.data.skins[0],
    dst = revised.data.skins[0];
  assert.deepEqual(
    dst.joints.map((i) => revised.data.nodes[i]),
    src.joints.map((i) => base.data.nodes[i]),
  );
  assert.deepEqual(
    revised.buffer(dst.inverseBindMatrices),
    base.buffer(src.inverseBindMatrices),
  );
  assert.equal(revised.data.animations.length, base.data.animations.length);
  for (const [i, clip] of revised.data.animations.entries()) {
    const old = base.data.animations[i];
    assert.equal(clip.name, old.name);
    assert.deepEqual(clip.channels, old.channels);
    for (const [j, sample] of clip.samplers.entries()) {
      assert.deepEqual(
        revised.buffer(sample.input),
        base.buffer(old.samplers[j].input),
      );
      assert.deepEqual(
        revised.buffer(sample.output),
        base.buffer(old.samplers[j].output),
      );
    }
  }
  const face = revised.data.meshes.filter((m) =>
    m.name.includes("Face variant "),
  );
  assert.equal(face.length, 3);
  const head = dst.joints.findIndex(
    (i) => revised.data.nodes[i].name === "Head",
  );
  for (const mesh of face) {
    const a = mesh.primitives[0].attributes;
    assert.ok(revised.data.accessors[a.POSITION].count > 1500);
    assert.equal(
      revised.data.accessors[a.COLOR_0].count,
      revised.data.accessors[a.POSITION].count,
    );
    const joints = revised.buffer(a.JOINTS_0);
    const weights = revised.buffer(a.WEIGHTS_0);
    for (let i = 0; i < revised.data.accessors[a.POSITION].count; i++) {
      assert.equal(joints.readUInt16LE(i * 8), head);
      assert.equal(weights.readFloatLE(i * 16), 1);
    }
  }
  assert.ok(revised.size < 2_000_000);
});

test("The cricket player keeps the shipped bind pose and every locomotion, combat and boarding clip", () => {
  const base = load("dhaka-character-phase01");
  const hero = load("dhaka-character-hero");
  const originalRig = base.data.skins[0];
  const heroRig = hero.data.skins[0];
  assert.deepEqual(
    heroRig.joints.map((index) => [hero.data.nodes[index].name, hero.data.nodes[index].translation]),
    originalRig.joints.map((index) => [base.data.nodes[index].name, base.data.nodes[index].translation]),
  );
  assert.deepEqual(hero.buffer(heroRig.inverseBindMatrices), base.buffer(originalRig.inverseBindMatrices));
  assert.equal(hero.data.animations.length, base.data.animations.length);
  for (const [index, clip] of hero.data.animations.entries()) {
    const original = base.data.animations[index];
    assert.equal(clip.name, original.name);
    assert.deepEqual(clip.channels, original.channels);
    assert.equal(clip.samplers.length, original.samplers.length);
    for (const [sampleIndex, sample] of clip.samplers.entries()) {
      const originalSample = original.samplers[sampleIndex];
      assert.deepEqual(hero.buffer(sample.input), base.buffer(originalSample.input));
      assert.deepEqual(hero.buffer(sample.output), base.buffer(originalSample.output));
    }
  }
  assert.ok(hero.size < 2_000_000);
});
