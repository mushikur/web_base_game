import {
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  TransformNode,
  Vector3,
} from "./engine";
import {
  material,
  signTexture,
  surfaceMaterial,
  texture,
  weathered,
} from "./art";
import { cameraBounds, type CameraObstacle } from "./cameraCollision";
import {
  createBus,
  createCNG,
  createRickshaw,
  type ParkedVehicle,
} from "./vehicles";
import {
  areaById,
  roadCorridors,
  type AreaId,
  type Point2,
  type RoadCorridor,
  type WorldArea,
} from "../../../packages/shared/src/world-layout.ts";
import {
  allSectorObstacles,
  sectorActorAnchors,
  sectorBuildings,
  sectorRegions,
  type BuildingSpec,
  type SectorActorAnchor,
  type SectorObstacle,
} from "./sectorBlueprints";
import {
  SectorCache,
  type SectorChanges,
  type SectorStatus,
} from "./sectorPolicy";
import { acquireSectorResources } from "./sectorSceneResources";
import type { Material } from "@babylonjs/core/Materials/material";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";

export type SectorPickupAnchor = Point2 & {
  id: string;
  areaId: AreaId;
  kind: "egg" | "sandal";
};
export type SectorHandle = {
  id: string;
  root: TransformNode;
  meshes: Mesh[];
  obstacles: SectorObstacle[];
  cameraObstacles: CameraObstacle[];
  actorAnchors: SectorActorAnchor[];
  pickupAnchors: SectorPickupAnchor[];
  teaShops: (Point2 & { id: string; name: string })[];
  parkedVehicles: ParkedVehicle[];
  active: boolean;
  visible: boolean;
  shadows: boolean;
  /** The integrator registers sector-owned physics, camera proxies, rigs and
   * emitters here; release unregisters those before disposing geometry. */
  own(dispose: () => void): void;
  setVisible(visible: boolean): void;
  setActive(active: boolean): void;
  setShadows(enabled: boolean): void;
  dispose(): void;
};

type Palette = ReturnType<typeof createPalette>;
function createPalette(scene: Scene) {
  const plaster = new Map<string, PBRMaterial>();
  return {
    plaster(color: string) {
      let m = plaster.get(color);
      if (!m) {
        m = surfaceMaterial(
          scene,
          `Outer Dhaka lime plaster ${color}`,
          "plaster",
          2,
          3,
          color,
        );
        plaster.set(color, m);
      }
      return m;
    },
    asphalt: surfaceMaterial(
      scene,
      "Outer Dhaka worn asphalt",
      "asphalt",
      8,
      12,
    ),
    concrete: weathered(scene, "Outer Dhaka pavement concrete", "#a99e87"),
    brick: weathered(scene, "Outer Dhaka brick footpath", "#86614e"),
    wood: weathered(
      scene,
      "Outer Dhaka old tea counter timber",
      "#71553d",
      "wood",
    ),
    steel: material(
      scene,
      "Outer Dhaka corrugated steel",
      "#8e9891",
      0.7,
      0.65,
    ),
    iron: material(scene, "Outer Dhaka black iron", "#283b36", 0.74, 0.45),
    yellow: material(scene, "Outer Dhaka divider yellow", "#d1aa3a", 0.7, 0.2),
    chalk: material(scene, "Outer Dhaka faded road white", "#d1cdb4", 0.95),
    glass: material(
      scene,
      "Outer Dhaka dark window glazing",
      "#294441",
      0.28,
      0.32,
    ),
    black: material(scene, "Outer Dhaka tire and cable", "#1f2927", 0.91),
    leaf: material(scene, "Outer Dhaka banana leaf", "#486944", 0.9),
    clay: material(scene, "Outer Dhaka clay cups", "#b36b49", 0.92),
    canvas: material(scene, "Outer Dhaka faded canvas", "#606c56", 0.92),
    cream: material(scene, "Outer Dhaka old porcelain", "#dbd4b7", 0.62),
    water: material(
      scene,
      "Outer Dhaka kettle blackened metal",
      "#4b5350",
      0.34,
      0.76,
    ),
    red: material(scene, "Outer Dhaka muted red cloth", "#964a43", 0.88),
    teal: material(
      scene,
      "Outer Dhaka faded teal shutter",
      "#44766f",
      0.76,
      0.22,
    ),
  };
}

/** All geometry in a handle is original procedural modelling in metres. Shapes
 * are assembled into architectural/prop silhouettes and shaded with existing
 * licensed photographic PBR maps or editable hand-painted Bengali artwork. */
function buildSector(
  scene: Scene,
  shadow: ShadowGenerator,
  id: string,
  palette: Palette,
): SectorHandle {
  const root = new TransformNode(`Dhaka sector ${id}`, scene);
  root.metadata = { sectorId: id, staticBatchExclude: true };
  const cameraObstacles: CameraObstacle[] = [],
    obstacles: SectorObstacle[] = [],
    actorAnchors: SectorActorAnchor[] = [],
    pickupAnchors: SectorPickupAnchor[] = [],
    teaShops: SectorHandle["teaShops"] = [],
    parkedVehicles: ParkedVehicle[] = [],
    cleanup: (() => void)[] = [],
    vehicleRoots: TransformNode[] = [];
  let disposed = false;
  const finish = (mesh: Mesh, mat: PBRMaterial, cast = true) => {
    mesh.parent = root;
    mesh.material = mat;
    mesh.receiveShadows = true;
    mesh.metadata = { sectorId: id, staticBatchExclude: true };
    if (cast) shadow.addShadowCaster(mesh);
    return mesh;
  };
  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: PBRMaterial,
    cast = true,
  ) => {
    const mesh = finish(
      MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene),
      mat,
      cast,
    );
    mesh.position.set(x, y, z);
    return mesh;
  };
  const cylinder = (
    name: string,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    mat: PBRMaterial,
    top = r,
  ) => {
    const mesh = finish(
      MeshBuilder.CreateCylinder(
        name,
        {
          height: h,
          diameter: r * 2,
          diameterTop: top * 2,
          diameterBottom: r * 2,
          tessellation: 12,
        },
        scene,
      ),
      mat,
    );
    mesh.position.set(x, y, z);
    return mesh;
  };
  const rod = (
    name: string,
    path: Vector3[],
    radius: number,
    mat: PBRMaterial,
  ) =>
    finish(
      MeshBuilder.CreateTube(name, { path, radius, tessellation: 6 }, scene),
      mat,
    );
  const wall = (mesh: Mesh) => {
    cameraObstacles.push(cameraBounds(mesh));
    return mesh;
  };
  const lettering = (
    name: string,
    subtitle: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    yaw = 0,
    background = "#294e43",
  ) => {
    const mat = material(scene, `${id}: Bengali sign ${name}`, "#ffffff", 0.88);
    mat.albedoTexture = signTexture(scene, name, subtitle, background);
    mat.backFaceCulling = false;
    const mesh = finish(
      MeshBuilder.CreatePlane(
        `হাতে লেখা ফলক ${name}`,
        { width: w, height: h },
        scene,
      ),
      mat,
      false,
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    return mesh;
  };
  const building = (spec: BuildingSpec) => {
    const { x, z, w, d, h, floors } = spec;
    const outer = palette.plaster(spec.tint);
    wall(
      box(
        `Weathered Dhaka building ${spec.id}`,
        x,
        h / 2 + 0.2,
        z,
        w,
        h,
        d,
        outer,
      ),
    );
    box("Concrete roof parapet", x, h + 0.45, z, w + 0.3, 0.5, d + 0.25, outer);
    box(
      "Roof parapet inset",
      x,
      h + 0.65,
      z,
      w - 0.25,
      0.15,
      d - 0.4,
      palette.iron,
    );
    const frontZ = z - d / 2 - 0.02;
    // Ground floor shutter bays, inset doors and counter fascia.
    for (let bay = -1; bay <= 1; bay++) {
      const xx = x + bay * (w / 3);
      box(
        "Shop rolling shutter",
        xx,
        1.48,
        frontZ - 0.025,
        w / 3 - 0.18,
        2.35,
        0.08,
        palette.teal,
      );
      for (let yy = 0.45; yy < 2.6; yy += 0.17)
        box(
          "Shutter pressed metal rib",
          xx,
          yy,
          frontZ - 0.08,
          w / 3 - 0.22,
          0.025,
          0.032,
          palette.iron,
          false,
        );
      box(
        "Shop shutter concrete pier",
        xx - w / 6 + 0.04,
        1.55,
        frontZ - 0.1,
        0.16,
        2.8,
        0.25,
        outer,
      );
    }
    lettering(
      spec.shop,
      "ঢাকার নিজের পাড়া • খাঁটি আড্ডা",
      x,
      3.05,
      frontZ - 0.2,
      w - 0.25,
      0.85,
      0,
      spec.kind === "print"
        ? "#853f36"
        : spec.kind === "tailor"
          ? "#315d65"
          : "#34584b",
    );
    const awning = box(
      "Corrugated shop sunshade",
      x,
      3.65,
      frontZ - 0.65,
      w + 0.2,
      0.085,
      1.55,
      palette.steel,
    );
    awning.rotation.x = -0.12;
    for (let xx = -w / 2; xx <= w / 2; xx += 0.23)
      box(
        "Roof corrugation",
        x + xx,
        3.67,
        frontZ - 0.65,
        0.025,
        0.045,
        1.5,
        palette.steel,
        false,
      ).rotation.x = -0.12;
    for (let floor = 1; floor < floors; floor++) {
      const y = 2.6 + floor * 2.75;
      for (let bay = -1; bay <= 1; bay++) {
        const xx = x + bay * (w / 3);
        box(
          "Recessed dark window",
          xx,
          y,
          frontZ - 0.015,
          1.15,
          1.45,
          0.075,
          palette.glass,
        );
        for (const dx of [-0.61, 0, 0.61])
          box(
            "Window concrete and mullion",
            xx + dx,
            y,
            frontZ - 0.1,
            0.055,
            1.6,
            0.12,
            outer,
            false,
          );
        box(
          "Window rain sill",
          xx,
          y - 0.83,
          frontZ - 0.18,
          1.4,
          0.1,
          0.4,
          outer,
        );
        if ((floor + bay) % 2 === 0) {
          box(
            "Dhaka projecting balcony slab",
            xx,
            y - 0.85,
            frontZ - 0.65,
            1.8,
            0.15,
            1.2,
            outer,
          );
          rod(
            "Balcony iron handrail",
            [
              new Vector3(xx - 0.87, y + 0.04, frontZ - 1.2),
              new Vector3(xx + 0.87, y + 0.04, frontZ - 1.2),
            ],
            0.025,
            palette.iron,
          );
          for (let dx = -0.8; dx <= 0.8; dx += 0.2)
            rod(
              "Balcony iron baluster",
              [
                new Vector3(xx + dx, y - 0.72, frontZ - 1.2),
                new Vector3(xx + dx, y + 0.04, frontZ - 1.2),
              ],
              0.013,
              palette.iron,
            );
          if (floor === 1)
            box(
              "Locally woven gamcha drying",
              xx - 0.1,
              y - 0.16,
              frontZ - 1.23,
              0.7,
              0.72,
              0.025,
              palette.red,
              false,
            );
        }
      }
    }
    for (const sx of [-0.31, 0.28]) {
      cylinder(
        "Rooftop water tank",
        x + sx * w,
        h + 0.9,
        z + 0.4,
        0.65,
        1.15,
        palette.black,
      );
      cylinder(
        "Water tank lid",
        x + sx * w,
        h + 1.51,
        z + 0.4,
        0.7,
        0.1,
        palette.black,
      );
      for (let y = h + 0.48; y < h + 1.42; y += 0.22)
        cylinder(
          "Water tank moulding",
          x + sx * w,
          y,
          z + 0.4,
          0.67,
          0.04,
          palette.iron,
        );
    }
    // Exposed drainpipes and protruding unfinished roof rebar.
    rod(
      "Building drain downpipe",
      [
        new Vector3(x + w / 2 + 0.05, 0.3, frontZ + 0.2),
        new Vector3(x + w / 2 + 0.05, h + 0.2, frontZ + 0.2),
      ],
      0.065,
      palette.iron,
    );
    for (let i = 0; i < 4; i++)
      cylinder(
        "Roof construction rebar",
        x - w / 2 + 0.4 + i * 0.12,
        h + 0.9,
        z + d / 2 - 0.4,
        0.012,
        1.3,
        palette.iron,
      );
  };

  const teaStall = (area: WorldArea) => {
    const cx = area.center.x,
      cz = area.center.z,
      x = cx - 12.7,
      z = cz - 4;
    box(
      "Raised tea stall tiled floor",
      x + 1.15,
      0.12,
      z,
      5.2,
      0.2,
      5.6,
      palette.concrete,
    );
    wall(
      box(
        "Tea stall weathered timber back",
        cx - 14.8,
        1.45,
        z,
        0.2,
        2.5,
        5.6,
        palette.wood,
      ),
    );
    for (const dz of [-2.6, 2.6]) {
      cylinder(
        "Tea shop steel roof support",
        cx - 9.6,
        1.7,
        z + dz,
        0.055,
        3,
        palette.iron,
      );
      rod(
        "Tea shop roof brace",
        [
          new Vector3(cx - 9.6, 2.6, z + dz),
          new Vector3(cx - 10.5, 3.1, z + dz),
        ],
        0.035,
        palette.iron,
      );
    }
    box(
      "Tea shop roof sheet",
      x + 0.7,
      3.2,
      z,
      5.7,
      0.08,
      6.05,
      palette.steel,
    ).rotation.z = -0.06;
    for (let zz = z - 2.9; zz <= z + 2.9; zz += 0.23)
      box(
        "Tea shop roof flute",
        x + 0.7,
        3.25,
        zz,
        5.7,
        0.06,
        0.025,
        palette.steel,
        false,
      ).rotation.z = -0.06;
    wall(
      box(
        "Tea stall timber counter",
        cx - 11.7,
        0.77,
        z,
        1.1,
        1.1,
        4.2,
        palette.wood,
      ),
    );
    box(
      "Tea counter worn metal top",
      cx - 11.7,
      1.35,
      z,
      1.24,
      0.09,
      4.3,
      palette.steel,
    );
    lettering(
      "কেটলি কেবিনেট",
      "লাল চা • দুধ চা • বিস্কুট",
      cx - 9.4,
      2.7,
      z,
      4.8,
      0.85,
      -Math.PI / 2,
      "#784536",
    );
    // Open cabinet shelves and glass jars with distinct lids, cups and saucers.
    for (const yy of [1.65, 2.2]) {
      box(
        "Tea shop open shelf",
        cx - 14.48,
        yy,
        z,
        0.6,
        0.09,
        4.7,
        palette.wood,
      );
      for (let j = 0; j < 6; j++) {
        cylinder(
          "Tea biscuit jar",
          cx - 14.25,
          yy + 0.21,
          z - 1.8 + j * 0.7,
          0.17,
          0.32,
          palette.glass,
        );
        cylinder(
          "Tea biscuit jar red lid",
          cx - 14.25,
          yy + 0.4,
          z - 1.8 + j * 0.7,
          0.19,
          0.055,
          palette.red,
        );
      }
    }
    cylinder(
      "Kettle blackened rounded pot",
      cx - 11.72,
      1.65,
      z + 0.7,
      0.26,
      0.48,
      palette.water,
      0.2,
    );
    cylinder(
      "Kettle lid",
      cx - 11.72,
      1.91,
      z + 0.7,
      0.24,
      0.045,
      palette.water,
    );
    cylinder(
      "Kettle lid knob",
      cx - 11.72,
      1.98,
      z + 0.7,
      0.055,
      0.1,
      palette.black,
    );
    rod(
      "Kettle curved spout",
      [
        new Vector3(cx - 11.48, 1.55, z + 0.7),
        new Vector3(cx - 11.26, 1.61, z + 0.7),
        new Vector3(cx - 11.21, 1.84, z + 0.7),
      ],
      0.06,
      palette.water,
    );
    rod(
      "Kettle handle",
      [
        new Vector3(cx - 11.85, 1.85, z + 0.7),
        new Vector3(cx - 12.08, 2.11, z + 0.7),
        new Vector3(cx - 11.53, 2.11, z + 0.7),
        new Vector3(cx - 11.6, 1.85, z + 0.7),
      ],
      0.035,
      palette.black,
    );
    for (let j = 0; j < 5; j++) {
      cylinder(
        "Chipped porcelain saucer",
        cx - 11.25,
        1.42,
        z - 1.3 + j * 0.35,
        0.13,
        0.025,
        palette.cream,
      );
      cylinder(
        "Local clay tea cup",
        cx - 11.25,
        1.5,
        z - 1.3 + j * 0.35,
        0.085,
        0.14,
        palette.clay,
        0.105,
      );
    }
    for (const zz of [-1.4, 1.3]) {
      const bench = box(
        "Tea shop wooden bench",
        cx - 9.35,
        0.63,
        z + zz,
        0.5,
        0.12,
        1.4,
        palette.wood,
      );
      bench.rotation.y = Math.PI / 2;
      for (const dz of [-0.5, 0.5]) {
        cylinder(
          "Bench steel leg",
          cx - 9.35,
          0.38,
          z + zz + dz,
          0.035,
          0.5,
          palette.iron,
        );
      }
    }
    teaShops.push({
      id: `${area.id}:tea`,
      name: "কেটলি কেবিনেট",
      ...area.teaShop,
    });
  };

  const streetPole = (x: number, z: number, span = 11) => {
    cylinder(
      "Dhaka concrete utility pole",
      x,
      4.65,
      z,
      0.12,
      9.3,
      palette.concrete,
      0.075,
    );
    box(
      "Utility pole transformer enclosure",
      x,
      6.1,
      z,
      0.55,
      0.8,
      0.36,
      palette.steel,
    );
    for (const yy of [7.65, 8.35]) {
      rod(
        "Crossarm",
        [new Vector3(x - 0.55, yy, z), new Vector3(x + 0.55, yy, z)],
        0.035,
        palette.iron,
      );
      for (const dx of [-0.45, 0, 0.45])
        cylinder(
          "Porcelain utility insulator",
          x + dx,
          yy + 0.12,
          z,
          0.055,
          0.18,
          palette.cream,
        );
    }
    for (let i = 0; i < 6; i++)
      rod(
        "Sagging Dhaka utility cable",
        Array.from({ length: 17 }, (_, sample) => {
          const t = sample / 16;
          return new Vector3(
            x + (i % 3) * 0.16 * (1 - t) - span * t,
            7.8 + (i % 2) * 0.5 - (5.6 + (i % 2) * 0.4) * t * (1 - t),
            z + 0.1 * i * Math.sin(Math.PI * t),
          );
        }),
        0.012 + i * 0.001,
        palette.black,
      );
    // Cable coil is an actual looped tube rather than a flat dark disc.
    const coil = Array.from({ length: 25 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return new Vector3(
        x + Math.cos(a) * 0.38,
        5 + Math.sin(a) * 0.48,
        z - 0.17,
      );
    });
    rod("Loop of unused utility cable", coil, 0.025, palette.black);
    const arm = rod(
      "Bent street lamp arm",
      [
        new Vector3(x, 7.3, z),
        new Vector3(x - 0.9, 7.5, z),
        new Vector3(x - 1.4, 7.35, z),
      ],
      0.05,
      palette.iron,
    );
    arm.metadata = { sectorId: id, staticBatchExclude: true };
    box("Street lamp casing", x - 1.4, 7.27, z, 0.65, 0.13, 0.3, palette.steel);
    box(
      "Street lamp frosted glass",
      x - 1.4,
      7.18,
      z,
      0.5,
      0.04,
      0.24,
      palette.cream,
      false,
    );
  };

  const banner = (area: WorldArea) => {
    const cx = area.center.x,
      cz = area.center.z;
    for (const dx of [-3.4, 3.4]) {
      cylinder(
        "Bamboo banner mast",
        cx + dx,
        2.55,
        cz + 6,
        0.045,
        5.1,
        palette.wood,
      );
      rod(
        "Banner mast rope",
        [
          new Vector3(cx + dx, 4.5, cz + 6),
          new Vector3(cx + dx * 1.35, 0.15, cz + 7.5),
        ],
        0.012,
        palette.canvas,
      );
    }
    lettering(
      area.name,
      area.id === "committee-lane"
        ? "কমিটি জিন্দাবাদ!"
        : area.id === "microphone-square"
          ? "মাইক চলবে!"
          : area.id === "poster-quarter"
            ? "পোস্টার লাগাই, রাস্তা ছাড়ি!"
            : "হিসাব চাই, আড্ডা চাই!",
      cx,
      4.2,
      cz + 6,
      6.5,
      1.25,
      0,
      "#4f6141",
    );
    // Carpet stays flush with the road; assistance routes need no invisible step.
    box(
      "Original woven speech carpet",
      cx,
      0.025,
      cz + 4,
      4.6,
      0.035,
      3,
      palette.red,
      false,
    );
    const micX = cx + 0.6,
      micZ = cz + 3.4;
    cylinder(
      "Microphone weighted stand base",
      micX,
      0.045,
      micZ,
      0.25,
      0.055,
      palette.iron,
    );
    cylinder("Microphone stand", micX, 0.87, micZ, 0.018, 1.65, palette.iron);
    rod(
      "Microphone angled stem",
      [new Vector3(micX, 1.65, micZ), new Vector3(micX - 0.35, 1.9, micZ)],
      0.018,
      palette.iron,
    );
    const mic = cylinder(
      "Microphone woven grille",
      micX - 0.37,
      1.9,
      micZ,
      0.055,
      0.21,
      palette.black,
    );
    mic.rotation.z = Math.PI / 2;
    for (const dx of [-2.5, 2.5]) {
      box(
        "PA speaker cabinet",
        cx + dx,
        0.63,
        cz + 5.5,
        0.65,
        1.1,
        0.5,
        palette.iron,
      );
      for (const yy of [0.38, 0.83]) {
        const cone = cylinder(
          "Speaker inset cone",
          cx + dx,
          yy,
          cz + 5.23,
          0.2,
          0.05,
          palette.black,
        );
        cone.rotation.x = Math.PI / 2;
      }
      for (let yy = 0.2; yy < 1.1; yy += 0.09)
        box(
          "Speaker metal protective grille",
          cx + dx,
          yy,
          cz + 5.19,
          0.56,
          0.012,
          0.014,
          palette.steel,
          false,
        );
    }
    // The single portable divider leaves the central route and ambulance lane open.
    const barrierX = cx + 5.7,
      barrierZ = cz - 1;
    for (const dx of [-0.8, 0.8]) {
      box(
        "Roadblock iron foot",
        barrierX + dx,
        0.1,
        barrierZ,
        0.12,
        0.15,
        0.65,
        palette.iron,
      );
      cylinder(
        "Roadblock yellow post",
        barrierX + dx,
        0.65,
        barrierZ,
        0.035,
        1.2,
        palette.yellow,
      );
    }
    box(
      "Yellow Dhaka portable road divider",
      barrierX,
      0.84,
      barrierZ,
      1.8,
      0.45,
      0.06,
      palette.yellow,
    );
    lettering(
      "রাস্তা ছাড়ুন",
      "পথচারী আগে",
      barrierX,
      0.85,
      barrierZ - 0.045,
      1.55,
      0.32,
      0,
      "#384b3f",
    );
    const barrier = {
      id: `${id}:divider`,
      x: barrierX,
      z: barrierZ,
      w: 1.8,
      d: 0.2,
      h: 1.25,
    };
    cameraObstacles.push({ name: barrier.id, ...barrier, y: 0.625 });
  };

  const posterWall = (area: WorldArea) => {
    const x = area.center.x + 12,
      z = area.center.z;
    wall(
      box(
        "Print quarter old boundary wall",
        x,
        1.7,
        z,
        0.3,
        3,
        8.8,
        palette.plaster("#b4ad99"),
      ),
    );
    for (let i = 0; i < 6; i++)
      lettering(
        ["প্রতিশ্রুতি মেলা", "চায়ের আড্ডা", "রঙের উৎসব"][i % 3],
        ["কথা কম • কাজ বেশি", "এই পাড়া সবার", "নদী বাঁচাই • শহর সাজাই"][i % 3],
        x - 0.17,
        1.6 + (i % 2) * 0.18,
        z - 3.5 + i * 1.4,
        1.25,
        1.8,
        Math.PI / 2,
        ["#385b67", "#7b5143", "#496448"][i % 3],
      );
    const art = material(
      scene,
      `${id}: original geometric textile art`,
      "#ffffff",
      0.96,
    );
    art.albedoTexture = texture(
      scene,
      `${id}: nakshi kantha geometry`,
      512,
      256,
      (c) => {
        c.fillStyle = "#e0cf9f";
        c.fillRect(0, 0, 512, 256);
        for (let y = 0; y < 256; y += 64)
          for (let x = 0; x < 512; x += 64) {
            c.fillStyle = ["#a7473a", "#35776a", "#d4a13c", "#665377"][
              (x / 64 + y / 64) % 4
            ];
            c.beginPath();
            c.moveTo(x + 32, y + 5);
            c.lineTo(x + 59, y + 32);
            c.lineTo(x + 32, y + 59);
            c.lineTo(x + 5, y + 32);
            c.closePath();
            c.fill();
            c.fillStyle = "#e6d4ab";
            c.fillRect(x + 25, y + 25, 14, 14);
          }
      },
    );
    box(
      "Original painted nakshi wall panel",
      x - 0.2,
      3.2,
      z,
      0.05,
      0.5,
      8.5,
      art,
      false,
    );
  };

  const officeDetails = (area: WorldArea) => {
    const cx = area.center.x,
      cz = area.center.z;
    // Cast concrete screen, sheltered entry and a fictional ledger motif.
    for (const dx of [-6, -3, 0, 3, 6])
      box(
        "Office arcade concrete column",
        cx + dx,
        1.7,
        cz + 12.4,
        0.38,
        3,
        0.6,
        palette.plaster("#c3bca4"),
      );
    box(
      "Office arcade shade slab",
      cx,
      3.3,
      cz + 12.6,
      15.5,
      0.25,
      2.2,
      palette.concrete,
    );
    for (let y = 4.2; y < 12.6; y += 1.1)
      for (let x = -6.5; x < 7; x += 1.1) {
        box(
          "Office concrete screen vertical",
          cx + x,
          y,
          cz + 13.85,
          0.09,
          0.82,
          0.24,
          palette.concrete,
          false,
        );
        box(
          "Office concrete screen horizontal",
          cx + x + 0.38,
          y - 0.4,
          cz + 13.85,
          0.82,
          0.09,
          0.24,
          palette.concrete,
          false,
        );
      }
    lettering(
      "ক্ষমতা ভবন",
      "কাল্পনিক পাড়া উন্নয়ন সমিতি",
      cx,
      3.8,
      cz + 11.4,
      8,
      1.1,
      0,
      "#3b584e",
    );
    lettering(
      "জনগণের পথ সবার",
      "দরবার নয় • সেবা চাই",
      cx + 8,
      2.3,
      cz + 8.6,
      3.5,
      1,
      0,
      "#765645",
    );
  };

  const connector = (road: RoadCorridor) => {
    const horizontal = Math.abs(road.to.x - road.from.x) > 0.01;
    const length = Math.hypot(road.to.x - road.from.x, road.to.z - road.from.z);
    const x = (road.from.x + road.to.x) / 2,
      z = (road.from.z + road.to.z) / 2;
    // The hub is authored up to z26. It owns its original north road surface.
    const trimmed =
      road.id === "north-link" ? { x: 0, z: 30, length: 8 } : { x, z, length };
    box(
      "Connected Dhaka asphalt road",
      trimmed.x,
      -0.065,
      trimmed.z,
      horizontal ? trimmed.length + road.width : road.width,
      0.12,
      horizontal
        ? road.width
        : trimmed.length + (road.id === "north-link" ? 0 : road.width),
      palette.asphalt,
      false,
    );
    // Thin painted shoulders remain flush with the shared connector surface.
    for (const side of [-1, 1])
      box(
        "Worn connector shoulder line",
        x + (horizontal ? 0 : side * 5.45),
        0.006,
        z + (horizontal ? side * 5.45 : 0),
        horizontal ? length : 0.08,
        0.009,
        horizontal ? 0.08 : length,
        palette.chalk,
        false,
      );
    for (let d = 4; d < length - 2; d += 6) {
      const t = d / length;
      const px = road.from.x + (road.to.x - road.from.x) * t,
        pz = road.from.z + (road.to.z - road.from.z) * t;
      box(
        "Worn lane guide dash",
        px,
        0.008,
        pz,
        horizontal ? 2.3 : 0.085,
        0.009,
        horizontal ? 0.085 : 2.3,
        palette.chalk,
        false,
      );
    }
    if (length > 25) {
      const px =
        road.from.x + (road.to.x - road.from.x) * 0.5 + (horizontal ? 0 : 6.5);
      const pz =
        road.from.z + (road.to.z - road.from.z) * 0.5 + (horizontal ? 6.5 : 0);
      streetPole(px, pz, horizontal ? 11 : 5);
      lettering(
        "ধীরে চলুন",
        "পথচারীকে আগে যেতে দিন",
        px,
        2.7,
        pz - 0.18,
        1.6,
        0.7,
        0,
        "#38583c",
      );
    }
    if (road.id === "north-link") {
      // Actual accessible ramp off the preserved speech dais, with the same
      // world-space slope sampled by the shared C height/navigation facade.
      const ramp = box(
        "Speech dais accessible timber ramp",
        4.4,
        0.215,
        10.6,
        1.29,
        0.08,
        1.4,
        palette.wood,
      );
      ramp.rotation.z = -Math.atan2(0.46, 1.2);
      for (const zz of [9.92, 11.28]) {
        const edge = box(
          "Ramp galvanized safety edge",
          4.4,
          0.27,
          zz,
          1.3,
          0.07,
          0.035,
          palette.steel,
        );
        edge.rotation.z = ramp.rotation.z;
      }
      for (let xx = 3.91; xx < 4.9; xx += 0.16) {
        const yy = (0.46 * (5 - xx)) / 1.2 + 0.015;
        box(
          "Ramp grip cross batten",
          xx,
          yy,
          10.6,
          0.025,
          0.025,
          1.3,
          palette.iron,
          false,
        );
      }
    }
  };

  if (id.startsWith("road:")) {
    const road = roadCorridors.find((r) => `road:${r.id}` === id);
    if (!road) throw new Error("রাস্তার সেক্টর পাওয়া যায়নি।");
    obstacles.push(
      ...allSectorObstacles.filter((o) => o.id.startsWith(`${id}:`)),
    );
    connector(road);
  } else {
    const area = areaById(id as AreaId),
      cx = area.center.x,
      cz = area.center.z;
    const existing = allSectorObstacles.filter((o) =>
      o.id.startsWith(`${id}:`),
    );
    obstacles.push(...existing);
    // Distinct block footprints share an open cross and the protected ambulance lane.
    box(
      "Outer Dhaka ground",
      cx,
      -0.085,
      cz,
      34,
      0.14,
      36,
      palette.asphalt,
      false,
    );
    for (const side of [-1, 1]) {
      box(
        "Outer Dhaka raised footpath",
        cx + side * 11.5,
        0.095,
        cz,
        11,
        0.2,
        36,
        id === "committee-lane" ? palette.brick : palette.concrete,
        false,
      );
      for (let zz = -17.8; zz < 18; zz += 0.6)
        box(
          "Painted local footpath edge",
          cx + side * 6.02,
          0.15,
          cz + zz,
          0.09,
          0.1,
          0.55,
          Math.round(zz / 0.6) % 2 ? palette.chalk : palette.iron,
          false,
        );
    }
    // A flush paved crossing cuts across the footpath at the real mission entrance.
    for (let dx = -4.5; dx <= 4.5; dx += 1)
      box(
        "Bengali neighborhood zebra crossing",
        cx + dx,
        0.009,
        cz - 10,
        0.65,
        0.012,
        2.1,
        palette.chalk,
        false,
      );
    for (const spec of sectorBuildings(area)) building(spec);
    teaStall(area);
    banner(area);
    // Reachable cover has real authored geometry and a small foot clearance,
    // rather than an AI point that refers to empty space.
    box(
      "Wooden delivery crate cover",
      cx + 3.9,
      0.55,
      cz + 5,
      0.7,
      1.05,
      1.6,
      palette.wood,
    );
    for (const zz of [-0.68, 0, 0.68]) {
      box(
        "Crate reinforcing slat",
        cx + 3.9,
        0.58,
        cz + 5 + zz,
        0.76,
        1.1,
        0.08,
        palette.wood,
      );
      for (const yy of [0.2, 0.85])
        cylinder(
          "Crate iron nail head",
          cx + 3.51,
          yy,
          cz + 5 + zz,
          0.018,
          0.02,
          palette.iron,
        ).rotation.z = Math.PI / 2;
    }
    box(
      "Concrete courtyard plant trough",
      cx - 3.2,
      0.45,
      cz + 8,
      1.2,
      0.85,
      0.6,
      palette.concrete,
    );
    box(
      "Planter dark earth",
      cx - 3.2,
      0.89,
      cz + 8,
      1.05,
      0.035,
      0.47,
      palette.wood,
      false,
    );
    for (let i = 0; i < 5; i++) {
      const x = cx - 3.65 + i * 0.22;
      rod(
        "Courtyard plant arched leaf",
        [
          new Vector3(x, 0.9, cz + 8),
          new Vector3(x + 0.2, 1.4, cz + 8),
          new Vector3(x + 0.4, 1.5, cz + 8.1),
        ],
        0.035,
        palette.leaf,
      );
      rod(
        "Courtyard plant side leaf",
        [
          new Vector3(x, 0.9, cz + 8),
          new Vector3(x - 0.1, 1.25, cz + 7.9),
          new Vector3(x - 0.3, 1.25, cz + 7.85),
        ],
        0.025,
        palette.leaf,
      );
    }
    streetPole(cx + 7.6, cz + 9, 15.2);
    lettering(
      area.name,
      "ঢাকার কাল্পনিক পাড়া",
      cx + 5.2,
      2.3,
      cz - 10.8,
      3.6,
      0.85,
      0,
      "#345d53",
    );
    for (const p of area.pickups)
      pickupAnchors.push({
        id: `${area.id}:pickup-${p.kind}`,
        areaId: area.id,
        kind: p.kind,
        ...p.position,
      });
    actorAnchors.push(...sectorActorAnchors(area));
    const cng = createCNG(
      scene,
      shadow,
      new Vector3(area.parking.x, 0.2, area.parking.z),
      0,
    );
    cng.id = `${area.id}:parked-cng`;
    cng.name = "পাড়ার সবুজ সিএনজি";
    cng.root.parent = root;
    cng.root.metadata = { sectorId: id, staticBatchExclude: true };
    for (const child of cng.root.getChildMeshes())
      child.metadata = {
        ...child.metadata,
        sectorId: id,
        vehicleId: cng.id,
        staticBatchExclude: true,
      };
    parkedVehicles.push(cng);
    cameraObstacles.push({ name: cng.id, ...cng.footprint, y: 1.15 });
    // Vehicle footprints are exposed separately for the existing boarding exclusion.
    if (id === "poster-quarter") {
      posterWall(area);
      const rickshaw = createRickshaw(
        scene,
        shadow,
        new Vector3(cx + 13.7, 0.2, cz - 6.8),
        -0.3,
      );
      rickshaw.parent = root;
      vehicleRoots.push(rickshaw);
      for (const mesh of rickshaw.getChildMeshes())
        mesh.metadata = {
          ...mesh.metadata,
          sectorId: id,
          staticBatchExclude: true,
        };
    }
    if (id === "microphone-square") {
      // Keep the shelter on the eastern verge; the CNG/ambulance bays stay clear.
      box(
        "Bus stop shelter concrete plinth",
        cx + 13.1,
        0.3,
        cz + 1.1,
        3.5,
        0.2,
        5.8,
        palette.concrete,
      );
      for (const dx of [-1.45, 1.45])
        for (const dz of [-2.5, 2.5])
          cylinder(
            "Bus stop steel column",
            cx + 13.1 + dx,
            1.8,
            cz + 1.1 + dz,
            0.05,
            2.9,
            palette.iron,
          );
      box(
        "Bus stop shelter corrugated canopy",
        cx + 13.1,
        3.3,
        cz + 1.1,
        3.8,
        0.1,
        6.2,
        palette.steel,
      );
      box(
        "Bus shelter bench",
        cx + 13.1,
        0.78,
        cz + 2,
        2.6,
        0.13,
        0.45,
        palette.wood,
      );
      lettering(
        "মাইক চত্বর যাত্রী ছাউনি",
        "লাইনে দাঁড়ান • নিরাপদে উঠুন",
        cx + 13.1,
        2.4,
        cz - 1.5,
        3.1,
        0.8,
      );
      const bus = createBus(
        scene,
        shadow,
        new Vector3(cx + 16.2, 0.2, cz + 7),
        0,
      );
      bus.parent = root;
      vehicleRoots.push(bus);
      for (const mesh of bus.getChildMeshes())
        mesh.metadata = {
          ...mesh.metadata,
          sectorId: id,
          staticBatchExclude: true,
        };
      cameraObstacles.push({
        name: `${id}:parked-bus`,
        x: cx + 16.2,
        y: 1.7,
        z: cz + 7,
        w: 2.6,
        d: 7,
        h: 3.1,
      });
    }
    if (id === "committee-lane") {
      // Narrow textile frontage: projected cloth shades and suspended garment rails.
      for (let i = 0; i < 7; i++) {
        const zz = cz - 16 + i * 0.65;
        box(
          "Tailor shop hanging fabric bolt",
          cx - 8.1,
          2.1,
          zz,
          0.13,
          1.7,
          0.46,
          i % 2 ? palette.teal : palette.red,
          false,
        );
      }
      lettering(
        "সেলাই সংসদ",
        "মাপ ঠিক • কথা কম",
        cx - 8.1,
        3.2,
        cz - 13.5,
        3.9,
        0.8,
        -Math.PI / 2,
        "#355c69",
      );
    }
    if (id === "power-house") officeDetails(area);
  }

  // The original bus/rickshaw factories are authored from many curved parts.
  // Their local material batches retain the entire detailed silhouette, without
  // one draw call per spoke, grille bar or window trim in neighboring sectors.
  for (const vehicleRoot of vehicleRoots) {
    const position = vehicleRoot.position.clone(),
      rotation = vehicleRoot.rotation.clone();
    vehicleRoot.position.setAll(0);
    vehicleRoot.rotation.setAll(0);
    vehicleRoot.computeWorldMatrix(true);
    const bodyGroups = new Map<Material, Mesh[]>();
    for (const mesh of vehicleRoot.getChildMeshes()) {
      if (!(mesh instanceof Mesh) || !mesh.material) continue;
      mesh.computeWorldMatrix(true);
      const group = bodyGroups.get(mesh.material) ?? [];
      group.push(mesh);
      bodyGroups.set(mesh.material, group);
    }
    const vehicleCasters = new Set(shadow.getShadowMap()?.renderList ?? []);
    for (const [mat, meshes] of bodyGroups) {
      if (meshes.length < 2) continue;
      const merged = Mesh.MergeMeshes(
        meshes,
        false,
        true,
        undefined,
        false,
        false,
      );
      if (!merged) continue;
      merged.name = `${id}: vehicle body ${mat.name}`;
      merged.parent = vehicleRoot;
      merged.receiveShadows = true;
      merged.metadata = { sectorId: id, staticBatchExclude: true };
      if (meshes.some((m) => vehicleCasters.has(m)))
        shadow.addShadowCaster(merged);
      for (const mesh of meshes) {
        shadow.removeShadowCaster(mesh);
        mesh.dispose(false, false);
      }
    }
    vehicleRoot.position.copyFrom(position);
    vehicleRoot.rotation.copyFrom(rotation);
    vehicleRoot.computeWorldMatrix(true);
  }
  const cameraIds = new Set(cameraObstacles.map((o) => o.name));
  for (const obstacle of obstacles)
    if (!cameraIds.has(obstacle.id))
      cameraObstacles.push({
        name: obstacle.id,
        ...obstacle,
        y: 0.2 + obstacle.h / 2,
      });

  // Batching is strictly local to this ownership boundary. Moving vehicles keep
  // their roots/anchors; source camera bounds have already been captured.
  const groups = new Map<PBRMaterial, Mesh[]>();
  const casters = new Set(shadow.getShadowMap()?.renderList ?? []);
  for (const mesh of root.getChildMeshes()) {
    if (
      !(mesh instanceof Mesh) ||
      mesh.parent !== root ||
      !(mesh.material instanceof PBRMaterial)
    )
      continue;
    const group = groups.get(mesh.material) ?? [];
    group.push(mesh);
    groups.set(mesh.material, group);
  }
  for (const [mat, meshes] of groups) {
    if (meshes.length < 2) continue;
    for (const mesh of meshes) mesh.computeWorldMatrix(true);
    const merged = Mesh.MergeMeshes(
      meshes,
      false,
      true,
      undefined,
      false,
      false,
    );
    if (!merged) continue;
    merged.name = `${id}: batched ${mat.name}`;
    merged.parent = root;
    merged.receiveShadows = true;
    merged.metadata = { sectorId: id, staticBatchExclude: true };
    if (meshes.some((m) => casters.has(m))) shadow.addShadowCaster(merged);
    for (const mesh of meshes) {
      shadow.removeShadowCaster(mesh);
      mesh.dispose(false, false);
    }
  }
  const meshes = root
    .getChildMeshes()
    .filter((m): m is Mesh => m instanceof Mesh);
  const registeredCasters = new Set(shadow.getShadowMap()?.renderList ?? []);
  const sectorCasters = meshes.filter((mesh) => registeredCasters.has(mesh));
  for (const mesh of meshes) {
    mesh.metadata = {
      ...mesh.metadata,
      sectorId: id,
      staticBatchExclude: true,
    };
    mesh.freezeWorldMatrix();
  }
  const handle: SectorHandle = {
    id,
    root,
    meshes,
    obstacles,
    cameraObstacles,
    actorAnchors,
    pickupAnchors,
    teaShops,
    parkedVehicles,
    active: false,
    visible: false,
    shadows: false,
    own(dispose) {
      if (disposed) dispose();
      else cleanup.push(dispose);
    },
    setVisible(visible) {
      if (disposed) return;
      if (handle.visible === visible) return;
      handle.visible = visible;
      root.setEnabled(visible);
      if (!visible) handle.setShadows(false);
    },
    setActive(active) {
      handle.active = !disposed && active;
    },
    setShadows(enabled) {
      const next = !disposed && handle.visible && enabled;
      if (handle.shadows === next) return;
      handle.shadows = next;
      for (const mesh of sectorCasters)
        if (next) shadow.addShadowCaster(mesh);
        else shadow.removeShadowCaster(mesh);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      handle.active = false;
      handle.visible = false;
      handle.shadows = false;
      for (const release of cleanup.splice(0).reverse()) release();
      for (const mesh of meshes) shadow.removeShadowCaster(mesh);
      root.dispose(false, false);
    },
  };
  // Nearby encounter blocks receive dynamic shadows. Prefetched distant
  // architecture retains PBR lighting without filling the shadow pass with the
  // entire connected neighborhood; parked lights/AI remain independently owned.
  for (const mesh of sectorCasters) shadow.removeShadowCaster(mesh);
  root.setEnabled(false);
  return handle;
}

export class SectorManager {
  readonly allObstacles = allSectorObstacles;
  private readonly cache: SectorCache<SectorHandle>;
  private readonly resourceLease: ReturnType<typeof acquireSectorResources>;
  private disposed = false;
  private shadowDistance = 34;
  readonly scene: Scene;
  readonly shadow: ShadowGenerator;
  constructor(scene: Scene, shadow: ShadowGenerator) {
    this.scene = scene;
    this.shadow = shadow;
    this.resourceLease = acquireSectorResources(scene);
    const paletteBefore = new Set(scene.materials);
    const palette = createPalette(scene);
    for (const mat of scene.materials)
      if (!paletteBefore.has(mat)) {
        this.resourceLease.pool.register(
          mat,
          () => mat.dispose(false, false),
          true,
        );
        for (const tex of mat.getActiveTextures())
          this.resourceLease.pool.register(tex, () => tex.dispose(), true);
      }
    this.cache = new SectorCache(sectorRegions, (id) => {
      const beforeMaterials = new Set(scene.materials),
        beforeTextures = new Set(scene.textures);
      const handle = buildSector(scene, shadow, id, palette);
      const paletteTextures = new Set(
        scene.materials
          .filter((mat) => mat.name.startsWith("Outer Dhaka"))
          .flatMap((mat) => mat.getActiveTextures()),
      );
      // Capture only this synchronous factory's delta, never later character/UI
      // materials created by the main controller. Shared vehicle materials get
      // a real reference from every handle that uses them.
      for (const mat of scene.materials)
        if (!beforeMaterials.has(mat))
          this.resourceLease.pool.register(
            mat,
            () => mat.dispose(false, false),
            mat.name.startsWith("Outer Dhaka"),
          );
      for (const tex of scene.textures)
        if (!beforeTextures.has(tex))
          this.resourceLease.pool.register(
            tex,
            () => tex.dispose(),
            paletteTextures.has(tex),
          );
      const referenced = new Set<Material | BaseTexture>();
      for (const mesh of handle.meshes) {
        if (!mesh.material) continue;
        referenced.add(mesh.material);
        for (const tex of mesh.material.getActiveTextures())
          referenced.add(tex);
      }
      this.resourceLease.pool.retain(id, [...referenced]);
      const disposeHandle = handle.dispose;
      let released = false;
      handle.dispose = () => {
        if (released) return;
        released = true;
        disposeHandle();
        this.resourceLease.pool.release(id);
      };
      this.resourceLease.pool.sweep();
      return handle;
    });
  }
  get handles() {
    return [...this.cache.resources.values()];
  }
  setQuality(profile: {
    activeDistance: number;
    prefetchDistance: number;
    shadowDistance: number;
  }) {
    this.cache.options.active = profile.activeDistance;
    this.cache.options.activeUntil = profile.activeDistance + 6;
    this.cache.options.prefetch = profile.prefetchDistance;
    this.cache.options.visibleUntil = profile.prefetchDistance + 13;
    this.cache.options.release = profile.prefetchDistance + 29;
    if (this.shadowDistance !== profile.shadowDistance) {
      this.shadowDistance = profile.shadowDistance;
      // A lower preset must not inherit a higher preset's departure margin.
      for (const handle of this.handles) handle.setShadows(false);
    }
    this.updateShadows();
  }
  private updateShadows() {
    const distances = new Map(
      this.cache.status.map((status) => [status.id, status.distance]),
    );
    const encounterIds = new Set(
      sectorRegions
        .filter((region) => region.encounter)
        .map((region) => region.id),
    );
    const candidates = this.handles
      .filter(
        (handle) =>
          handle.visible &&
          encounterIds.has(handle.id) &&
          (distances.get(handle.id) ?? Infinity) <=
            this.shadowDistance + (handle.shadows ? 6 : 0),
      )
      .sort(
        (a, b) =>
          (distances.get(a.id) ?? Infinity) -
            (distances.get(b.id) ?? Infinity) || a.id.localeCompare(b.id),
      )
      .slice(0, 2);
    const shadowIds = new Set(candidates.map((handle) => handle.id));
    for (const handle of this.handles)
      handle.setShadows(shadowIds.has(handle.id));
  }
  get status(): SectorStatus[] {
    return this.cache.status;
  }
  get obstacles() {
    return this.handles.flatMap((h) => h.obstacles);
  }
  get cameraObstacles() {
    return this.handles.flatMap((h) => (h.visible ? h.cameraObstacles : []));
  }
  get actorAnchors() {
    return this.handles.flatMap((h) => h.actorAnchors);
  }
  get pickupAnchors() {
    return this.handles.flatMap((h) => h.pickupAnchors);
  }
  get teaShops() {
    return this.handles.flatMap((h) => h.teaShops);
  }
  get parkedVehicles() {
    return this.handles.flatMap((h) => h.parkedVehicles);
  }
  update(player: Point2, pinnedIds: readonly string[] = []): SectorChanges {
    const changes = this.cache.update(player, pinnedIds);
    this.updateShadows();
    return changes;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cache.dispose();
    this.resourceLease.release();
  }
  diagnostics() {
    return {
      status: this.status,
      loaded: this.handles.length,
      visible: this.handles.filter((h) => h.visible).length,
      active: this.handles.filter((h) => h.active).length,
      shadowed: this.handles.filter((h) => h.shadows).length,
      shadowDistance: this.shadowDistance,
      budgets: {
        active: this.cache.options.active,
        prefetch: this.cache.options.prefetch,
        visibleUntil: this.cache.options.visibleUntil,
        release: this.cache.options.release,
      },
      meshes: this.handles.reduce((sum, h) => sum + h.meshes.length, 0),
      ownedResources: this.resourceLease.pool.size,
      actorAnchors: this.handles
        .filter((h) => h.active)
        .reduce((sum, h) => sum + h.actorAnchors.length, 0),
    };
  }
}
