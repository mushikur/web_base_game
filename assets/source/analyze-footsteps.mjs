/** Calibrate contacts from actual GLB sole vertices and the authored leg-chain FK. */
import { readFileSync, writeFileSync } from "node:fs";
const b = readFileSync("public/assets/models/dhaka-character.glb"),
  jsonLength = b.readUInt32LE(12),
  doc = JSON.parse(b.subarray(20, 20 + jsonLength).toString()),
  binary = 28 + jsonLength;
function accessor(id) {
  const a = doc.accessors[id],
    v = doc.bufferViews[a.bufferView],
    size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type],
    n = a.componentType === 5123 ? 2 : 4,
    offset = binary + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return Array.from({ length: a.count }, (_, i) =>
    Array.from({ length: size }, (_, j) =>
      n === 2
        ? b.readUInt16LE(offset + (i * size + j) * n)
        : b.readFloatLE(offset + (i * size + j) * n),
    ),
  );
}
const soles = { L: [], R: [] };
for (const mesh of doc.meshes)
  if (mesh.name === "Leather sandals")
    for (const p of mesh.primitives) {
      const positions = accessor(p.attributes.POSITION),
        joints = accessor(p.attributes.JOINTS_0);
      for (let i = 0; i < positions.length; i++) {
        if (joints[i][0] === 13) soles.L.push(positions[i]);
        if (joints[i][0] === 16) soles.R.push(positions[i]);
      }
    }
if (!soles.L.length || !soles.R.length)
  throw new Error("Sole geometry is required for contact calibration.");
function rotate(y, z, a) {
  return [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
}
const result = {};
for (const [name, amp, drop] of [
  ["Walk", 0.43, 0.065],
  ["Run", 0.73, 0.11],
]) {
  result[name] = [];
  for (const side of ["R", "L"]) {
    let best = { phase: 0, height: Infinity };
    for (let sample = 0; sample <= 1000; sample++) {
      const phase = (side === "R" ? 0.05 : 0.55) + sample * 0.0004,
        s = Math.sin(phase * Math.PI * 2),
        thigh = (side === "L" ? 1 : -1) * amp * s,
        shin = Math.max(0, side === "L" ? -s : s) * 0.7;
      const knee = rotate(-0.41, 0, thigh),
        ankle = rotate(-0.39, 0.04, thigh + shin),
        y = 0.9 - drop * s * s + knee[0] + ankle[0];
      const min = Math.min(
        ...soles[side].map(
          (v) => y + rotate(v[1] - 0.1, v[2] - 0.04, thigh + shin)[0],
        ),
      );
      if (min < best.height) best = { phase, height: min };
    }
    result[name].push({
      foot: side,
      phase: Number(best.phase.toFixed(4)),
      soleMinimumY: Number(best.height.toFixed(5)),
    });
  }
}
writeFileSync(
  "public/assets/models/foot-contacts.json",
  JSON.stringify(
    {
      method:
        "Actual GLB sole vertices, authored 17-joint leg FK, minimum in each stance half-cycle",
      contacts: result,
    },
    null,
    2,
  ),
);
console.log(result);
