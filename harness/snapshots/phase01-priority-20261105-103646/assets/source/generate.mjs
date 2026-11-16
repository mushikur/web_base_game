/** Original, editable parametric Dhaka character. No downloaded model or copied identity.
 * Geometry, bind matrices and baked motions are written directly as glTF 2 binary.
 * Units: metres; Y up; face +Z. See ASSETS.md for ownership and third-party notices. */
import { mkdirSync, writeFileSync } from "node:fs";
const out = "public/assets/models";
mkdirSync(out, { recursive: true });
const doc = {
  asset: {
    version: "2.0",
    generator: "Neta anatomical character authoring 2.0",
    copyright: "Project original artwork",
  },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: "DhakaCharacter", children: [] }],
  meshes: [],
  materials: [],
  skins: [],
  animations: [],
  buffers: [],
  bufferViews: [],
  accessors: [],
};
const chunks = [];
let byteLength = 0;
function accessor(values, type, componentType = 5126) {
  const a =
    componentType === 5123 ? new Uint16Array(values) : new Float32Array(values);
  const data = Buffer.from(a.buffer);
  const offset = byteLength;
  chunks.push(data);
  byteLength += data.length;
  const pad = (4 - (byteLength % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    byteLength += pad;
  }
  const view =
    doc.bufferViews.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: data.length,
    }) - 1;
  const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
  const min = Array(size).fill(Infinity),
    max = Array(size).fill(-Infinity);
  for (let i = 0; i < values.length; i++) {
    min[i % size] = Math.min(min[i % size], values[i]);
    max[i % size] = Math.max(max[i % size], values[i]);
  }
  return (
    doc.accessors.push({
      bufferView: view,
      componentType,
      count: values.length / size,
      type,
      ...(type === "VEC3" || type === "SCALAR" ? { min, max } : {}),
    }) - 1
  );
}
function mat(name, rgb, rough = 0.9) {
  return (
    doc.materials.push({
      name,
      pbrMetallicRoughness: {
        baseColorFactor: [...rgb, 1],
        roughnessFactor: rough,
        metallicFactor: 0,
      },
      doubleSided: false,
    }) - 1
  );
}
const skin = mat("Warm brown skin", [0.46, 0.265, 0.16], 0.86),
  cloth = mat("Woven cotton shirt", [0.64, 0.24, 0.105]),
  trousers = mat("Indigo cotton trousers", [0.055, 0.1, 0.12]),
  hair = mat("Black sculpted hair", [0.025, 0.018, 0.015]),
  white = mat("Eye white", [0.83, 0.77, 0.64]),
  iris = mat("Dark brown iris", [0.035, 0.022, 0.016]),
  seam = mat("Collar and stitch", [0.42, 0.13, 0.05]),
  sole = mat("Leather sandals", [0.1, 0.055, 0.026]),
  lips = mat("Natural lip and eyelid tone", [0.23, 0.1, 0.065]),
  facialHair = mat("Optional moustache", [0.035, 0.021, 0.014]),
  tunic = mat("Woven cotton optional tunic", [0.6, 0.5, 0.35]),
  shawl = mat("Optional woven dupatta", [0.045, 0.17, 0.15]),
  longHair = mat("Optional long hair", [0.018, 0.012, 0.009]);
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
const joints = bones.map(([name, parent, p]) => {
  const pp = parent < 0 ? [0, 0, 0] : bones[parent][2];
  return (
    doc.nodes.push({
      name,
      translation: p.map((v, i) => v - pp[i]),
      children: [],
    }) - 1
  );
});
bones.forEach(([, parent], i) =>
  doc.nodes[parent < 0 ? 0 : joints[parent]].children.push(joints[i]),
);
const ibm = [];
bones.forEach(([, , p]) =>
  ibm.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -p[0], -p[1], -p[2], 1),
);
doc.skins.push({
  name: "Dhaka humanoid 17 bone rig",
  joints,
  skeleton: joints[0],
  inverseBindMatrices: accessor(ibm, "MAT4"),
});
const groups = new Map();
function geometry(material) {
  if (!groups.has(material))
    groups.set(material, { p: [], idx: [], j: [], w: [], uv: [] });
  return groups.get(material);
}
function rings(material, levels, cx, cz, boneFn, segments = 32) {
  const g = geometry(material),
    base = g.p.length / 3;
  levels.forEach(([y, rx, rz, dx = 0, dz = 0], k) => {
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const fold =
        material === cloth || material === trousers
          ? 1 +
            0.013 * Math.sin(t * 11 + y * 53) +
            0.009 * Math.sin(t * 17 - y * 31)
          : 1;
      g.p.push(
        cx + dx + Math.sin(t) * rx * fold,
        y,
        cz + dz + Math.cos(t) * rz * fold,
      );
      const weights = boneFn(y, cx + dx + Math.sin(t) * rx);
      g.j.push(weights[0], weights[1] ?? weights[0], 0, 0);
      g.w.push(
        weights[2] ?? 1,
        weights[2] === undefined ? 0 : 1 - weights[2],
        0,
        0,
      );
      g.uv.push(i / segments, k / (levels.length - 1));
      if (k && i < segments) {
        const a = base + k * (segments + 1) + i,
          b = a - segments - 1;
        g.idx.push(b, b + 1, a, b + 1, a + 1, a);
      }
    }
  });
}
function patch(material, points, indices, bone) {
  const g = geometry(material),
    base = g.p.length / 3;
  for (const [i, p] of points.entries()) {
    g.p.push(...p);
    g.j.push(bone, 0, 0, 0);
    g.w.push(1, 0, 0, 0);
    g.uv.push(i % 2, Math.floor(i / 2) % 2);
  }
  g.idx.push(...indices.map((i) => i + base));
}
function ellipsoid(material, center, scale, bone, segments = 20) {
  const levels = [];
  for (let i = 0; i <= 12; i++) {
    const t = (Math.PI * i) / 12;
    levels.push([
      center[1] - Math.cos(t) * scale[1],
      Math.max(0.001, Math.sin(t) * scale[0]),
      Math.max(0.001, Math.sin(t) * scale[2]),
    ]);
  }
  rings(material, levels, center[0], center[2], () => [bone], segments);
}
// Shirt has a fitted waist, draped hem and real shoulder profile, with fold rings.
rings(
  cloth,
  [
    [0.9, 0.185, 0.117],
    [0.935, 0.188, 0.12],
    [0.98, 0.164, 0.11],
    [1.04, 0.171, 0.112],
    [1.12, 0.176, 0.117],
    [1.22, 0.2, 0.125],
    [1.34, 0.235, 0.128],
    [1.4, 0.239, 0.118],
    [1.45, 0.18, 0.105],
    [1.47, 0.075, 0.068],
  ],
  0,
  0,
  (y) => (y < 1.12 ? [1, 2, 0.5] : y < 1.32 ? [2, 3, 0.6] : [3]),
);
ellipsoid(skin, [0, 1.505, 0], [0.052, 0.085, 0.052], 4);
// Anatomical head sections: jaw, cheekbones, brow, crown. Separate nose and ears.
rings(
  skin,
  [
    [1.545, 0.034, 0.042, 0, 0.014],
    [1.56, 0.055, 0.059, 0, 0.006],
    [1.585, 0.07, 0.067],
    [1.615, 0.08, 0.076],
    [1.645, 0.087, 0.081],
    [1.675, 0.084, 0.079],
    [1.71, 0.083, 0.078],
    [1.745, 0.075, 0.073],
    [1.775, 0.057, 0.053],
    [1.788, 0.018, 0.02],
  ],
  0,
  0,
  () => [4],
  48,
);
ellipsoid(skin, [0, 1.659, 0.079], [0.011, 0.032, 0.014], 4, 20);
ellipsoid(skin, [0, 1.64, 0.09], [0.015, 0.01, 0.014], 4, 20);
for (const s of [-1, 1]) {
  ellipsoid(skin, [s * 0.087, 1.65, -0.005], [0.01, 0.027, 0.014], 4, 16);
  ellipsoid(lips, [s * 0.092, 1.651, 0.001], [0.003, 0.015, 0.008], 4, 12);
  ellipsoid(white, [s * 0.034, 1.679, 0.076], [0.016, 0.0055, 0.006], 4, 20);
  ellipsoid(iris, [s * 0.034, 1.679, 0.0815], [0.0046, 0.0046, 0.002], 4, 16);
  ellipsoid(hair, [s * 0.034, 1.696, 0.074], [0.021, 0.003, 0.004], 4, 16);
  ellipsoid(skin, [s * 0.034, 1.686, 0.077], [0.018, 0.004, 0.006], 4, 16);
  ellipsoid(lips, [s * 0.01, 1.637, 0.093], [0.004, 0.003, 0.002], 4, 12);
}
ellipsoid(lips, [0, 1.606, 0.076], [0.022, 0.0025, 0.004], 4, 20);
ellipsoid(skin, [0, 1.599, 0.075], [0.021, 0.0035, 0.004], 4, 20);
ellipsoid(facialHair, [0, 1.615, 0.079], [0.023, 0.004, 0.0035], 4, 20);
rings(
  hair,
  [
    [1.705, 0.085, 0.066, 0, -0.012],
    [1.74, 0.087, 0.077, 0, -0.003],
    [1.775, 0.067, 0.059, -0.004, -0.002],
    [1.795, 0.026, 0.025, -0.006, -0.003],
    [1.8, 0.001, 0.001],
  ],
  0,
  0,
  () => [4],
  32,
);
// Shirt sleeves, bare forearms, individually modelled thumbs and hands.
for (const s of [-1, 1]) {
  const upper = s < 0 ? 5 : 8,
    fore = s < 0 ? 6 : 9,
    hand = s < 0 ? 7 : 10;
  rings(
    cloth,
    [
      [1.205, 0.065, 0.069, s * 0.07],
      [1.235, 0.071, 0.073, s * 0.065],
      [1.32, 0.075, 0.079, s * 0.036],
      [1.39, 0.079, 0.084],
      [1.435, 0.052, 0.058],
    ],
    s * 0.26,
    0,
    (y) => [upper, 3, Math.max(0, Math.min(1, (1.45 - y) / 0.12))],
  );
  rings(
    skin,
    [
      [0.974, 0.027, 0.027, s * 0.11],
      [1.015, 0.032, 0.03, s * 0.1],
      [1.1, 0.043, 0.038, s * 0.085],
      [1.17, 0.043, 0.04, s * 0.07],
      [1.23, 0.05, 0.046, s * 0.067],
    ],
    s * 0.26,
    0,
    (y) => (y > 1.16 ? [upper, fore, 0.25] : [fore]),
  );
  ellipsoid(skin, [s * 0.374, 0.947, 0.001], [0.04, 0.072, 0.026], hand);
  ellipsoid(skin, [s * 0.345, 0.96, 0.024], [0.015, 0.039, 0.02], hand, 12);
  for (let f = 0; f < 4; f++)
    ellipsoid(
      skin,
      [s * (0.353 + f * 0.014), 0.897 - (f === 0 ? 0.005 : 0), 0.006],
      [0.008, 0.027, 0.012],
      hand,
      12,
    );
  const thigh = s < 0 ? 11 : 14,
    shin = s < 0 ? 12 : 15,
    foot = s < 0 ? 13 : 16;
  rings(
    trousers,
    [
      [0.12, 0.056, 0.055],
      [0.17, 0.058, 0.06],
      [0.21, 0.065, 0.064],
      [0.27, 0.06, 0.064],
      [0.4, 0.071, 0.074],
      [0.49, 0.07, 0.075],
      [0.55, 0.078, 0.081],
      [0.72, 0.086, 0.093],
      [0.86, 0.093, 0.102],
      [0.95, 0.094, 0.102],
    ],
    s * 0.105,
    0,
    (y) =>
      y > 0.6 ? [thigh] : y > 0.43 ? [thigh, shin, (y - 0.43) / 0.17] : [shin],
  );
  ellipsoid(skin, [s * 0.105, 0.085, 0.066], [0.058, 0.048, 0.13], foot);
  ellipsoid(sole, [s * 0.105, 0.039, 0.067], [0.068, 0.021, 0.144], foot);
  ellipsoid(sole, [s * 0.105, 0.106, 0.09], [0.064, 0.018, 0.032], foot);
}
// Fold highlights, stitched placket, buttons, and a pocket.
for (let i = 0; i < 5; i++)
  ellipsoid(white, [0, 1.06 + i * 0.075, 0.124], [0.003, 0.003, 0.002], 3, 12);
rings(
  seam,
  [
    [1.1, 0.007, 0.004],
    [1.43, 0.007, 0.004],
  ],
  0,
  0.128,
  () => [3],
  8,
);
for (const s of [-1, 1])
  patch(
    cloth,
    [
      [s * 0.018, 1.47, 0.074],
      [s * 0.07, 1.445, 0.107],
      [s * 0.09, 1.405, 0.137],
      [s * 0.02, 1.425, 0.13],
    ],
    s < 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3],
    3,
  );
patch(
  cloth,
  [
    [-0.155, 1.34, 0.123],
    [-0.075, 1.34, 0.133],
    [-0.08, 1.25, 0.132],
    [-0.145, 1.25, 0.123],
  ],
  [0, 1, 2, 0, 2, 3],
  3,
);
for (let i = 0; i < 8; i++)
  ellipsoid(
    seam,
    [-0.152 + i * 0.01, 1.34, 0.128],
    [0.0015, 0.001, 0.001],
    3,
    8,
  );
// Optional skinned local garments: panjabi/kameez hem and a draped dupatta.
rings(
  tunic,
  [
    [0.66, 0.225, 0.148],
    [0.72, 0.223, 0.145],
    [0.83, 0.215, 0.14],
    [0.96, 0.2, 0.134],
    [1.09, 0.195, 0.13],
    [1.23, 0.206, 0.132],
  ],
  0,
  0,
  (y, x) =>
    y < 0.9
      ? [11, 14, 0.5 - 0.5 * Math.tanh(x / 0.05)]
      : y < 1.0
        ? [1]
        : [2, 1, (y - 1) / 0.23],
  32,
);
const drape = geometry(shawl),
  drapeBase = drape.p.length / 3;
for (let row = 0; row <= 16; row++) {
  const y = 1.47 - row * 0.034;
  for (let col = 0; col <= 8; col++) {
    const u = col / 8,
      x = -0.125 + (u - 0.5) * 0.16 + (1.47 - y) * 0.1,
      z =
        0.135 +
        Math.sin(u * Math.PI) * 0.016 +
        Math.sin(u * Math.PI * 6 + row * 0.4) * 0.008;
    drape.p.push(x, y, z);
    drape.j.push(y > 1.2 ? 3 : 2, 1, 0, 0);
    drape.w.push(y > 1.1 ? 1 : 0.65, y > 1.1 ? 0 : 0.35, 0, 0);
    drape.uv.push(u, row / 16);
    if (row && col < 8) {
      const a = drapeBase + row * 9 + col,
        b = a - 9;
      drape.idx.push(b, a, b + 1, b + 1, a, a + 1);
    }
  }
}
ellipsoid(longHair, [0, 1.565, -0.072], [0.078, 0.153, 0.042], 4, 20);
for (const [material, g] of groups) {
  const n = Array(g.p.length).fill(0);
  for (let k = 0; k < g.idx.length; k += 3) {
    const a = g.idx[k] * 3,
      b = g.idx[k + 1] * 3,
      c = g.idx[k + 2] * 3;
    const u = [
        g.p[b] - g.p[a],
        g.p[b + 1] - g.p[a + 1],
        g.p[b + 2] - g.p[a + 2],
      ],
      v = [g.p[c] - g.p[a], g.p[c + 1] - g.p[a + 1], g.p[c + 2] - g.p[a + 2]];
    const cross = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    for (const id of [a, b, c])
      for (let j = 0; j < 3; j++) n[id + j] += cross[j];
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l;
    n[i + 1] /= l;
    n[i + 2] /= l;
  }
  const primitive = {
    attributes: {
      POSITION: accessor(g.p, "VEC3"),
      NORMAL: accessor(n, "VEC3"),
      TEXCOORD_0: accessor(g.uv, "VEC2"),
      JOINTS_0: accessor(g.j, "VEC4", 5123),
      WEIGHTS_0: accessor(g.w, "VEC4"),
    },
    indices: accessor(g.idx, "SCALAR", 5123),
    material,
  };
  const mesh =
    doc.meshes.push({
      name: doc.materials[material].name,
      primitives: [primitive],
    }) - 1;
  const node =
    doc.nodes.push({ name: doc.materials[material].name, mesh, skin: 0 }) - 1;
  doc.nodes[0].children.push(node);
}
function rotationAnimation(name, duration, tracks) {
  const anim = { name, samplers: [], channels: [] };
  const frames = 25;
  const times = Array.from(
    { length: frames },
    (_, i) => (i / (frames - 1)) * duration,
  );
  const input = accessor(times, "SCALAR");
  for (const [bone, fn] of tracks) {
    const values = [];
    for (let i = 0; i < frames; i++) {
      const [x = 0, y = 0, z = 0] = fn(i / (frames - 1));
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
      anim.samplers.push({
        input,
        output: accessor(values, "VEC4"),
        interpolation: "LINEAR",
      }) - 1;
    anim.channels.push({
      sampler,
      target: { node: joints[bone], path: "rotation" },
    });
  }
  doc.animations.push(anim);
}
const wave = (t) => Math.sin(t * Math.PI * 2);
rotationAnimation("Idle", 3, [
  [3, (t) => [0.014 * wave(t), 0, 0.009 * wave(t)]],
  [4, (t) => [0, 0.025 * wave(t), 0]],
  [5, () => [0, 0, -0.06]],
  [8, () => [0, 0, 0.06]],
  [11, () => [0, 0, 0]],
  [14, () => [0, 0, 0]],
  [12, () => [0, 0, 0]],
  [15, () => [0, 0, 0]],
  [6, () => [0, 0, 0]],
  [9, () => [0, 0, 0]],
]);
for (const [name, duration, amp] of [
  ["Walk", 1, 0.43],
  ["Run", 0.66, 0.73],
])
  rotationAnimation(name, duration, [
    [11, (t) => [amp * wave(t)]],
    [14, (t) => [-amp * wave(t)]],
    [12, (t) => [Math.max(0, -wave(t)) * 0.7]],
    [15, (t) => [Math.max(0, wave(t)) * 0.7]],
    [5, (t) => [-amp * 0.8 * wave(t), 0, -0.05]],
    [8, (t) => [amp * 0.8 * wave(t), 0, 0.05]],
    [6, () => [-0.15]],
    [9, () => [-0.15]],
    [3, (t) => [0.02, amp * 0.07 * wave(t), 0]],
    [4, (t) => [0, -amp * 0.05 * wave(t), 0]],
  ]);
rotationAnimation("Throw", 0.8, [
  [8, (t) => [-Math.sin(t * Math.PI) * 2.7, 0, 0.15]],
  [9, (t) => [-Math.sin(t * Math.PI) * 0.6]],
  [3, (t) => [0.1 * Math.sin(t * Math.PI), -0.3 * Math.sin(t * Math.PI), 0]],
  [5, (t) => [0.4 * Math.sin(t * Math.PI), 0, -0.1]],
]);
rotationAnimation("Hit", 0.45, [
  [3, (t) => [-0.26 * Math.sin(t * Math.PI), 0, 0]],
  [4, (t) => [-0.18 * Math.sin(t * Math.PI), 0, 0]],
  [5, (t) => [-0.25 * Math.sin(t * Math.PI)]],
  [8, (t) => [-0.25 * Math.sin(t * Math.PI)]],
]);
rotationAnimation("Pickup", 0.85, [
  [3, (t) => [Math.sin(Math.PI * t) * 0.7, 0, 0]],
  [4, (t) => [Math.sin(Math.PI * t) * 0.25]],
  [8, (t) => [-Math.sin(Math.PI * t) * 0.45, 0, 0.08]],
  [9, (t) => [-Math.sin(Math.PI * t) * 0.3]],
  [11, (t) => [-Math.sin(Math.PI * t) * 0.15]],
  [14, (t) => [-Math.sin(Math.PI * t) * 0.15]],
]);
// Keep stance feet planted by compensating the pelvis for the shortened leg chain.
for (const [name, duration, drop] of [
  ["Idle", 3, 0],
  ["Walk", 1, 0.065],
  ["Run", 0.66, 0.11],
  ["Pickup", 0.85, 0.025],
  ["Throw", 0.8, 0],
  ["Hit", 0.45, 0],
]) {
  const animation = doc.animations.find((a) => a.name === name),
    times = Array.from({ length: 25 }, (_, i) => (i / 24) * duration),
    values = [];
  for (let i = 0; i < 25; i++) {
    const phase = (i / 24) * Math.PI * (name === "Pickup" ? 1 : 2);
    values.push(0, 0.91 - drop * Math.sin(phase) ** 2, 0);
  }
  const sampler =
    animation.samplers.push({
      input: accessor(times, "SCALAR"),
      output: accessor(values, "VEC3"),
      interpolation: "LINEAR",
    }) - 1;
  animation.channels.push({
    sampler,
    target: { node: joints[1], path: "translation" },
  });
}
// Original boarding motions for the open-sided CNG, not a posed portrait or a
// relocated idle animation. Feet step onto the .40 m floor, knees fold forward,
// the torso ducks under the side canopy and the hands settle above the knees.
// Root travel follows the authored doorway/seat anchors in vehicles.ts.
const smooth = (t) => Math.max(0, Math.min(1, t)) ** 2 * (3 - 2 * Math.max(0, Math.min(1, t))),
  sitting = (t) => smooth((t - 0.12) / 0.78);
for (const [name, duration, reverse] of [
  ["EnterVehicle", 1.4, false],
  ["Seated", 2.6, false],
  ["ExitVehicle", 1.25, true],
]) {
  const phase = (t) => name === "Seated" ? 1 : sitting(reverse ? 1 - t : t),
    duck = (t) => name === "Seated" ? 0 : Math.sin(t * Math.PI),
    breath = (t) => name === "Seated" ? Math.sin(t * Math.PI * 2) : 0;
  rotationAnimation(name, duration, [
    [3, (t) => [0.025 * phase(t) + 0.24 * duck(t) + 0.009 * breath(t), 0, 0]],
    [4, (t) => [-0.06 * phase(t) + 0.1 * duck(t), 0.012 * breath(t), 0]],
    [5, (t) => [-0.4 * phase(t) - 0.4 * duck(t), 0, -0.08]],
    [8, (t) => [-0.4 * phase(t) - 0.55 * duck(t), 0, 0.08]],
    [6, (t) => [-0.7 * phase(t) - 0.2 * duck(t)]],
    [9, (t) => [-0.7 * phase(t) - 0.35 * duck(t)]],
    [11, (t) => [-1.5 * phase(t) - 0.17 * duck(t)]],
    [14, (t) => [-1.5 * phase(t) + 0.09 * duck(t)]],
    [12, (t) => [1.5 * phase(t) + 0.26 * duck(t)]],
    [15, (t) => [1.5 * phase(t) + 0.13 * duck(t)]],
  ]);
  const animation = doc.animations.find((a) => a.name === name),
    times = Array.from({ length: 25 }, (_, i) => i / 24 * duration),
    translations = [];
  for (let i = 0; i < 25; i++) {
    const t = i / 24;
    translations.push(0, 0.91 - 0.35 * phase(t) - 0.04 * duck(t), 0);
  }
  animation.samplers.push({
    input: accessor(times, "SCALAR"),
    output: accessor(translations, "VEC3"),
    interpolation: "LINEAR",
  });
  animation.channels.push({ sampler: animation.samplers.length - 1, target: { node: joints[1], path: "translation" } });
  animation.extras = { purpose: "Original open-sided CNG boarding", durationSeconds: duration, loop: name === "Seated" };
}
doc.buffers = [{ byteLength }];
const json = Buffer.from(JSON.stringify(doc));
const jp = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
const bin = Buffer.concat(chunks);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jp.length + 8 + bin.length, 8);
const jh = Buffer.alloc(8);
jh.writeUInt32LE(jp.length);
jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(bin.length);
bh.writeUInt32LE(0x004e4942, 4);
writeFileSync(
  `${out}/dhaka-character.glb`,
  Buffer.concat([header, jh, jp, bh, bin]),
);
console.log(
  `Original skinned character: ${doc.nodes.length} nodes, ${doc.animations.length} animations, ${(bin.length / 1024).toFixed(0)} KiB geometry.`,
);
