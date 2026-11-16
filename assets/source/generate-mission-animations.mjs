/** Project-original mission motion bank. No mesh, face or third-party motion.
 * Same metre-scale rest hierarchy as generate.mjs; base character stays intact. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const basePath = "public/assets/models/dhaka-character.glb";
const phase02 = process.argv.includes("--phase02");
const phase03 = process.argv.includes("--phase03");
const phase03Clips = new Set(["RiderPedal", "DriverSteer"]);
const phase02Clips = new Set(["PalmTap", "BatonSwing", "SoundBurst", "SparkPop"]);
const before = createHash("sha256")
  .update(readFileSync(basePath))
  .digest("hex");
const bones = [
  ["Root", -1, [0, 0, 0]],
  ["Pelvis", 0, [0, 0.91, 0]],
  ["Spine", 1, [0, 1.12, 0]],
  ["Chest", 2, [0, 1.36, 0]],
  ["Head", 3, [0, 1.6, 0]],
  ["UpperArm.L", 3, [-0.26, 1.41, 0]],
  ["Forearm.L", 5, [-0.34, 1.16, 0]],
  ["Hand.L", 6, [-0.37, 0.96, 0]],
  ["UpperArm.R", 3, [0.26, 1.41, 0]],
  ["Forearm.R", 8, [0.34, 1.16, 0]],
  ["Hand.R", 9, [0.37, 0.96, 0]],
  ["Thigh.L", 1, [-0.105, 0.9, 0]],
  ["Shin.L", 11, [-0.105, 0.49, 0]],
  ["Foot.L", 12, [-0.105, 0.1, 0.04]],
  ["Thigh.R", 1, [0.105, 0.9, 0]],
  ["Shin.R", 14, [0.105, 0.49, 0]],
  ["Foot.R", 15, [0.105, 0.1, 0.04]],
];
const doc = {
  asset: {
    version: "2.0",
    generator: "Neta original mission animation authoring 1.0",
    copyright: "Project original artwork",
  },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [],
  animations: [],
  accessors: [],
  bufferViews: [],
  buffers: [],
};
bones.forEach(([name, parent, p]) =>
  doc.nodes.push({
    name,
    translation: p.map(
      (n, axis) => n - (parent < 0 ? 0 : bones[parent][2][axis]),
    ),
    children: [],
  }),
);
bones.forEach(([, parent], index) => {
  if (parent >= 0) doc.nodes[parent].children.push(index);
});
const chunks = [];
let bytes = 0;
function accessor(values, type) {
  const data = Buffer.from(new Float32Array(values).buffer),
    size = type === "SCALAR" ? 1 : type === "VEC3" ? 3 : 4;
  const view =
    doc.bufferViews.push({
      buffer: 0,
      byteOffset: bytes,
      byteLength: data.length,
    }) - 1;
  chunks.push(data);
  bytes += data.length;
  const count = values.length / size;
  return (
    doc.accessors.push({
      bufferView: view,
      componentType: 5126,
      count,
      type,
      ...(type === "SCALAR"
        ? { min: [Math.min(...values)], max: [Math.max(...values)] }
        : {}),
    }) - 1
  );
}
const wave = (t) => Math.sin(t * Math.PI * 2),
  swell = (t) => Math.sin(t * Math.PI),
  smooth = (t) => t * t * (3 - 2 * t);
function clip(name, duration, loop, tracks, pelvis = () => [0, 0.91, 0]) {
  if (phase03 ? !phase03Clips.has(name) : phase03Clips.has(name) || phase02 !== phase02Clips.has(name)) return;
  const times = Array.from({ length: 33 }, (_, i) => (i / 32) * duration),
    input = accessor(times, "SCALAR"),
    animation = {
      name,
      samplers: [],
      channels: [],
      extras: {
        durationSeconds: duration,
        loop,
        purpose: "Original fictional non-graphic mission gesture",
      },
    };
  // Every rotation has a defined key, so interrupted gestures cannot retain a
  // lifted arm, knee or neck from an earlier action on the same instantiated rig.
  for (let bone = 0; bone < bones.length; bone++) {
    const values = [];
    for (let i = 0; i < 33; i++) {
      const [x = 0, y = 0, z = 0] = tracks[bone]?.(i / 32) ?? [0, 0, 0];
      const cx = Math.cos(x / 2),
        sx = Math.sin(x / 2),
        cy = Math.cos(y / 2),
        sy = Math.sin(y / 2),
        cz = Math.cos(z / 2),
        sz = Math.sin(z / 2);
      values.push(
        sx * cy * cz + cx * sy * sz,
        cx * sy * cz - sx * cy * sz,
        cx * cy * sz + sx * sy * cz,
        cx * cy * cz - sx * sy * sz,
      );
    }
    const sampler =
      animation.samplers.push({
        input,
        output: accessor(values, "VEC4"),
        interpolation: "LINEAR",
      }) - 1;
    animation.channels.push({
      sampler,
      target: { node: bone, path: "rotation" },
    });
  }
  const sampler =
    animation.samplers.push({
      input,
      output: accessor(
        Array.from({ length: 33 }, (_, i) => pelvis(i / 32)).flat(),
        "VEC3",
      ),
      interpolation: "LINEAR",
    }) - 1;
  animation.channels.push({
    sampler,
    target: { node: 1, path: "translation" },
  });
  doc.animations.push(animation);
}
clip("Speech", 3.2, true, {
  3: (t) => [0.018 * wave(t), 0.06 * wave(t), 0],
  4: (t) => [0, -0.08 * wave(t), 0],
  8: (t) => [-0.65 - 0.32 * wave(t), 0.15, 0.28],
  9: (t) => [-0.65 + 0.2 * wave(t)],
  5: () => [-0.18, 0, -0.08],
});
clip("Warn", 1.6, true, {
  3: (t) => [0, -0.16 * wave(t), 0],
  4: (t) => [0, 0.2 * wave(t), 0],
  5: () => [-0.38, 0, -0.18],
  8: (t) => [-1.12 + 0.15 * wave(t), 0.2, 0.36],
  9: () => [-0.35],
});
clip(
  "Cover",
  2,
  true,
  {
    2: () => [0.15],
    3: (t) => [0.18, 0.05 * wave(t), 0],
    4: (t) => [-0.1, 0.1 * wave(t), 0],
    5: () => [-0.9, 0, -0.35],
    8: () => [-0.95, 0, 0.35],
    6: () => [-1.0],
    9: () => [-1.0],
    11: () => [-0.5],
    14: () => [-0.5],
    12: () => [0.8],
    15: () => [0.8],
  },
  () => [0, 0.8, 0],
);
clip("Phone", 3.4, true, {
  3: (t) => [0.015, 0.03 * wave(t), 0],
  4: () => [0.1],
  5: () => [-0.8, 0, -0.2],
  8: () => [-0.85, 0, 0.2],
  6: () => [-1.3],
  9: () => [-1.35],
  7: () => [0.12, 0.2, 0],
  10: () => [0.12, -0.2, 0],
});
clip("EggReact", 0.65, false, {
  3: (t) => [-0.22 * swell(t), 0, 0],
  4: (t) => [-0.19 * swell(t), 0.18 * swell(t), 0],
  5: (t) => [-1.45 * swell(t), 0, -0.15],
  8: (t) => [-1.5 * swell(t), 0, 0.15],
  6: (t) => [-0.95 * swell(t)],
  9: (t) => [-0.95 * swell(t)],
});
clip("SandalReact", 0.85, false, {
  2: (t) => [0.12 * swell(t)],
  3: (t) => [0.1, -0.34 * swell(t), 0.16 * swell(t)],
  4: (t) => [-0.1, 0.3 * swell(t), 0],
  5: (t) => [-0.6 * swell(t), 0, -0.6 * swell(t)],
  8: (t) => [-0.6 * swell(t), 0, 0.65 * swell(t)],
  11: (t) => [-0.18 * swell(t)],
  14: (t) => [-0.12 * swell(t)],
});
const seated = (p) => ({
  3: (t) => [0.15 * p(t), 0, 0],
  4: (t) => [-0.08 * p(t), 0, 0],
  5: (t) => [-0.4 * p(t), 0, -0.1],
  8: (t) => [-0.4 * p(t), 0, 0.1],
  6: (t) => [-0.7 * p(t)],
  9: (t) => [-0.7 * p(t)],
  11: (t) => [-1.5 * p(t)],
  14: (t) => [-1.5 * p(t)],
  12: (t) => [1.6 * p(t)],
  15: (t) => [1.6 * p(t)],
});
clip("Defeated", 1.2, false, seated(smooth), (t) => [
  0,
  0.91 - 0.35 * smooth(t),
  0,
]);
clip(
  "Resting",
  3,
  true,
  { ...seated(() => 1), 3: (t) => [0.15 + 0.01 * wave(t)] },
  () => [0, 0.56, 0],
);
clip(
  "Assist",
  2.1,
  true,
  {
    2: (t) => [0.25 + 0.04 * wave(t)],
    3: () => [0.23],
    4: () => [-0.1],
    5: () => [-0.85, 0, -0.15],
    8: () => [-0.85, 0, 0.15],
    6: (t) => [-0.5 + 0.08 * wave(t)],
    9: (t) => [-0.5 - 0.08 * wave(t)],
    11: () => [-0.25],
    14: () => [-0.25],
    12: () => [0.35],
    15: () => [0.35],
  },
  () => [0, 0.87, 0],
);
for (const [name, amplitude] of [
  ["Carry", 0.24],
  ["AssistedWalk", 0.26],
])
  clip(
    name,
    1.3,
    true,
    {
      2: () => [0.06],
      3: (t) => [0.08, 0.02 * wave(t), 0],
      4: () => [0.04],
      5: () => [-0.75, 0, -0.18],
      8: () => [-0.75, 0, 0.18],
      6: () => [-0.65],
      9: () => [-0.65],
      11: (t) => [amplitude * wave(t)],
      14: (t) => [-amplitude * wave(t)],
      12: (t) => [Math.max(0, -wave(t)) * 0.4],
      15: (t) => [Math.max(0, wave(t)) * 0.4],
    },
    (t) => [0, 0.91 - 0.025 * wave(t) ** 2, 0],
  );
clip("Loading", 1.8, false, seated(smooth), (t) => [
  0,
  0.91 - 0.35 * smooth(t),
  0,
]);
const gesture = (t, peak) => Math.sin(Math.PI * (t < peak ? t / peak : (1 - t) / (1 - peak)) / 2);
clip("PalmTap", 0.58, false, {
  3: (t) => [0.12 * gesture(t, 0.4), -0.24 * gesture(t, 0.4)],
  8: (t) => [-1.47 * gesture(t, 0.4), 0.08, 0.2 * gesture(t, 0.4)],
  9: (t) => [-0.35 * swell(t)],
  10: (t) => [0.26 * swell(t)],
});
clip("BatonSwing", 0.85, false, {
  3: (t) => [0.1 * swell(t), 0.43 * wave(t)],
  8: (t) => [-1.52 * gesture(t, 0.37), -0.65 * wave(t), 0.42 * swell(t)],
  9: (t) => [-0.62 * swell(t)],
  10: (t) => [0.35 * wave(t), 0, 0.12 * swell(t)],
});
clip("SoundBurst", 1.05, false, {
  4: (t) => [0.07 * swell(t)],
  8: (t) => [-1.25 * gesture(t, 0.32), 0, 0.25 * swell(t)],
  9: (t) => [-1.18 * gesture(t, 0.32)],
  5: (t) => [-0.25 * swell(t)],
});
clip("SparkPop", 0.95, false, {
  3: (t) => [-0.1 * swell(t), -0.13 * swell(t)],
  8: (t) => [-1.56 * gesture(t, 0.33), 0.17 * swell(t), 0.12 * swell(t)],
  9: (t) => [-0.58 * swell(t)],
  10: (t) => [0, 0, 0.28 * wave(t)],
});
doc.buffers = [{ byteLength: bytes }];
clip("DriverSteer", 2.4, true, {
  2: (t) => [0.10 + 0.016 * wave(t)],
  4: (t) => [-0.08, 0.055 * wave(t)],
  5: () => [-0.92, -0.09, 0.20],
  6: () => [-0.46, 0.07, -0.13],
  8: () => [-0.92, 0.09, -0.20],
  9: () => [-0.46, -0.07, 0.13],
  11: () => [-1.33, 0, -0.12],
  12: () => [1.71],
  13: () => [-0.37],
  14: () => [-1.33, 0, 0.12],
  15: () => [1.71],
  16: () => [-0.37],
}, () => [0, 0.56, 0]);
clip("RiderPedal", 1.18, true, {
  2: (t) => [0.25, 0.035 * wave(t)],
  4: (t) => [-0.23, 0.035 * wave(t)],
  5: () => [-0.86, 0, 0.09],
  6: () => [-0.34],
  8: () => [-0.86, 0, -0.09],
  9: () => [-0.34],
  11: (t) => [-0.86 - 0.37 * wave(t)],
  12: (t) => [1.26 + 0.51 * wave(t + 0.08)],
  13: (t) => [-0.27 + 0.20 * wave(t)],
  14: (t) => [-0.86 + 0.37 * wave(t)],
  15: (t) => [1.26 - 0.51 * wave(t + 0.08)],
  16: (t) => [-0.27 - 0.20 * wave(t)],
}, (t) => [0, 0.56 + 0.01 * wave(t * 2), 0]);
const json = Buffer.from(JSON.stringify(doc)),
  padded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]),
  bin = Buffer.concat(chunks),
  header = Buffer.alloc(12),
  jh = Buffer.alloc(8),
  bh = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + padded.length + bin.length, 8);
jh.writeUInt32LE(padded.length);
jh.writeUInt32LE(0x4e4f534a, 4);
bh.writeUInt32LE(bin.length);
bh.writeUInt32LE(0x004e4942, 4);
mkdirSync("public/assets/models", { recursive: true });
const output = Buffer.concat([header, jh, padded, bh, bin]);
const asset = phase03 ? "ride-animations.glb" : phase02 ? "action-animations.glb" : "mission-animations.glb";
writeFileSync(`public/assets/models/${asset}`, output);
if (
  createHash("sha256").update(readFileSync(basePath)).digest("hex") !== before
)
  throw new Error(
    "Base character changed while writing independent motion bank",
  );
console.log(
  JSON.stringify({
    asset,
    clips: doc.animations.map((a) => a.name),
    bytes: output.length,
    baseSha256: before,
  }),
);
