import sharp from "sharp";

const designs = {
  "promise-junction": { face: "sari", speech: "wave", top: [0.022, 0.052, 0.29], pants: [0.70, 0.72, 0.77] },
  "committee-lane": { face: "blazer", speech: "measured", top: [0.81, 0.85, 0.94], pants: [0.52, 0.36, 0.21] },
  "microphone-square": { face: "panjabi", speech: "up", top: [0.82, 0.85, 0.94], pants: [0.038, 0.036, 0.055] },
  "poster-quarter": { face: "waveVest", speech: "wave", top: [0.79, 0.81, 0.88], pants: [0.73, 0.75, 0.85] },
  "power-house": { face: "pointVest", speech: "out", top: [0.85, 0.86, 0.92], pants: [0.79, 0.80, 0.88] },
};

export async function addDistrictLeader(id, { mat, materials, geometry, rings, ellipsoid, faceSurface, baseColorImage }) {
  const design = designs[id];
  if (!design) throw new Error(`Unknown district leader: ${id}`);
  const sari = design.face === "sari";
  const blazer = design.face === "blazer";
  const vest = design.face.endsWith("Vest");
  const shirt = mat("Leader cloth inner garment", design.top, 0.86);
  const pants = mat("Leader cloth lower garment", design.pants, 0.9);
  const outer = mat("Leader cloth tailored outerwear", blazer ? [0.045, 0.058, 0.117] :
    design.face === "waveVest" ? [0.048, 0.038, 0.057] : [0.02, 0.036, 0.046], 0.84);
  const piping = mat("Leader cloth stitched trim", sari ? [0.11, 0.16, 0.53] :
    blazer ? [0.10, 0.13, 0.20] : vest ? [0.075, 0.091, 0.11] : [0.55, 0.60, 0.76], 0.85);
  const leather = mat("Leader leather shoes and strap", [0.027, 0.020, 0.019], 0.42);
  const skin = mat("Warm brown skin Leader hands", [0.43, 0.23, 0.135], 0.81);
  const head = mat("Leader sculpted face", [1, 1, 1], 0.78);
  const sclera = mat("Eye white Leader", [0.8, 0.77, 0.65], 0.45);
  const iris = mat("Dark brown iris Leader", [0.055, 0.029, 0.016], 0.38);
  const jewelry = mat("Leader brushed brass and pearl detail", [0.56, 0.42, 0.21], 0.42);
  const frame = mat("Leader spectacle frame", [0.045, 0.029, 0.022], 0.39);
  const accent = mat("Leader cloth folded pocket silk", design.face === "pointVest" ? [0.54, 0.081, 0.055] :
    design.face === "waveVest" ? [0.53, 0.055, 0.13] : [0.37, 0.20, 0.055], 0.54);
  const hair = mat("Leader facial hair", design.face === "waveVest" ? [0.07, 0.06, 0.052] : [0.028, 0.016, 0.012]);
  materials[jewelry].pbrMetallicRoughness.metallicFactor = 0.32;
  faceSurface(geometry(head), design.face);

  // Mesh strips sample a curved cloth surface and share weights with the body underneath.
  function sheet(material, width, height, sample, bind) {
    const mesh = geometry(material);
    const start = mesh.p.length / 3;
    for (let row = 0; row <= height; row++) {
      for (let column = 0; column <= width; column++) {
        const u = column / width, v = row / height;
        const point = sample(u, v);
        const [a, b = a, weight = 1] = bind(point, u, v);
        mesh.p.push(...point);
        mesh.j.push(a, b, 0, 0);
        mesh.w.push(weight, 1 - weight, 0, 0);
        mesh.uv.push(u, v);
        if (row && column) {
          const i = start + row * (width + 1) + column;
          mesh.idx.push(i - width - 2, i - width - 1, i - 1, i - width - 1, i, i - 1);
        }
      }
    }
  }
  function band(material, x, y, halfWidth, depth, height, bone) {
    rings(material, [[y, halfWidth * 0.96, depth * 0.97], [y + height * 0.15, halfWidth, depth],
      [y + height * 0.85, halfWidth, depth], [y + height, halfWidth * 0.96, depth * 0.97]],
    x, 0, () => [bone], 16);
  }
  const torsoWeight = (y) => y < 0.97 ? [1] : y < 1.20 ? [2, 1, (y - 0.97) / 0.23] :
    [3, 2, Math.min(1, (y - 1.20) / 0.14)];
  const skirtWeight = (y, x) => y < 0.87 ? [11, 14, 0.5 - 0.43 * Math.tanh(x / 0.047)] : torsoWeight(y);
  const body = sari ? 0.88 : design.face === "waveVest" ? 1.04 : 1;
  rings(shirt, [[0.85, 0.169, 0.114], [0.95, 0.166, 0.12], [1.09, 0.163, 0.111],
    [1.22, 0.185, 0.12], [1.34, 0.218, 0.127], [1.42, 0.212, 0.116],
    [1.475, 0.096, 0.074], [1.495, 0.054, 0.057]].map(([y, x, z]) => [y, x * body, z]),
  0, 0, torsoWeight, 24);
  if (sari) {
    const fabric = mat("Leader floral indigo sari", [1, 1, 1], 0.83);
    materials[fabric].doubleSided = true;
    baseColorImage(fabric, await sariPrint());
    const hemRows = [[0.15, 0.226, 0.16], [0.22, 0.214, 0.155], [0.36, 0.194, 0.144],
      [0.56, 0.188, 0.142], [0.73, 0.178, 0.133], [0.88, 0.163, 0.134], [1.035, 0.153, 0.126]];
    sheet(fabric, 42, 24, (u, v) => {
      const a = (1 - u) * Math.PI * 2;
      const step = Math.min(5, Math.floor(v * 6));
      const blend = v * 6 - step;
      const [y, rx, rz] = hemRows[step].map((start, i) => start + (hemRows[step + 1][i] - start) * blend);
      const folds = Math.cos(a * 13 + v * 2.3) * (0.008 + 0.006 * (1 - v));
      return [Math.sin(a) * (rx + folds), y + Math.sin(a * 5) * 0.008 * (1 - v), Math.cos(a) * (rz + folds)];
    }, ([x, y]) => skirtWeight(y, x));
    // Diagonal pallu crosses the chest, then falls behind the left shoulder.
    sheet(fabric, 12, 25, (u, v) => {
      const x = -0.13 + 0.27 * v + (u - 0.5) * (0.19 - 0.02 * v);
      const y = 1.48 - 0.58 * v + (u - 0.5) * 0.08;
      const z = 0.119 + Math.sqrt(Math.max(0, 1 - (x / 0.25) ** 2)) * 0.035 + Math.sin(u * 7 * Math.PI) * 0.005;
      return [x, y, z];
    }, ([, y]) => torsoWeight(y));
    sheet(fabric, 12, 26, (u, v) => [
      -0.16 + (u - 0.5) * (0.14 + 0.07 * v) - 0.04 * Math.sin(v * 2),
      1.48 - 0.78 * v + 0.026 * Math.cos(u * Math.PI),
      -0.13 - 0.056 * Math.sin(v * 2.6) - 0.012 * Math.sin(u * Math.PI * 6 + v),
    ], ([x, y]) => skirtWeight(y, x));
    // An open hood drapes over the crown and keeps the fictional face exposed.
    sheet(fabric, 26, 12, (u, v) => {
      const a = -0.48 + u * (Math.PI + 0.96);
      const back = Math.sin(v * Math.PI / 2);
      return [Math.cos(a) * (0.118 - 0.043 * back),
        1.574 + Math.sin(a) * (0.242 - back * 0.079) + 0.011 * v,
        0.064 - v * 0.226 + 0.005 * Math.sin(8 * a)];
    }, () => [4]);
    for (const s of [-1, 1])
      ellipsoid(jewelry, [s * 0.091, 1.61, 0.026], [0.007, 0.009, 0.006], 4, 12);
  } else if (!blazer) {
    rings(shirt, [[0.52, 0.214, 0.15], [0.58, 0.211, 0.149], [0.70, 0.197, 0.137],
      [0.84, 0.182, 0.125], [0.94, 0.174, 0.123], [0.98, 0.17, 0.118]],
    0, 0, skirtWeight, 28);
    band(vest ? outer : shirt, 0, 1.466, 0.064, 0.063, 0.052, 3);
    if (!vest) {
      frontStrip(piping, [0, 1.29], [0, 1.478], 0.026, 0.126, 0.003, 3);
      for (let i = 0; i < 5; i++) ellipsoid(jewelry, [0, 1.312 + i * 0.032, 0.135], [0.0035, 0.0035, 0.003], 3, 8);
    }
  } else {
    band(leather, 0, 0.905, 0.037, 0.18, 0.123, 1);
    frontStrip(jewelry, [-0.021, 0.923], [0.021, 0.923], 0.027, 0.124, 0.004, 1);
  }

  if (vest || blazer) {
    // Two tailored front panels form either a V opening or a buttoned waistcoat.
    materials[outer].doubleSided = true;
    for (const s of [-1, 1]) {
      sheet(outer, 16, 20, (u, v) => {
        const y = (blazer ? 0.84 : 0.81) + v * 0.64;
        const radius = (0.195 + 0.036 * Math.sin(Math.PI * v)) * body;
        const opening = blazer ? 0.45 + 0.43 * v ** 2 : 0.045 + 0.19 * (1 - v) ** 6;
        const a = opening + (Math.PI - opening) * u;
        const fold = 0.004 * Math.cos(v * 13 + a * 11);
        return [s * Math.sin(a) * (radius + fold), y - 0.036 * u * v ** 7,
          Math.cos(a) * (0.139 + 0.011 * Math.sin(v * 3) + fold)];
      }, ([, y]) => torsoWeight(y));
      if (blazer) {
        frontStrip(piping, [s * 0.047, 1.075], [s * 0.122, 1.444], 0.045, 0.127, 0.014, 3);
        frontStrip(shirt, [s * 0.015, 1.378], [s * 0.068, 1.47], 0.032, 0.126, 0.013, 3);
      }
      frontStrip(piping, [s * 0.092, 1.008], [s * 0.158, 1.026], 0.011, 0.119, 0.004, 2);
    }
    if (vest) {
      for (let i = 0; i < 6; i++) {
        const y = 0.99 + i * 0.077;
        ellipsoid(jewelry, [0.012, y, 0.157], [0.007, 0.007, 0.004], y < 1.20 ? 2 : 3, 10);
      }
      frontStrip(accent, [-0.153, 1.303], [-0.102, 1.324], 0.022, 0.14, 0.012, 3);
    }
    // Fictional pin, deliberately a small diamond.
    frontStrip(jewelry, [0.107, 1.359], [0.125, 1.378], 0.014, 0.135, 0.004, 3);
  }

  for (const s of [-1, 1]) {
    const upper = s < 0 ? 5 : 8, fore = upper + 1, hand = upper + 2;
    const thigh = s < 0 ? 11 : 14, shin = thigh + 1, foot = thigh + 2;
    const sleeve = blazer ? outer : shirt;
    const wrist = sari || design.face === "panjabi" || design.face === "pointVest" ? 1.033 : 0.998;
    rings(sleeve, [[wrist, 0.034, 0.034, s * 0.104], [1.092, 0.041, 0.044, s * 0.09],
      [1.16, 0.05, 0.048, s * 0.074], [1.211, 0.053, 0.054, s * 0.061],
      [1.29, 0.061, 0.063, s * 0.046], [1.366, 0.068, 0.075, s * 0.018],
      [1.42, 0.057, 0.061], [1.454, 0.028, 0.049, s * -0.04]],
    s * 0.26, 0, (y) => y < 1.125 ? [fore] : y < 1.20 ? [upper, fore, (y - 1.125) / 0.075] : [upper], 24);
    band(blazer ? shirt : piping, s * 0.364, wrist, 0.037, 0.037, 0.025, fore);
    rings(skin, [[0.959, 0.024, 0.024], [0.991, 0.027, 0.027], [wrist + 0.006, 0.032, 0.031]],
      s * 0.365, 0, () => [fore], 16);
    ellipsoid(skin, [s * 0.372, 0.935, 0.004], [0.031, 0.04, 0.023], hand, 16);
    ellipsoid(skin, [s * 0.345, 0.933, 0.026], [0.012, 0.021, 0.014], hand, 12);
    for (let i = 0; i < 4; i++)
      ellipsoid(skin, [s * (0.351 + i * 0.013), 0.894 - (i === 1 ? 0.005 : 0), 0.008],
        [0.0075, 0.022, 0.01], hand, 10);
    if (s < 0) {
      band(sari ? jewelry : leather, s * 0.366, 0.976, 0.03, 0.029, 0.015, fore);
      if (!sari) ellipsoid(jewelry, [s * 0.366, 0.981, 0.031], [0.017, 0.016, 0.005], fore, 14);
    }
    const leg = s * 0.105;
    rings(pants, [[0.095, 0.054, 0.049], [0.14, 0.061, 0.056], [0.24, 0.065, 0.062],
      [0.41, 0.071, 0.075], [0.49, 0.072, 0.075], [0.58, 0.074, 0.08],
      [0.72, 0.086, 0.092], [0.84, 0.092, 0.098], [0.95, 0.092, 0.099]],
    leg, 0, (y) => y < 0.43 ? [shin] : y < 0.57 ? [thigh, shin, (y - 0.43) / 0.14] : [thigh], 22);
    ellipsoid(leather, [leg, 0.045, 0.064], [0.062, 0.041, 0.123], foot, 20);
    ellipsoid(leather, [leg, 0.073, 0.028], [0.055, 0.045, 0.085], foot, 18);
    ellipsoid(sclera, [s * 0.032, 1.65, 0.066], [0.012, 0.009, 0.013], 4, 18);
    ellipsoid(iris, [s * 0.032, 1.65, 0.0788], [0.0048, 0.005, 0.002], 4, 14);
    if (vest) ellipsoid(hair, [s * 0.011, 1.586, 0.091], [0.012, 0.0038, 0.0038], 4, 16);
  }

  if (sari || blazer || vest) {
    // Open frames keep the eyes visible. Their aspect ratio differs by character.
    const w = blazer ? 0.025 : 0.029, h = sari ? 0.014 : blazer ? 0.011 : 0.017;
    for (const side of [-1, 1]) {
      const x = side * 0.034;
      const rim = [[-0.72, 1], [-1, 0.58], [-1, -0.39], [-0.65, -1], [0.65, -1], [1, -0.39], [1, 0.58], [0.72, 1], [-0.72, 1]];
      for (let i = 1; i < rim.length; i++)
        frontStrip(frame, [x + rim[i - 1][0] * w, 1.65 + rim[i - 1][1] * h],
          [x + rim[i][0] * w, 1.65 + rim[i][1] * h], blazer ? 0.0024 : 0.0035, 0.085, 0.003, 4);
      sheet(frame, 2, 2, (u, v) => [side * (0.061 + 0.024 * u), 1.657 - 0.006 * u + v * 0.003, 0.086 - u * 0.063], () => [4]);
    }
    frontStrip(frame, [-0.011, 1.653], [0.011, 1.653], 0.003, 0.088, 0.003, 4);
    materials[frame].doubleSided = true;
  }
  for (const material of [shirt, piping, jewelry, accent]) materials[material].doubleSided = true;
  return speechTracks(design.speech);

  function frontStrip(material, from, to, width, z, rise, bone) {
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
    sheet(material, 4, 4, (u, v) => [
      from[0] + v * (to[0] - from[0]) - Math.sin(angle) * (u - 0.5) * width,
      from[1] + v * (to[1] - from[1]) + Math.cos(angle) * (u - 0.5) * width,
      z + rise * Math.sin(Math.PI * u),
    ], () => [bone]);
  }
}

function speechTracks(kind) {
  const beat = (t) => (1 - Math.cos(2 * Math.PI * t)) / 2;
  const flutter = (t) => Math.sin(6 * Math.PI * t) * beat(t);
  const wave = kind === "wave";
  const up = kind === "up";
  const out = kind === "out";
  const reach = wave ? 0.7 : up || out ? 0.85 : 0.4;
  return [
    [3, (t) => [0.025 * beat(t), -0.12 * beat(t), 0.04 * beat(t)]],
    [4, (t) => [0.05 * beat(t), 0.07 * Math.sin(t * 2 * Math.PI), -0.035 * beat(t)]],
    [5, (t) => [out ? -0.25 * beat(t) : -0.18 * beat(t), 0, out ? -0.55 * beat(t) : -0.10]],
    [6, (t) => [out ? -1.1 * beat(t) : -0.18 * beat(t)]],
    [8, (t) => [-(wave ? 0.55 : up ? 1.16 : out ? 1.57 : 0.42) * beat(t), 0,
      0.07 + (wave ? 1.65 : up ? 0.50 : out ? 0.24 : 0.47) * beat(t)]],
    [9, (t) => [-(up ? 1.38 : wave ? 0.35 : 0.26) * beat(t), 0,
      (wave ? 1.16 : 0.18) * beat(t)]],
    [10, (t) => [reach * 0.13 * flutter(t), 0.18 * flutter(t), (wave ? 0.25 : 0.05) * flutter(t)]],
    [11, () => [0]], [12, () => [0]], [14, () => [0]], [15, () => [0]],
  ];
}

async function sariPrint() {
  const petals = Array.from({ length: 8 }, (_, i) =>
    `<ellipse rx="2.7" ry="5.5" cy="-5" transform="rotate(${i * 45})"/>`).join("");
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="512">
    <defs><pattern id="sprigs" width="40" height="42" patternUnits="userSpaceOnUse">
      <g fill="#426bb3" opacity=".68" transform="translate(16 16)">${petals}<circle r="2.8" fill="#c2d4f9"/></g>
      <path d="M27 25q-9 0-11 13 9-3 11-13m-2-4q3 11 13 10-5-9-13-10" fill="#7799cb"/>
    </pattern></defs>
    <path fill="#e8ecf3" d="M0 0h256v512H0z"/>
    <path fill="#b5c7ed" d="M0 0h36v512H0zm220 0h36v512h-36zM0 0h256v56H0z"/>
    <path fill="url(#sprigs)" d="M0 0h256v512H0z"/>
    <path d="M7 0v512M249 0v512M0 9h256" stroke="#223786" stroke-width="8"/>
    <path d="M16 0v512M240 0v512M0 18h256" stroke="#5365bb" stroke-width="5"/>
    <path d="M32 0v512M224 0v512M0 49h256" stroke="#344b93" stroke-width="3"/>
  </svg>`;
  return sharp(Buffer.from(source)).png().toBuffer();
}
