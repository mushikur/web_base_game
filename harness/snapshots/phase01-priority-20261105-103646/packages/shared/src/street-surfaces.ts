import type { Surface } from "./audio.ts";
export const streetPuddles = [
  [-3, -6, 1.4, 0.55],
  [3, 8, 0.8, 1.3],
  [-2, 15, 1.2, 0.5],
  [4, -13, 0.6, 0.9],
] as const;
export const surfacePatches = [
  { surface: "brick", x: 6.8, z: -5.4, w: 2.1, d: 3, y: 0.205 },
  { surface: "dirt", x: 4.75, z: -15.5, w: 0.75, d: 2.2, y: 0.017 },
  { surface: "mud", x: -4.75, z: 15.4, w: 0.75, d: 2.2, y: 0.018 },
  { surface: "shop", x: -5.65, z: 0, w: 1.1, d: 5.8, y: 0.34 },
] as const;
export function streetSurfaceAt(x: number, z: number): Surface {
  for (const patch of surfacePatches)
    if (
      Math.abs(x - patch.x) <= patch.w / 2 &&
      Math.abs(z - patch.z) <= patch.d / 2
    )
      return patch.surface;
  for (const [px, pz, sx, sz] of streetPuddles)
    if (((x - px) / sx) ** 2 + ((z - pz) / sz) ** 2 <= 1) return "water";
  for (const side of [-1, 1])
    for (let pz = -16; pz < 24; pz += 5.3)
      if (Math.abs(x - side * 5.2) < 0.145 && Math.abs(z - pz) < 0.39)
        return "metal";
  if (x < -6 && x > -11.55 && Math.abs(z) < 3.5) return "shop";
  return Math.abs(x) >= 5.3 ? "concrete" : "asphalt";
}
export function streetHeightAt(x: number, z: number) {
  const deck = surfacePatches.find((p) => p.surface === "shop");
  if (
    deck &&
    Math.abs(x - deck.x) <= deck.w / 2 &&
    Math.abs(z - deck.z) <= deck.d / 2
  )
    return deck.y;
  const edge = Math.abs(x);
  return edge > 5.295 && edge < 5.565 ? 0.32 : edge >= 5.565 ? 0.2 : 0;
}
