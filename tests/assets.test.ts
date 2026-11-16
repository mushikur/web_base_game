import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("shipped GLB contains a complete skinned slice character and required motions", () => {
  const bytes = readFileSync(
    new URL("../public/assets/models/dhaka-character.glb", import.meta.url),
  );
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  assert.equal(gltf.skins[0].joints.length, 17);
  for (const required of ["Idle", "Walk", "Run", "Throw", "Hit", "Pickup"])
    assert.ok(
      gltf.animations.some((a: { name: string }) => a.name === required),
    );
  for (const required of [
    "Pelvis",
    "Chest",
    "Head",
    "UpperArm.R",
    "Hand.R",
    "Thigh.L",
    "Foot.R",
  ])
    assert.ok(gltf.nodes.some((n: { name: string }) => n.name === required));
  for (const mesh of gltf.meshes)
    for (const p of mesh.primitives) {
      assert.ok(p.attributes.JOINTS_0 !== undefined);
      assert.ok(p.attributes.WEIGHTS_0 !== undefined);
      assert.ok(p.attributes.NORMAL !== undefined);
      assert.equal(
        gltf.accessors[p.attributes.POSITION].count,
        gltf.accessors[p.attributes.WEIGHTS_0].count,
      );
    }
  const binaryStart = 20 + jsonLength + 8;
  for (const accessor of gltf.accessors) {
    if (accessor.type !== "VEC4" || accessor.componentType !== 5126) continue;
    const view = gltf.bufferViews[accessor.bufferView],
      offset =
        binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    // JOINT weights are the VEC4 accessors referenced by WEIGHTS_0, not animation rotations.
    if (
      !gltf.meshes.some(
        (m: { primitives: { attributes: { WEIGHTS_0: number } }[] }) =>
          m.primitives.some(
            (p) => gltf.accessors[p.attributes.WEIGHTS_0] === accessor,
          ),
      )
    )
      continue;
    for (let row = 0; row < accessor.count; row++) {
      let sum = 0;
      for (let c = 0; c < 4; c++) {
        const weight = bytes.readFloatLE(offset + (row * 4 + c) * 4);
        assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1);
        sum += weight;
      }
      assert.ok(
        Math.abs(sum - 1) < 1e-6,
        "skinned garment weights must be normalized",
      );
    }
  }
  assert.ok(
    bytes.length < 1_000_000,
    "character must remain below the slice download budget",
  );
});
