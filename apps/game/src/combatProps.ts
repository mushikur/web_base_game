import {
  Mesh,
  MeshBuilder,
  Vector3,
  type PBRMaterial,
  type Scene,
} from "./engine";
import type { PickupItem } from "@neta/shared";

export type CombatTool = Exclude<PickupItem, "egg" | "sandal">;
type Material = (
  name: string,
  color: string,
  roughness?: number,
) => PBRMaterial;

export function createCombatTool(
  kind: CombatTool,
  scene: Scene,
  material: Material,
) {
  const root = new Mesh(kind, scene);
  const cylinder = (
    name: string,
    y: number,
    h: number,
    bottom: number,
    top: number,
    color: string,
    roughness = 0.7,
  ) => {
    const part = MeshBuilder.CreateCylinder(
      name,
      {
        height: h,
        diameterTop: top,
        diameterBottom: bottom,
        tessellation: 20,
      },
      scene,
    );
    part.parent = root;
    part.position.y = y;
    part.material = material(name, color, roughness);
    part.receiveShadows = true;
    return part;
  };
  if (kind === "baton") {
    cylinder(
      "Inflatable stitched vinyl",
      0.27,
      0.4,
      0.15,
      0.18,
      "#a53839",
      0.47,
    );
    cylinder("Rounded sealed tip", 0.49, 0.055, 0.18, 0.12, "#a53839", 0.48);
    for (const y of [0.11, 0.38, 0.42])
      cylinder("Cream vinyl seam", y, 0.017, 0.177, 0.177, "#deb881");
    cylinder("Foam wrapped handle", 0, 0.16, 0.076, 0.076, "#2c3434");
    cylinder("Air valve", 0.519, 0.022, 0.025, 0.023, "#35352c");
    const loop = MeshBuilder.CreateTorus(
      "Wrist loop",
      {
        diameter: 0.082,
        thickness: 0.009,
        tessellation: 16,
      },
      scene,
    );
    loop.parent = root;
    loop.position.set(0, -0.11, 0);
    loop.rotation.z = Math.PI / 2;
    loop.material = material("Woven wrist strap", "#40392e");
  } else if (kind === "sound") {
    cylinder(
      "Bullhorn amplifier casing",
      0.032,
      0.14,
      0.125,
      0.13,
      "#922e2c",
      0.51,
    );
    cylinder("Ivory horn flare", 0.167, 0.19, 0.112, 0.25, "#e3d6ae", 0.46);
    cylinder("Rubber horn rim", 0.263, 0.028, 0.248, 0.248, "#333834");
    cylinder("Recessed grille", 0.278, 0.009, 0.218, 0.218, "#222923");
    for (let i = -2; i <= 2; i++) {
      const rib = MeshBuilder.CreateBox(
        "Horn grille rib",
        {
          width: 0.18 - Math.abs(i) * 0.024,
          height: 0.008,
          depth: 0.006,
        },
        scene,
      );
      rib.parent = root;
      rib.position.set(0, 0.284, i * 0.033);
      rib.material = material("Brushed grille metal", "#7c867b");
    }
    const grip = cylinder(
      "Megaphone trigger grip",
      0.011,
      0.18,
      0.047,
      0.047,
      "#34342c",
    );
    grip.position.z = -0.093;
    grip.rotation.x = -0.7;
  } else {
    cylinder(
      "Lacquered festival popper",
      0.08,
      0.24,
      0.07,
      0.117,
      "#36594b",
      0.48,
    );
    for (const y of [-0.017, 0.111, 0.182])
      cylinder(
        "Foil popper wrap",
        y,
        0.027,
        0.09 + y * 0.16,
        0.091 + y * 0.16,
        "#c99b4b",
        0.42,
      );
    cylinder("Confetti nozzle collar", 0.21, 0.034, 0.118, 0.125, "#8e363b");
    cylinder("Confetti nozzle insert", 0.23, 0.008, 0.097, 0.097, "#2a2f27");
    cylinder("Popper twist grip", -0.061, 0.048, 0.069, 0.069, "#333634");
  }
  return root;
}

export function createImpactPaper(
  scene: Scene,
  origin: Vector3,
  material: Material,
  color: string,
  index: number,
) {
  const shape = new Mesh("Small curled paper fleck", scene);
  const w = 0.035 + (index % 3) * 0.014;
  shape.setVerticesData("position", [
    -w,
    0,
    -w,
    w,
    0.008,
    -w,
    w * 0.8,
    0.028,
    w,
    -w * 0.7,
    -0.008,
    w,
  ]);
  shape.setIndices([0, 1, 2, 0, 2, 3]);
  shape.createNormals(true);
  const paper = material(`Confetti ${color}`, color);
  paper.backFaceCulling = false;
  paper.twoSidedLighting = true;
  shape.material = paper;
  shape.position.copyFrom(origin);
  shape.isPickable = false;
  return shape;
}
