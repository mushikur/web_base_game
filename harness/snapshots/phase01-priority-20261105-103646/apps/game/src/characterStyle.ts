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
) {
  const female =
      name === "আসমা আপা" ||
      name === "নীলা" ||
      name.includes("রিনা") ||
      name.includes("শিউলি"),
    moustache =
      role === "leader" || name.includes("জয়নাল") || name.includes("কুদ্দুস");
  const hash = [...name].reduce((sum, c) => sum + c.codePointAt(0)!, 0),
    { tex, normal } = fabrics(scene);
  let clothing: PBRMaterial | undefined;
  for (const mesh of root.getChildMeshes()) {
    const original = mesh.material;
    if (mesh.name.includes("optional tunic"))
      mesh.setEnabled(female || role === "leader");
    if (mesh.name.includes("Optional woven dupatta")) mesh.setEnabled(female);
    if (mesh.name.includes("Optional long hair")) mesh.setEnabled(female);
    if (mesh.name.includes("Optional moustache")) mesh.setEnabled(moustache);
    if (original instanceof PBRMaterial) {
      if (original.name.includes("Woven cotton")) {
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
        skin.albedoColor.scaleInPlace(0.85 + (hash % 15) / 100);
        skin.roughness = 0.79;
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
