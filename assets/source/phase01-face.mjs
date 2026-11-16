import { readFileSync } from "node:fs";

const baseMesh = new URL(
  "./phase01-character-art/makehuman/base.obj",
  import.meta.url,
);
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const bump = (v, center, width) => Math.exp(-(((v - center) / width) ** 2));
const basis = readBase();

function readBase() {
  const vertices = [],
    uv = [],
    faces = [];
  let body = false;
  for (const line of readFileSync(baseMesh, "utf8").split(/\r?\n/)) {
    const [kind, ...data] = line.trim().split(/\s+/);
    if (kind === "v") vertices.push(data.map(Number));
    if (kind === "vt") uv.push(data.map(Number));
    if (kind === "g") body = data[0] === "body";
    if (kind === "f" && body) {
      const face = data.map((word) =>
        word.split("/").map((v) => Number(v) - 1),
      );
      if (
        face.every(
          ([p]) => vertices[p][1] >= 5.69 && Math.abs(vertices[p][0]) <= 0.95,
        )
      )
        faces.push(face);
    }
  }
  if (vertices.length !== 19158 || faces.length < 1000)
    throw new Error(
      "Unexpected MakeHuman source mesh; check the pinned asset.",
    );
  return { vertices, uv, faces };
}

const faces = {
  young: { width: 1.0, jaw: 0.97, nose: 1.02, lip: 0.98, hairline: 0 },
  mature: { width: 1.04, jaw: 1.08, nose: 1.09, lip: 1.07, hairline: 0.17 },
  soft: { width: 0.98, jaw: 0.92, nose: 0.93, lip: 1.02, hairline: -0.05 },
  hero: { width: 0.98, jaw: 1.09, nose: 1.04, lip: 0.97, hairline: -0.12 },
  sari: { width: 1.10, jaw: 0.94, nose: 0.87, lip: 1.09, hairline: 0.19, gray: 0.88, age: 0.7 },
  blazer: { width: 0.93, jaw: 1.12, nose: 1.15, lip: 0.96, hairline: 0.31, gray: 0.17, age: 0.38 },
  panjabi: { width: 1.05, jaw: 1.07, nose: 0.89, lip: 1.02, hairline: -0.17, beard: 0.83, waves: 0.014 },
  waveVest: { width: 1.12, jaw: 1.14, nose: 1.01, lip: 1.15, hairline: 0.33, gray: 0.46, age: 0.55 },
  pointVest: { width: 0.92, jaw: 1.22, nose: 1.13, lip: 0.92, hairline: 0.11, gray: 0.33, age: 0.31 },
};

/** Keep the authored Head joint and neck attachment; vendor only the shaped face surface. */
export function addFaceSurface(g, variant) {
  const shape = faces[variant];
  const index = new Map();
  g.c = [];
  for (const face of basis.faces) {
    const indices = face.map(([p, t]) => {
      const key = `${p}/${t}`;
      if (index.has(key)) return index.get(key);
      const id = g.p.length / 3;
      index.set(key, id);
      const [x, y, z] = basis.vertices[p];
      const neck = smooth(5.69, 6.33, y);
      const frontal = smooth(0.42, 1.3, z);
      const jaw = bump(y, 6.46, 0.37) * neck;
      const tip = bump(x, 0, 0.23) * bump(y, 6.91, 0.34) * frontal;
      const mouth = bump(x, 0, 0.36) * bump(y, 6.62, 0.17) * frontal;
      const hairY =
        6.6 + 1.37 * smooth(-0.32, 1.25, z) + shape.hairline * frontal;
      const hairline = hairY + 0.045 * Math.sin(8 * x + 2 * z);
      const scalp = smooth(hairline - 0.028, hairline + 0.08, y);
      const roots = smooth(6.0, 6.8, y);
      const gain = 0.103 * mix(1, shape.width, neck) * mix(1, shape.jaw, jaw);
      const lift = scalp * roots * (0.013 + 0.004 * Math.sin(x * 13 + z * 4) +
        (shape.waves ?? 0) * (0.5 + 0.5 * Math.sin(13 * x + 7 * z)));
      const sweep = variant === "hero" ? scalp * smooth(7.15, 8.28, y) : 0;
      g.p.push(
        x * gain + lift * x * 0.2 - 0.032 * sweep,
        1.463 + (y - 5.69) * 0.117 + lift + 0.014 * sweep * (1 - 0.48 * x),
        (z - 0.6) * 0.1 +
          tip * (shape.nose - 1) * 0.051 +
          mouth * (shape.lip - 1) * 0.044 + 0.013 * sweep,
      );
      g.j.push(4, 0, 0, 0);
      g.w.push(1, 0, 0, 0);
      const [u, v] = basis.uv[t];
      g.uv.push(u, 1 - v);
      const eyeSocket =
        bump(Math.abs(x), 0.315, 0.21) * bump(y, 7.24, 0.14) * frontal;
      const brow =
        bump(Math.abs(x), 0.34, 0.2) * bump(y, 7.45, 0.055) * frontal;
      const cheek =
        bump(Math.abs(x), 0.5, 0.22) * bump(y, 6.95, 0.28) * frontal;
      const lip = mouth * bump(y, 6.57 + 0.08 * Math.abs(x), 0.075);
      const grain = Math.sin(p * 76.183) * 0.008;
      const skin = [
        0.45 -
          0.1 * eyeSocket -
          0.32 * brow +
          0.055 * cheek -
          0.11 * lip +
          grain,
        0.238 -
          0.063 * eyeSocket -
          0.169 * brow +
          0.013 * cheek -
          0.12 * lip +
          grain,
        0.145 -
          0.041 * eyeSocket -
          0.102 * brow +
          0.009 * cheek -
          0.065 * lip +
          grain,
      ];
      const strand =
        0.008 * Math.sin(x * 61 + z * 35) + 0.004 * Math.sin(x * 99);
      const stubble = variant === "hero" || shape.beard
        ? Math.max(
          (shape.beard ?? 0.53) * frontal * bump(y, 6.29 + Math.abs(x) * (shape.beard ? 0.53 : 0.34), shape.beard ? 0.27 : 0.22),
          0.4 * frontal * bump(y, 6.74, 0.051) * bump(x, 0, 0.36),
        ) * (0.85 + 0.15 * Math.sin(p * 9.13))
        : 0;
      g.c.push(
        ...skin.map((c, i) => {
          const ageLine = (shape.age ?? 0) * frontal *
            (bump(y, 7.74 + 0.18 * x ** 2, 0.024) * bump(x, 0, 0.52) +
              bump(y, 6.93 - 0.7 * Math.abs(x), 0.033) * bump(Math.abs(x), 0.45, 0.19));
          const silver = (shape.gray ?? 0) * (0.22 + 0.46 * Math.sin(x * 34 + z * 14) ** 2);
          return mix(mix(clamp(c - 0.075 * ageLine, 0.028, 1), [0.045, 0.026, 0.02][i], stubble),
            [0.024, 0.017, 0.014][i] + strand + silver, scalp);
        }),
      );
      return id;
    });
    for (let i = 1; i + 1 < indices.length; i++)
      g.idx.push(indices[0], indices[i], indices[i + 1]);
  }
}
