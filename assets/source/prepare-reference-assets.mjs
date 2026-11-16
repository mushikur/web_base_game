import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
const source = "D:/game image";
const destination = "assets/source/references";
await mkdir(destination, { recursive: true });
const files = [
  "pexels-photo-35487419.avif",
  "138824683_15828101309691n.jpg",
  "20220509165109_imm_0943_2.jpg",
  "Bangladeshi_style_Rickshaw.jpg",
  "dhaka_buses.jpg",
  "images (1).jpg",
  "images (2).jpg",
  "images (3).jpg",
  "images (4).jpg",
  "images (5).jpg",
  "images.jpg",
];
const manifest = [];
for (const name of files) {
  await copyFile(`${source}/${name}`, `${destination}/${name}`);
  const bytes = await readFile(`${destination}/${name}`);
  const metadata = await sharp(bytes).metadata();
  manifest.push({
    name,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: metadata.width,
    height: metadata.height,
    usage:
      "User-supplied reference; no real political portraits, branding or complete photographs are published in the game.",
  });
}
await sharp(`${source}/pexels-photo-35487419.avif`)
  .resize({ width: 1400, withoutEnlargement: true })
  .jpeg({ quality: 90 })
  .toFile(`${destination}/pexels-preview.jpg`);
await writeFile(
  `${destination}/manifest.json`,
  JSON.stringify(manifest, null, 2),
);
console.log(
  `Archived ${files.length} supplied references; AVIF preview decoded.`,
);
