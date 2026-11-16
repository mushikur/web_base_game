import sharp from "sharp";

/** Original cricket armor fitted to the Dhaka rig, facing +Z at rest. */
export async function addCricketHero({ mat, geometry, rings, ellipsoid, faceSurface, baseColorImage, materials }) {
  const suit = mat("Hero woven emerald jersey", [0.022, 0.19, 0.126], 0.79);
  const plate = mat("Hero emerald composite plates", [0.05, 0.26, 0.174], 0.44);
  const rib = mat("Hero raised cricket pad ribs", [0.037, 0.18, 0.128], 0.58);
  const crimson = mat("Hero vermilion piping", [0.54, 0.048, 0.044], 0.55);
  const alloy = mat("Hero brushed graphite bevel", [0.17, 0.19, 0.22], 0.41);
  materials[alloy].pbrMetallicRoughness.metallicFactor = 0.55;
  const edge = mat("Hero titanium fasteners", [0.4, 0.45, 0.48], 0.35);
  materials[edge].pbrMetallicRoughness.metallicFactor = 0.58;
  const gasket = mat("Hero rubber seams and soles", [0.038, 0.043, 0.052], 0.84);
  const lime = mat("Hero chartreuse light inlays", [0.36, 0.84, 0.074], 0.35);
  materials[lime].emissiveFactor = [0.18, 0.48, 0.032];
  const skin = mat("Warm brown skin Hero arms", [0.44, 0.235, 0.127], 0.78);
  const face = mat("Hero sculpted face and swept crop", [1, 1, 1], 0.76);
  const white = mat("Eye white Hero", [0.79, 0.72, 0.62], 0.36);
  const iris = mat("Dark brown iris Hero", [0.049, 0.028, 0.016], 0.36);
  const ball = mat("Hero bronze cricket ball", [0.30, 0.22, 0.075], 0.67);
  const stitches = mat("Hero ball seam thread", [0.69, 0.54, 0.29], 0.82);
  faceSurface(geometry(face), "hero");

  // A beveled shell with the curved body contour built into the vertex positions.
  // Outline points travel counterclockwise as seen from the front.
  function shell(material, outline, bone, surface, depth, direction = 1) {
    const mesh = geometry(material);
    const base = mesh.p.length / 3;
    const count = outline.length;
    const center = outline.reduce(([x, y], [px, py]) => [x + px / count, y + py / count], [0, 0]);
    const xs = outline.map(([x]) => x), ys = outline.map(([, y]) => y);
    const left = Math.min(...xs), right = Math.max(...xs);
    const low = Math.min(...ys), high = Math.max(...ys);
    const vertex = (x, y, z) => {
      mesh.p.push(x, y, direction * z);
      mesh.j.push(bone, 0, 0, 0);
      mesh.w.push(1, 0, 0, 0);
      mesh.uv.push(direction === 1 ? (x - left) / (right - left) : (right - x) / (right - left), (high - y) / (high - low));
    };
    const triangle = (a, b, c) => mesh.idx.push(...(direction === 1 ? [a, b, c] : [a, c, b]));
    for (const [scale, height] of [[1, 0], [0.91, depth]]) {
      for (const [ox, oy] of outline) {
        const x = center[0] + (ox - center[0]) * scale;
        const y = center[1] + (oy - center[1]) * scale;
        vertex(x, y, surface(x, y) + height);
      }
    }
    const middle = base + count * 2;
    vertex(...center, surface(...center) + depth + 0.001);
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      triangle(base + i, base + next, base + count + i);
      triangle(base + next, base + count + next, base + count + i);
      triangle(base + count + i, base + count + next, middle);
    }
  }
  const octagon = (x, bottom, top, width, bevel = 0.22) => {
    const cut = (top - bottom) * bevel;
    return [[x - width * 0.72, top], [x - width, top - cut], [x - width, bottom + cut],
      [x - width * 0.72, bottom], [x + width * 0.72, bottom], [x + width, bottom + cut],
      [x + width, top - cut], [x + width * 0.72, top]];
  };
  const scaled = (outline, xScale, yScale, pivot) =>
    outline.map(([x, y]) => [x * xScale, pivot + (y - pivot) * yScale]);
  const curve = (center, radius, depth) => (x) =>
    depth * Math.sqrt(Math.max(0.24, 1 - ((x - center) / radius) ** 2));
  const band = (material, center, y, height, width, depth, bone, z = 0) =>
    rings(material, [[y, width * 0.97, depth * 0.97], [y + height * 0.2, width, depth],
      [y + height * 0.8, width, depth], [y + height, width * 0.97, depth * 0.97]],
    center, z, () => [bone], 24);

  rings(suit, [[0.86, 0.161, 0.092], [0.93, 0.176, 0.111], [1.04, 0.17, 0.109],
    [1.15, 0.182, 0.124], [1.25, 0.222, 0.142], [1.37, 0.245, 0.145],
    [1.42, 0.231, 0.129], [1.47, 0.17, 0.091], [1.491, 0.062, 0.058]],
  0, 0, (y) => y < 1.1 ? [1, 2, 0.7] : y < 1.25 ? [2, 3, 0.55] : [3]);
  band(crimson, 0, 0.895, 0.057, 0.19, 0.125, 1);
  band(gasket, 0, 1.466, 0.075, 0.067, 0.066, 3);
  band(plate, 0, 1.475, 0.057, 0.071, 0.069, 3);

  const chest = [[-0.116, 1.442], [-0.196, 1.407], [-0.217, 1.349], [-0.202, 1.234],
    [-0.16, 1.204], [-0.082, 1.218], [-0.048, 1.251], [0.048, 1.251], [0.082, 1.218],
    [0.16, 1.204], [0.202, 1.234], [0.217, 1.349], [0.196, 1.407], [0.116, 1.442],
    [0.045, 1.415], [-0.045, 1.415]];
  const frontCurve = curve(0, 0.29, 0.156);
  const backCurve = curve(0, 0.29, 0.154);
  for (const dir of [1, -1]) {
    const contour = dir === 1 ? frontCurve : backCurve;
    shell(gasket, scaled(chest, 1.08, 1.13, 1.33), 3, contour, 0.015, dir);
    shell(alloy, chest, 3, (x) => contour(x) + 0.01, 0.017, dir);
    const enamel = mat(dir === 1 ? "Hero front numbered enamel" : "Hero back numbered enamel", [1, 1, 1], 0.46);
    shell(enamel, scaled(chest, 0.89, 0.83, 1.332), 3, (x) => contour(x) + 0.023, 0.009, dir);
    baseColorImage(enamel, await jerseyPrint(dir === -1));
    for (const side of [-1, 1]) {
      const strip = octagon(side * 0.137, 1.218, 1.251, 0.039)
        .map(([x, y]) => [x, y + 0.4 * (Math.abs(x) - 0.137)]);
      shell(gasket, strip, 3, (x) => contour(x) + 0.022, 0.012, dir);
      shell(lime, strip.map(([x, y]) => [side * 0.137 + (x - side * 0.137) * 0.77, 1.235 + (y - 1.235) * 0.65]),
        3, (x) => contour(x) + 0.034, 0.003, dir);
    }
    for (let i = 0; i < 3; i++) {
      const bottom = 1.192 - (i + 1) * 0.074;
      const center = curve(0, 0.21, 0.126 + (2 - i) * 0.006);
      const bone = i === 2 ? 1 : 2;
      shell(alloy, octagon(0, bottom, bottom + 0.066, dir === 1 ? 0.12 - 0.013 * i : 0.078 - 0.008 * i),
        bone, center, 0.018, dir);
      shell(dir === 1 ? plate : rib, octagon(0, bottom + 0.009, bottom + 0.059, dir === 1 ? 0.1 - 0.011 * i : 0.062 - 0.006 * i),
        bone, (x) => center(x) + 0.017, 0.006, dir);
      if (dir === -1)
        shell(lime, octagon(0, bottom + 0.017, bottom + 0.024, 0.019), bone, () => center(0) + 0.026, 0.002, dir);
    }
    shell(alloy, octagon(0, 0.865, 0.966, 0.081), 1, curve(0, 0.24, 0.124), 0.023, dir);
    shell(plate, octagon(0, 0.882, 0.953, 0.06), 1, curve(0, 0.24, 0.147), 0.01, dir);
    shell(edge, octagon(0, 0.93, 0.945, 0.027), 1, () => 0.16, 0.004, dir);
  }
  for (const s of [-1, 1]) {
    const upper = s < 0 ? 5 : 8, fore = upper + 1, hand = upper + 2;
    const thigh = s < 0 ? 11 : 14, shin = thigh + 1, foot = thigh + 2;
    const legX = s * 0.105;
    // An open, athletic sleeve leaves the elbow and fingers exposed.
    rings(suit, [[1.221, 0.057, 0.063, s * 0.064], [1.278, 0.061, 0.067, s * 0.05],
      [1.35, 0.075, 0.083, s * 0.027], [1.42, 0.067, 0.078], [1.455, 0.031, 0.058]],
    s * 0.26, 0, () => [upper]);
    band(crimson, s * 0.323, 1.216, 0.023, 0.059, 0.066, upper);
    rings(skin, [[1.135, 0.043, 0.04, s * 0.067], [1.166, 0.047, 0.046, s * 0.061],
      [1.207, 0.052, 0.047, s * 0.056], [1.237, 0.052, 0.048, s * 0.049]],
    s * 0.27, 0, (y) => y < 1.17 ? [fore, upper, 0.55] : [upper]);
    ellipsoid(alloy, [s * 0.265, 1.406, -0.001], [0.113, 0.071, 0.124], upper, 24);
    ellipsoid(plate, [s * 0.265, 1.428, 0.001], [0.104, 0.062, 0.111], upper, 24);
    for (const dir of [1, -1]) {
      shell(crimson, octagon(s * 0.139, 1.391, 1.473, 0.034), 3, (x) => frontCurve(x) + 0.004, 0.017, dir);
      shell(crimson, octagon(s * 0.14, 1.015, 1.17, 0.034)
        .map(([x, y]) => [x + s * (y - 1.09) * 0.24, y]),
      2, curve(0, 0.23, 0.126), 0.012, dir);
      shell(alloy, octagon(s * 0.285, 1.365, 1.422, 0.057), upper, curve(s * 0.252, 0.11, 0.122), 0.012, dir);
      shell(crimson, octagon(s * 0.301, 1.384, 1.412, 0.013), upper, curve(s * 0.252, 0.11, 0.132), 0.006, dir);
      shell(crimson, octagon(s * 0.144, 0.666, 0.93, 0.042), thigh, curve(legX, 0.13, 0.113), 0.012, dir);
      shell(alloy, octagon(s * 0.169, 0.834, 0.918, 0.024), thigh, curve(legX, 0.15, 0.126), 0.016, dir);
    }
    rings(suit, [[0.962, 0.027, 0.026, s * 0.028], [0.998, 0.034, 0.034, s * 0.023],
      [1.058, 0.042, 0.042, s * 0.014], [1.11, 0.046, 0.046, s * 0.005],
      [1.151, 0.047, 0.044]], s * 0.337, 0, () => [fore]);
    band(crimson, s * 0.343, 1.103, 0.041, 0.049, 0.049, fore);
    band(crimson, s * 0.362, 0.981, 0.029, 0.038, 0.038, fore);
    shell(alloy, octagon(s * 0.35, 0.99, 1.16, 0.044), fore, curve(s * 0.35, 0.072, 0.049), 0.015);
    shell(plate, octagon(s * 0.35, 1.02, 1.145, 0.032), fore, curve(s * 0.35, 0.072, 0.061), 0.009);
    ellipsoid(suit, [s * 0.372, 0.947, 0.003], [0.041, 0.048, 0.029], hand, 16);
    shell(alloy, octagon(s * 0.37, 0.923, 0.967, 0.027), hand, () => 0.029, 0.009);
    ellipsoid(skin, [s * 0.344, 0.931, 0.023], [0.014, 0.025, 0.015], hand, 12);
    for (let finger = 0; finger < 4; finger++)
      ellipsoid(skin, [s * (0.352 + finger * 0.014), 0.901 - (finger === 1 ? 0.006 : 0), 0.011],
        [0.0085, 0.023, 0.01], hand, 12);

    rings(suit, [[0.12, 0.056, 0.057], [0.19, 0.062, 0.067], [0.30, 0.067, 0.068],
      [0.43, 0.073, 0.074], [0.49, 0.073, 0.077], [0.55, 0.079, 0.084],
      [0.67, 0.085, 0.089], [0.79, 0.09, 0.099], [0.91, 0.096, 0.104], [0.948, 0.09, 0.099]],
    legX, 0, (y) => y > 0.57 ? [thigh] : y < 0.43 ? [shin] : [shin, thigh, (0.57 - y) / 0.14]);
    for (const y of [0.165, 0.324, 0.446]) band(alloy, legX, y, 0.029, y > 0.3 ? 0.079 : 0.068, 0.078, shin);
    const padCurve = curve(legX, 0.115, 0.092);
    shell(alloy, octagon(legX, 0.109, 0.472, 0.081), shin, padCurve, 0.022);
    shell(plate, octagon(legX, 0.128, 0.463, 0.072), shin, (x) => padCurve(x) + 0.019, 0.018);
    shell(alloy, octagon(legX, 0.45, 0.567, 0.078), shin, curve(legX, 0.11, 0.096), 0.022);
    shell(plate, octagon(legX, 0.462, 0.556, 0.069), shin, curve(legX, 0.11, 0.118), 0.012);
    for (const offset of [-0.048, -0.024, 0, 0.024, 0.048]) {
      shell(rib, octagon(legX + offset, 0.151 + Math.abs(offset) * 0.2, 0.423, 0.008),
        shin, (x) => padCurve(x) + 0.034, 0.009);
      shell(rib, octagon(legX + offset, 0.475, 0.538 - Math.abs(offset) * 0.12, 0.007),
        shin, curve(legX, 0.11, 0.129), 0.006);
    }
    band(gasket, legX, 0.435, 0.022, 0.079, 0.085, shin, 0.007);
    shell(crimson, octagon(legX, 0.137, 0.174, 0.025), shin, () => 0.127, 0.005);
    ellipsoid(gasket, [legX, 0.035, 0.068], [0.073, 0.031, 0.136], foot, 24);
    ellipsoid(alloy, [legX, 0.053, 0.068], [0.075, 0.026, 0.133], foot, 24);
    ellipsoid(plate, [legX, 0.08, 0.067], [0.07, 0.065, 0.125], foot, 24);
    ellipsoid(gasket, [legX, 0.087, 0.155], [0.061, 0.031, 0.039], foot, 20);
    ellipsoid(lime, [legX + s * 0.063, 0.052, 0.13], [0.01, 0.009, 0.024], foot, 12);
    for (let i = 0; i < 4; i++)
      ellipsoid(edge, [legX, 0.139 - i * 0.003, 0.057 + i * 0.016], [0.035 - i * 0.002, 0.003, 0.005], foot, 12);
    ellipsoid(white, [s * 0.031, 1.65, 0.068], [0.013, 0.010, 0.013], 4, 20);
    ellipsoid(iris, [s * 0.031, 1.65, 0.0808], [0.0051, 0.0051, 0.0019], 4, 16);
  }
  // A cricket ball retained in the hip cradle is part of the costume.
  ellipsoid(alloy, [-0.207, 0.875, 0.017], [0.041, 0.074, 0.067], 1, 16);
  ellipsoid(ball, [-0.227, 0.907, 0.04], [0.052, 0.052, 0.052], 1, 24);
  for (const x of [-0.244, -0.239, -0.234])
    ellipsoid(stitches, [x, 0.907, 0.04], [0.0011, 0.051, 0.05], 1, 20);
}

async function jerseyPrint(back) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320">
    <defs>
      <linearGradient id="metal" x2="0" y2="1"><stop stop-color="#417561"/><stop offset="1" stop-color="#1e4b3b"/></linearGradient>
      <pattern id="grain" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M1 7l3-3 3 3" fill="none" stroke="#a0c7a6" stroke-width=".7" opacity=".22"/></pattern>
    </defs>
    <path fill="url(#metal)" d="M0 0h512v320H0z"/><path fill="url(#grain)" d="M0 0h512v320H0z"/>
    <g fill="none" stroke="#163d32" stroke-width="6" opacity=".75">
      <path d="M122 229l-27-23-17-38 9-25 29-28-8-20 41 13 18 19-3 19-22 12 21 14-19 13-23-7 1 21 24 24"/>
      <path d="M390 229l27-23 17-38-9-25-29-28 8-20-41 13-18 19 3 19 22 12-21 14 19 13 23-7-1 21-24 24"/>
      <path d="M128 135l13 5m243-5-13 5M110 154l-14 13m306-13 14 13"/>
    </g>
    ${back ? "" : '<path d="M352 92h50v30q0 16-25 26-25-10-25-26z" fill="#943e32" stroke="#c6b477" stroke-width="3"/><path d="M362 116l15-15 15 15-15 16z" fill="#d1c67d"/>'}
    <g fill="#d8ff9b" stroke="#294827" stroke-width="2" paint-order="stroke" text-anchor="middle"
       font-family="Nirmala UI, Noto Sans Bengali, sans-serif" font-weight="bold">
      ${back ? '<text x="256" y="105" font-size="52">সজল</text>' : ""}
      <text x="256" y="${back ? 224 : 200}" font-size="${back ? 112 : 96}">৭৫</text>
    </g>
  </svg>`;
  return sharp(Buffer.from(svg)).resize(512, 512, { fit: "fill" }).png().toBuffer();
}
