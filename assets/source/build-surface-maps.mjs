import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
const input = "assets/source/generated/dhaka-surface-atlas-v2.png";
const { width, height } = await sharp(input).metadata();
const half = Math.floor(Math.min(width, height) / 2);
await mkdir("public/assets/textures", { recursive: true });
const manifest = [];
for (const [name, x, y, strength, rough] of [
  ["asphalt", 0, 0, 1.8, 0.88],
  ["plaster", 1, 0, 1.1, 0.91],
  ["cng-enamel", 0, 1, 0.48, 0.38],
  ["rickshaw-art", 1, 1, 0.38, 0.56],
]) {
  const quadrant = sharp(input)
    .extract({
      left: x * half + 3,
      top: y * half + 3,
      width: half - 6,
      height: half - 6,
    })
    .resize(1024, 1024);
  await quadrant
    .clone()
    .webp({ quality: 88 })
    .toFile(`public/assets/textures/${name}-color.webp`);
  const { data, info } = await quadrant
    .clone()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const normal = Buffer.alloc(info.width * info.height * 3),
    surface = Buffer.alloc(normal.length);
  const at = (a, b) =>
    data[
      ((b + info.height) % info.height) * info.width +
        ((a + info.width) % info.width)
    ] / 255;
  for (let yy = 0; yy < info.height; yy++)
    for (let xx = 0; xx < info.width; xx++) {
      const dx = (at(xx + 1, yy) - at(xx - 1, yy)) * strength,
        dy = (at(xx, yy + 1) - at(xx, yy - 1)) * strength,
        n = Math.hypot(dx, dy, 1),
        i = (yy * info.width + xx) * 3;
      normal[i] = Math.round(((-dx / n) * 0.5 + 0.5) * 255);
      normal[i + 1] = Math.round(((dy / n) * 0.5 + 0.5) * 255);
      normal[i + 2] = Math.round(((1 / n) * 0.5 + 0.5) * 255);
      surface[i] = Math.round(245 - at(xx, yy) * 12);
      surface[i + 1] = Math.round(
        Math.min(1, rough + (at(xx, yy) - 0.5) * 0.14) * 255,
      );
      surface[i + 2] = name === "cng-enamel" ? 20 : 0;
    }
  await sharp(normal, {
    raw: { width: info.width, height: info.height, channels: 3 },
  })
    .resize(512, 512)
    .webp({ lossless: true })
    .toFile(`public/assets/textures/${name}-normal.webp`);
  await sharp(surface, {
    raw: { width: info.width, height: info.height, channels: 3 },
  })
    .resize(512, 512)
    .webp({ quality: 92 })
    .toFile(`public/assets/textures/${name}-orm.webp`);
  manifest.push({
    name,
    color: `${name}-color.webp`,
    normal: `${name}-normal.webp`,
    orm: `${name}-orm.webp`,
    source:
      "Imagegen reference-derived original atlas; computed normal and ORM maps are approximations, not scanned PBR measurements.",
  });
}
await writeFile(
  "public/assets/textures/manifest.json",
  JSON.stringify(manifest, null, 2),
);
console.log(
  "Built four local material sets, each with albedo, approximate tangent normal and ORM.",
);
