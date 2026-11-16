import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

type Accessor = {
  bufferView: number;
  byteOffset?: number;
  count: number;
  componentType: number;
  type: string;
};
type Animation = {
  name: string;
  samplers: { input: number; output: number; interpolation: string }[];
  channels: { sampler: number; target: { node: number; path: string } }[];
  extras?: { durationSeconds: number; loop: boolean };
};
type Gltf = {
  nodes: { name: string }[];
  meshes: unknown[];
  skins: { joints: number[] }[];
  materials: unknown[];
  scenes: unknown[];
  accessors: Accessor[];
  bufferViews: {
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
  }[];
  buffers: { byteLength: number }[];
  animations: Animation[];
};

// Read the immutable accepted-A artifact without requiring an OS unzip command
// or adding a second copy of the same character to the repository.
function archivedModel(): Buffer {
  const zip = readFileSync(
    new URL(
      "../assets/source/archive/milestone-a-accepted-20261103.zip",
      import.meta.url,
    ),
  );
  for (let offset = 0; offset + 46 <= zip.length; offset++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) continue;
    const nameLength = zip.readUInt16LE(offset + 28),
      extraLength = zip.readUInt16LE(offset + 30),
      commentLength = zip.readUInt16LE(offset + 32),
      name = zip
        .subarray(offset + 46, offset + 46 + nameLength)
        .toString("utf8");
    if (name === "public/assets/models/dhaka-character.glb") {
      const localOffset = zip.readUInt32LE(offset + 42);
      assert.equal(zip.readUInt32LE(localOffset), 0x04034b50);
      const start =
          localOffset +
          30 +
          zip.readUInt16LE(localOffset + 26) +
          zip.readUInt16LE(localOffset + 28),
        compressedSize = zip.readUInt32LE(offset + 20),
        method = zip.readUInt16LE(offset + 10),
        compressed = zip.subarray(start, start + compressedSize);
      assert.ok(method === 0 || method === 8);
      const model = method === 8 ? inflateRawSync(compressed) : compressed;
      assert.equal(model.length, zip.readUInt32LE(offset + 24));
      assert.equal(
        createHash("sha256").update(model).digest("hex"),
        "b22bc7e632c4d5969d79881686a4a4b3487a3202e14f2513b059b24ce7437a3b",
        "accepted-A character must not silently be replaced with a new baseline",
      );
      return model;
    }
    offset += 45 + nameLength + extraLength + commentLength;
  }
  throw new Error("Accepted-A character is missing from its snapshot");
}

function parseGlb(bytes: Buffer): { gltf: Gltf; bin: Buffer } {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12),
    binaryHeader = 20 + jsonLength;
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  assert.equal(bytes.readUInt32LE(binaryHeader + 4), 0x004e4942);
  return {
    gltf: JSON.parse(bytes.subarray(20, binaryHeader).toString("utf8")),
    bin: bytes.subarray(
      binaryHeader + 8,
      binaryHeader + 8 + bytes.readUInt32LE(binaryHeader),
    ),
  };
}

const current = parseGlb(
  readFileSync(
    new URL("../public/assets/models/dhaka-character.glb", import.meta.url),
  ),
);

function rows(accessorIndex: number): number[][] {
  const accessor = current.gltf.accessors[accessorIndex],
    view = current.gltf.bufferViews[accessor.bufferView],
    components = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type];
  assert.equal(accessor.componentType, 5126);
  assert.ok(components);
  const stride = view.byteStride ?? components * 4,
    start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return Array.from({ length: accessor.count }, (_, row) =>
    Array.from({ length: components }, (_, component) =>
      current.bin.readFloatLE(start + row * stride + component * 4),
    ),
  );
}

function clip(name: string): Animation {
  const animation = current.gltf.animations.find((a) => a.name === name);
  assert.ok(animation, `required motion ${name} must exist`);
  return animation;
}

function track(animation: Animation, bone: string, path: string): number[][] {
  const node = current.gltf.nodes.findIndex((n) => n.name === bone),
    channel = animation.channels.find(
      (c) => c.target.node === node && c.target.path === path,
    );
  assert.ok(channel, `${animation.name} requires a ${bone} ${path} track`);
  return rows(animation.samplers[channel.sampler].output);
}

function nearRow(actual: number[], expected: number[]) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) =>
    assert.ok(Math.abs(value - expected[index]) < 1e-6),
  );
}

test("boarding adds clips without modifying accepted character geometry, rig or six old motions", () => {
  const accepted = parseGlb(archivedModel());
  for (const key of [
    "nodes",
    "meshes",
    "skins",
    "materials",
    "scenes",
  ] as const)
    assert.deepEqual(current.gltf[key], accepted.gltf[key], key);
  assert.deepEqual(
    current.gltf.animations.slice(0, accepted.gltf.animations.length),
    accepted.gltf.animations,
  );
  assert.deepEqual(
    current.gltf.accessors.slice(0, accepted.gltf.accessors.length),
    accepted.gltf.accessors,
  );
  assert.deepEqual(
    current.gltf.bufferViews.slice(0, accepted.gltf.bufferViews.length),
    accepted.gltf.bufferViews,
  );
  assert.deepEqual(
    current.bin.subarray(0, accepted.gltf.buffers[0].byteLength),
    accepted.bin,
    "all accepted mesh, skin and animation binary data must remain byte-identical",
  );
  assert.deepEqual(
    current.gltf.animations.map((a) => a.name),
    [
      "Idle",
      "Walk",
      "Run",
      "Throw",
      "Hit",
      "Pickup",
      "EnterVehicle",
      "Seated",
      "ExitVehicle",
    ],
  );
});

test("boarding clips contain timed, finite, normalized animation of the existing skeleton", () => {
  const joints = new Set(current.gltf.skins[0].joints);
  for (const [name, duration] of [
    ["EnterVehicle", 1.4],
    ["Seated", 2.6],
    ["ExitVehicle", 1.25],
  ] as const) {
    const animation = clip(name);
    assert.equal(animation.extras?.durationSeconds, duration);
    assert.equal(animation.extras?.loop, name === "Seated");
    assert.ok(animation.channels.length >= 10);
    for (const channel of animation.channels) {
      assert.ok(joints.has(channel.target.node));
      const sampler = animation.samplers[channel.sampler],
        times = rows(sampler.input).flat(),
        values = rows(sampler.output);
      assert.equal(sampler.interpolation, "LINEAR");
      assert.equal(times.length, values.length);
      assert.ok(times.length >= 20);
      assert.equal(times[0], 0);
      assert.ok(Math.abs(times.at(-1)! - duration) < 1e-6);
      times.forEach((time, index) => {
        assert.ok(Number.isFinite(time));
        if (index) assert.ok(time > times[index - 1]);
      });
      for (const row of values) {
        assert.ok(row.every(Number.isFinite));
        if (channel.target.path === "rotation")
          assert.ok(Math.abs(Math.hypot(...row) - 1) < 1e-6);
      }
    }
  }
});

test("entering reaches the folded seated pose, seated loops, and exit unfolds continuously", () => {
  const enter = clip("EnterVehicle"),
    seated = clip("Seated"),
    exit = clip("ExitVehicle");
  for (const channel of seated.channels) {
    const bone = current.gltf.nodes[channel.target.node].name,
      seatedTrack = track(seated, bone, channel.target.path),
      enterTrack = track(enter, bone, channel.target.path),
      exitTrack = track(exit, bone, channel.target.path);
    nearRow(enterTrack.at(-1)!, seatedTrack[0]);
    nearRow(seatedTrack[0], seatedTrack.at(-1)!);
    nearRow(exitTrack[0], seatedTrack[0]);
  }
  const seatedHips = track(seated, "Pelvis", "translation");
  for (const row of seatedHips) nearRow(row, [0, 0.56, 0]);
  nearRow(track(enter, "Pelvis", "translation")[0], [0, 0.91, 0]);
  nearRow(track(exit, "Pelvis", "translation").at(-1)!, [0, 0.91, 0]);
  // A seated portrait or renamed idle clip would fail these knee/hip checks.
  for (const bone of ["Thigh.L", "Thigh.R", "Shin.L", "Shin.R"])
    assert.ok(Math.abs(track(seated, bone, "rotation")[0][0]) > 0.6);
  const chest = track(seated, "Chest", "rotation");
  assert.ok(
    Math.max(...chest.map((row) => row[0])) -
      Math.min(...chest.map((row) => row[0])) >
      0.005,
    "seated breathing must contain observable skeletal motion",
  );
});
