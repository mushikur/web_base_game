import {
  Mesh,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  TransformNode,
} from "./engine";
import { hex, texture } from "./art";
import type { Role } from "@neta/shared";
const textileCache = new WeakMap<Scene, ReturnType<typeof texture>>();
const normalCache = new WeakMap<Scene, ReturnType<typeof texture>>();
const skinNormalCache = new WeakMap<Scene, ReturnType<typeof texture>>();

function skinNormal(scene: Scene) {
  let normal = skinNormalCache.get(scene);
  if (!normal) {
    normal = texture(
      scene,
      "Subtle face and scalp micro-normal",
      128,
      128,
      (c) => {
        const pixels = c.createImageData(128, 128);
        let state = 733;
        for (let i = 0; i < pixels.data.length; i += 4) {
          state = (Math.imul(1664525, state) + 1013904223) >>> 0;
          pixels.data[i] = 125 + (state & 7);
          pixels.data[i + 1] = 125 + ((state >>> 16) & 7);
          pixels.data[i + 2] = 255;
          pixels.data[i + 3] = 255;
        }
        c.putImageData(pixels, 0, 0);
      },
    );
    normal.uScale = normal.vScale = 4;
    normal.level = 0.17;
    skinNormalCache.set(scene, normal);
  }
  return normal;
}
function fabrics(scene: Scene) {
  let tex = textileCache.get(scene);
  if (!tex) {
    tex = texture(scene, "Fine woven cotton microstructure", 256, 256, (c) => {
      c.fillStyle = "#e6e2d9";
      c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 256; i += 2) {
        c.strokeStyle = i % 16 === 0 ? "#a7a89a66" : "#ffffff33";
        c.lineWidth = 0.5;
        c.beginPath();
        c.moveTo(i, 0);
        c.lineTo(i, 256);
        c.moveTo(0, i);
        c.lineTo(256, i);
        c.stroke();
      }
    });
    tex.uScale = tex.vScale = 2;
    textileCache.set(scene, tex);
  }
  let normal = normalCache.get(scene);
  if (!normal) {
    normal = texture(scene, "Woven cloth tangent normal", 128, 128, (c) => {
      c.fillStyle = "#8080ff";
      c.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 128; i += 2) {
        c.fillStyle = i % 4 ? "#7888fc" : "#8878fc";
        c.fillRect(i, 0, 1, 128);
        c.fillRect(0, i, 128, 1);
      }
    });
    normal.uScale = normal.vScale = 4;
    normal.level = 0.13;
    normalCache.set(scene, normal);
  }
  return { tex, normal };
}
export function dressCharacter(
  scene: Scene,
  root: TransformNode,
  shadow: ShadowGenerator,
  name: string,
  role: Role,
  color: string,
  template: "original" | "shirt" | "panjabi" | "dupatta" = "original",
  hair: "original" | "short" | "long" = "original",
  beard: "original" | "clean" | "moustache" = "original",
) {
  const female =
      template === "dupatta" || (template === "original" && (
      name === "আসমা আপা" ||
      name === "নীলা" ||
      name.includes("রিনা") ||
      name.includes("শিউলি"))),
    moustache =
      beard === "moustache" || (beard === "original" && (role === "leader" || name.includes("জয়নাল") || name.includes("কুদ্দুস")));
  const hash = [...name].reduce((sum, c) => sum + c.codePointAt(0)!, 0),
    { tex, normal } = fabrics(scene);
  const face = female ? "soft" : moustache ? "mature" : "young";
  let clothing: PBRMaterial | undefined;
  for (const mesh of root.getChildMeshes()) {
    const original = mesh.material;
    if (mesh.name.includes("Face variant ")) {
      const selected = mesh.name.includes(`Face variant ${face}`);
      mesh.setEnabled(selected);
      if (!selected) continue;
    }
    if (mesh.name.includes("optional tunic"))
      mesh.setEnabled(female || template === "panjabi" || (template === "original" && role === "leader"));
    if (mesh.name.includes("Optional woven dupatta")) mesh.setEnabled(female);
    if (mesh.name.includes("Optional long hair")) mesh.setEnabled(hair === "long" || (hair === "original" && female));
    if (mesh.name.includes("Optional moustache")) mesh.setEnabled(moustache);
    if (original instanceof PBRMaterial) {
      if (/Hero woven emerald jersey|Leader cloth|Leader floral indigo sari/.test(original.name)) {
        const jersey = original.clone(`${name} ${original.name}`)!;
        jersey.bumpTexture = normal;
        mesh.material = jersey;
      } else if (/Hero sculpted face|Leader sculpted face/.test(original.name)) {
        const complexion = original.clone(`${name} sculpted face`)!;
        complexion.bumpTexture = skinNormal(scene);
        mesh.material = complexion;
      } else if (original.name.includes("Woven cotton")) {
        if (!clothing) {
          clothing = original.clone(`${name} woven cotton`)!;
          clothing.albedoColor = hex(color).toLinearSpace();
          clothing.albedoTexture = tex;
          clothing.bumpTexture = normal;
          clothing.roughness = 0.91;
        }
        mesh.material = clothing;
      } else if (original.name.includes("Warm brown skin")) {
        const skin = original.clone(`${name} natural skin`)!;
        skin.albedoColor.scaleInPlace(0.89 + (hash % 15) / 100);
        skin.roughness = 0.79;
        if (mesh.name.includes("Face variant "))
          skin.bumpTexture = skinNormal(scene);
        mesh.material = skin;
      } else if (original.name.includes("Collar and stitch")) {
        const stitching = original.clone(`${name} fine seams`)!;
        stitching.albedoColor = hex(color).toLinearSpace().scale(0.65);
        mesh.material = stitching;
      } else if (original.name.includes("Optional woven dupatta")) {
        const shawl = original.clone(`${name} dupatta`)!;
        shawl.albedoColor = hex(
          name === "নীলা" ? "#b8916c" : "#32746e",
        ).toLinearSpace();
        shawl.albedoTexture = tex;
        shawl.bumpTexture = normal;
        mesh.material = shawl;
      }
    }
    mesh.receiveShadows = true;
    if (
      !/Eye white|Dark brown iris|Collar and stitch|Natural lip|Optional moustache/.test(
        mesh.name,
      )
    )
      shadow.addShadowCaster(mesh);
  }
  if (female) root.scaling.set(0.91, 0.96, 0.94);
  else if (role === "leader") root.scaling.set(1.04, 1.02, 1.01);
  else if (name !== "সজল পথিক") {
    const h = 0.97 + (hash % 7) / 100;
    root.scaling.set(1, h, 1);
  }
  return root
    .getChildMeshes()
    .filter(
      (m): m is Mesh =>
        m instanceof Mesh &&
        /Eye white|Dark brown iris|Collar and stitch|Natural lip|Optional moustache/.test(
          m.name,
        ),
    );
}
