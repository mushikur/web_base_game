import { Mesh, PBRMaterial, Scene } from "./engine";
import { material, texture } from "./art";

/** A folded campaign leaflet: an original harmless paper prop for fleeing AI.
 * Actual folded triangles and a raised centre crease, not a proxy sphere. */
export function createHarmlessPaperProp(scene: Scene) {
  const key = "Original fictional promise leaflet";
  let mat = scene.getMaterialByName(key) as PBRMaterial | null;
  if (!mat) {
    mat = material(scene, key, "#f3e8cd", 0.92);
    mat.backFaceCulling = false;
    mat.twoSidedLighting = true;
    mat.albedoTexture = texture(scene, key, 512, 512, (c) => {
      c.fillStyle = "#eee1c2";
      c.fillRect(0, 0, 512, 512);
      c.fillStyle = "#3a6756";
      c.textAlign = "center";
      c.font = "700 52px 'Noto Sans Bengali'";
      c.fillText("প্রতিশ্রুতি", 256, 230, 450);
      c.font = "400 28px 'Noto Sans Bengali'";
      c.fillText("কাগজে অনেক কথা!", 256, 280, 450);
      c.strokeStyle = "#647b5e66";
      c.lineWidth = 2;
      for (let y = 320; y <= 430; y += 22) {
        c.beginPath();
        c.moveTo(80, y);
        c.lineTo(432, y);
        c.stroke();
      }
    });
  }
  const mesh = new Mesh("ভাঁজ করা প্রতিশ্রুতির কাগজ", scene);
  mesh.setVerticesData(
    "position",
    [
      -0.17, 0, -0.14, 0, 0.035, 0.22, -0.035, 0.045, -0.15, 0.17, 0, -0.14,
      0.035, 0.045, -0.15, 0, -0.025, -0.12,
    ],
  );
  mesh.setVerticesData("uv", [0, 0, 0.5, 1, 0.4, 0, 1, 0, 0.6, 0, 0.5, 0.1]);
  mesh.setIndices([0, 1, 2, 4, 1, 3, 2, 1, 5, 5, 1, 4]);
  mesh.createNormals(true);
  mesh.material = mat;
  mesh.receiveShadows = true;
  mesh.metadata = { staticBatchExclude: true, harmless: true };
  return mesh;
}
