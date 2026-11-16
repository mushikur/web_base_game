/** Calibrate mission contacts from the actual independent GLB animation keys,
 * full17joint FK and the unchanged base GLB's weighted sandal sole vertices. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
function parse(path) {
  const bytes = readFileSync(path),
    length = bytes.readUInt32LE(12),
    doc = JSON.parse(bytes.subarray(20, 20 + length).toString("utf8")),
    binary = bytes.subarray(28 + length);
  function accessor(id) {
    const a = doc.accessors[id],
      v = doc.bufferViews[a.bufferView],
      size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type],
      width = a.componentType === 5123 ? 2 : 4,
      offset = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: size }, (_, j) =>
        width === 2
          ? binary.readUInt16LE(offset + (i * size + j) * width)
          : binary.readFloatLE(offset + (i * size + j) * width),
      ),
    );
  }
  return { bytes, doc, accessor };
}
const base = parse("public/assets/models/dhaka-character.glb"),
  bank = parse("public/assets/models/mission-animations.glb");
const parents = new Map();
bank.doc.nodes.forEach((node, parent) =>
  node.children?.forEach((child) => parents.set(child, parent)),
);
const multiply = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const rotate = (q, p) =>
  multiply(multiply(q, [...p, 0]), [-q[0], -q[1], -q[2], q[3]]).slice(0, 3);
const jointIds = base.doc.skins[0].joints;
const basePositions = new Map();
function originalPosition(node) {
  if (basePositions.has(node)) return basePositions.get(node);
  const parent = base.doc.nodes.findIndex((n) => n.children?.includes(node)),
    own = base.doc.nodes[node].translation ?? [0, 0, 0],
    p = parent < 0 ? [0, 0, 0] : originalPosition(parent),
    value = own.map((n, i) => n + p[i]);
  basePositions.set(node, value);
  return value;
}
const soles = { L: [], R: [] };
for (const mesh of base.doc.meshes)
  if (mesh.name === "Leather sandals")
    for (const primitive of mesh.primitives) {
      const vertices = base.accessor(primitive.attributes.POSITION),
        joints = base.accessor(primitive.attributes.JOINTS_0),
        weights = base.accessor(primitive.attributes.WEIGHTS_0);
      for (let i = 0; i < vertices.length; i++) {
        const bone = joints[i][0],
          side = bone === 13 ? "L" : bone === 16 ? "R" : undefined;
        if (!side) continue;
        if (weights[i][0] !== 1)
          throw new Error(
            "Sole calibration requires the actual rigid-foot binding; do not silently guess blend weights.",
          );
        const name = base.doc.nodes[jointIds[bone]].name,
          bind = originalPosition(jointIds[bone]);
        soles[side].push({
          bone: bank.doc.nodes.findIndex((n) => n.name === name),
          local: vertices[i].map((n, axis) => n - bind[axis]),
        });
      }
    }
if (!soles.L.length || !soles.R.length)
  throw new Error("Real sole vertices are required.");
const result = {},
  durations = {};
for (const name of ["Carry", "AssistedWalk"]) {
  const animation = bank.doc.animations.find((a) => a.name === name),
    duration = animation.extras.durationSeconds;
  durations[name] = duration;
  const tracks = animation.channels.map((channel) => {
    const sampler = animation.samplers[channel.sampler];
    return {
      ...channel.target,
      times: bank.accessor(sampler.input).flat(),
      values: bank.accessor(sampler.output),
    };
  });
  const height = (phase, side) => {
    const positions = bank.doc.nodes.map((n) => [...n.translation]),
      rotations = bank.doc.nodes.map(() => [0, 0, 0, 1]);
    for (const track of tracks) {
      const time = phase * duration;
      let index = track.times.findIndex((n) => n >= time);
      if (index < 0) index = track.times.length - 1;
      const prior = Math.max(0, index - 1),
        span = track.times[index] - track.times[prior],
        t = span ? (time - track.times[prior]) / span : 0;
      let value = track.values[prior].map(
        (n, axis) => n + (track.values[index][axis] - n) * t,
      );
      if (track.path === "rotation") {
        const norm = Math.hypot(...value);
        value = value.map((n) => n / norm);
        rotations[track.node] = value;
      } else if (track.path === "translation") positions[track.node] = value;
    }
    const absolute = [];
    for (let index = 0; index < bank.doc.nodes.length; index++) {
      const parent = parents.get(index);
      if (parent === undefined)
        absolute.push({ p: positions[index], q: rotations[index] });
      else {
        const p = absolute[parent],
          r = rotate(p.q, positions[index]);
        absolute.push({
          p: r.map((n, axis) => n + p.p[axis]),
          q: multiply(p.q, rotations[index]),
        });
      }
    }
    return Math.min(
      ...soles[side].map(
        ({ bone, local }) =>
          absolute[bone].p[1] + rotate(absolute[bone].q, local)[1],
      ),
    );
  };
  result[name] = ["R", "L"].map((side) => {
    let best = { phase: 0, minimum: Infinity };
    for (let sample = 0; sample <= 1000; sample++) {
      const phase = (side === "R" ? 0.05 : 0.55) + sample * 0.0004,
        minimum = height(phase, side);
      if (minimum < best.minimum) best = { phase, minimum };
    }
    return {
      foot: side,
      phase: Number(best.phase.toFixed(4)),
      soleMinimumY: Number(best.minimum.toFixed(5)),
    };
  });
}
const evidence = {
  method:
    "Actual GLB sandal sole vertices, imported mission animation samples and full17joint FK; minimum in each foot stance half-cycle",
  modelSha256: createHash("sha256").update(base.bytes).digest("hex"),
  motionBankSha256: createHash("sha256").update(bank.bytes).digest("hex"),
  durations,
  contacts: result,
};
writeFileSync(
  "public/assets/models/mission-foot-contacts.json",
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence));
