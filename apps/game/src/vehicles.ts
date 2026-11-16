import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "./engine";
import { material, surfaceMaterial, signTexture, texture } from "./art";
import type { BoardingPose, BoardingVehicle } from "./boarding";
import { rideGroundAnchor, rideProfiles, type RideKind, type RidePose } from "./driving";
import { playerCollisionRadius } from "@neta/shared";

export type ParkedVehicle = BoardingVehicle & {
  root: TransformNode;
  wheels?: TransformNode[];
  ride?: { kind: RideKind; size: { w: number; d: number; h: number }; home: RidePose };
  footprint: { x: number; z: number; w: number; d: number; h: number };
  anchors: {
    approach: TransformNode;
    entry: TransformNode;
    seat: TransformNode;
    exits: TransformNode[];
  };
};

/** Batch inside the vehicle, keeping it independent of the static street. The
 * detailed authored wheel/body shapes survive without hundreds of draw calls. */
function batchParkedBody(root: TransformNode, shadow: ShadowGenerator) {
  const position = root.position.clone(),
    angle = root.rotation.y,
    casters = new Set(shadow.getShadowMap()?.renderList ?? []),
    groups = new Map<PBRMaterial, Mesh[]>();
  root.position.setAll(0);
  root.rotation.y = 0;
  for (const child of root.getChildMeshes()) {
    child.metadata = { ...child.metadata, staticBatchExclude: true };
    if (child.metadata?.movingWheel) continue;
    if (!(child instanceof Mesh) || !(child.material instanceof PBRMaterial))
      continue;
    child.computeWorldMatrix(true);
    const group = groups.get(child.material) ?? [];
    group.push(child);
    groups.set(child.material, group);
  }
  for (const [mat, meshes] of groups) {
    if (meshes.length < 2) continue;
    const merged = Mesh.MergeMeshes(
      meshes,
      true,
      true,
      undefined,
      false,
      false,
    );
    if (!merged) continue;
    merged.name = `CNG body — ${mat.name}`;
    merged.parent = root;
    merged.receiveShadows = true;
    merged.metadata = { staticBatchExclude: true, vehicleId: "practice-cng" };
    if (meshes.some((m) => casters.has(m))) shadow.addShadowCaster(merged);
  }
  root.position.copyFrom(position);
  root.rotation.y = angle;
  root.computeWorldMatrix(true);
}

/** Metre-scaled original vehicle modelling, guided by the user's Dhaka photographs.
 * Real silhouettes, curved sheet-metal, open cabins and mechanical details; no photo billboards. */
function shared(
  scene: Scene,
  name: string,
  color: string,
  rough = 0.7,
  metal = 0,
) {
  return (
    (scene.getMaterialByName(name) as PBRMaterial) ||
    material(scene, name, color, rough, metal)
  );
}
function tools(
  scene: Scene,
  shadow: ShadowGenerator,
  name: string,
  position: Vector3,
  angle: number,
  movingWheels = false,
) {
  const root = new TransformNode(name, scene);
  root.position.copyFrom(position);
  root.rotation.y = angle;
  const wheels: TransformNode[] = [];
  const rubber = shared(scene, "Vehicle tire rubber", "#151b1b", 0.93),
    chrome = shared(scene, "Vehicle brushed steel", "#a9b5b4", 0.31, 0.82),
    iron = shared(scene, "Vehicle chassis iron", "#263331", 0.72, 0.55),
    black = shared(scene, "Vehicle black canvas", "#1d2525", 0.91);
  function finish(mesh: Mesh, m: PBRMaterial, cast = true) {
    mesh.parent = root;
    mesh.material = m;
    mesh.receiveShadows = true;
    if (cast) shadow.addShadowCaster(mesh);
    return mesh;
  }
  function rod(label: string, path: number[][], r: number, m = chrome) {
    return finish(
      MeshBuilder.CreateTube(
        label,
        {
          path: path.map((p) => Vector3.FromArray(p)),
          radius: r,
          tessellation: 8,
        },
        scene,
      ),
      m,
    );
  }
  function ball(
    label: string,
    p: number[],
    diameter: number,
    m: PBRMaterial,
    sx = 1,
    sy = 1,
    sz = 1,
  ) {
    const mesh = finish(
      MeshBuilder.CreateSphere(
        label,
        {
          diameterX: diameter * sx,
          diameterY: diameter * sy,
          diameterZ: diameter * sz,
          segments: 20,
        },
        scene,
      ),
      m,
    );
    mesh.position.copyFromFloats(p[0], p[1], p[2]);
    return mesh;
  }
  function panel(label: string, points: number[][], m: PBRMaterial) {
    const mesh = new Mesh(label, scene);
    mesh.setVerticesData("position", points.flat());
    const span = (axis: number) =>
      Math.max(...points.map((p) => p[axis])) -
      Math.min(...points.map((p) => p[axis]));
    const axis = span(0) > span(2) ? 0 : 2,
      minU = Math.min(...points.map((p) => p[axis])),
      minV = Math.min(...points.map((p) => p[1]));
    mesh.setVerticesData(
      "uv",
      points.flatMap((p) => [
        (p[axis] - minU) / (span(axis) || 1),
        (p[1] - minV) / (span(1) || 1),
      ]),
    );
    const indices = [];
    for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1);
    mesh.setIndices(indices);
    mesh.createNormals(true);
    m.backFaceCulling = false;
    m.twoSidedLighting = true;
    return finish(mesh, m);
  }
  function loft(
    label: string,
    sections: { z: number; half: number; bottom: number; top: number }[],
    m: PBRMaterial,
  ) {
    const pathArray = sections.map((s) =>
      Array.from({ length: 33 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2;
        return new Vector3(
          Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.26 * s.half,
          (s.top + s.bottom) / 2 +
            (Math.sign(Math.cos(a)) *
              Math.abs(Math.cos(a)) ** 0.26 *
              (s.top - s.bottom)) /
              2,
          s.z,
        );
      }),
    );
    const mesh = finish(
      MeshBuilder.CreateRibbon(
        label,
        { pathArray, sideOrientation: Mesh.DOUBLESIDE },
        scene,
      ),
      m,
    );
    for (const [i, section] of [
      sections[0],
      sections[sections.length - 1],
    ].entries()) {
      const points = pathArray[i === 0 ? 0 : pathArray.length - 1]
        .slice(0, -1)
        .map((v) => [v.x, v.y, section.z]);
      panel(`${label} end cap`, points, m);
    }
    return mesh;
  }
  function box(
    label: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: PBRMaterial,
  ) {
    const mesh = finish(
      MeshBuilder.CreateBox(label, { width: w, height: h, depth: d }, scene),
      m,
    );
    mesh.position.set(x, y, z);
    return mesh;
  }
  function wheel(x: number, z: number, r: number, bicycle = false) {
    const previous = movingWheels ? new Set(root.getChildMeshes()) : undefined;
    const thick = bicycle ? 0.045 : 0.115;
    const y = r;
    const tire = finish(
      MeshBuilder.CreateTorus(
        "Rounded tire casing",
        { diameter: r * 2 - thick, thickness: thick, tessellation: 40 },
        scene,
      ),
      rubber,
    );
    tire.rotation.z = Math.PI / 2;
    tire.position.set(x, y, z);
    const rim = finish(
      MeshBuilder.CreateTorus(
        "Wheel rim bead",
        {
          diameter: (r - thick) * 2,
          thickness: bicycle ? 0.022 : 0.035,
          tessellation: 32,
        },
        scene,
      ),
      chrome,
    );
    rim.rotation.z = Math.PI / 2;
    rim.position.copyFrom(tire.position);
    const hub = finish(
      MeshBuilder.CreateCylinder(
        "Axle and wheel hub",
        {
          height: bicycle ? 0.13 : 0.17,
          diameter: bicycle ? 0.065 : 0.115,
          tessellation: 16,
        },
        scene,
      ),
      iron,
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.copyFrom(tire.position);
    const spokes = bicycle ? 32 : 8;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      rod(
        bicycle ? "Tensioned bicycle spoke" : "Cast alloy wheel spoke",
        [
          [x, y, z],
          [x, y + Math.cos(a) * (r - thick), z + Math.sin(a) * (r - thick)],
        ],
        bicycle ? 0.0045 : 0.014,
        chrome,
      );
    }
    if (!bicycle)
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * Math.PI * 2,
          dy = Math.cos(a) * r,
          dz = Math.sin(a) * r;
        rod(
          "Tire tread siping",
          [
            [x - 0.045, y + dy, z + dz],
            [x + 0.045, y + dy, z + dz],
          ],
          0.007,
          iron,
        );
      }
    if (previous) {
      const wheelRoot = new TransformNode("Moving CNG wheel axle", scene);
      wheelRoot.parent = root;
      wheelRoot.position.set(x, y, z);
      wheelRoot.metadata = { movingWheel: true, staticBatchExclude: true };
      for (const child of root.getChildMeshes()) {
        if (previous.has(child)) continue;
        child.parent = wheelRoot;
        child.position.subtractInPlace(wheelRoot.position);
        child.metadata = {
          ...child.metadata,
          movingWheel: true,
          staticBatchExclude: true,
        };
      }
      const originalPosition = root.position.clone(),
        originalAngle = root.rotation.y;
      root.position.setAll(0);
      root.rotation.y = 0;
      wheelRoot.position.setAll(0);
      const wheelCasters = new Set(shadow.getShadowMap()?.renderList ?? []);
      const wheelGroups = new Map<PBRMaterial, Mesh[]>();
      for (const mesh of wheelRoot.getChildMeshes()) {
        if (!(mesh instanceof Mesh) || !(mesh.material instanceof PBRMaterial))
          continue;
        mesh.computeWorldMatrix(true);
        const group = wheelGroups.get(mesh.material) ?? [];
        group.push(mesh);
        wheelGroups.set(mesh.material, group);
      }
      for (const [mat, meshes] of wheelGroups) {
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
        merged.name = `Moving wheel ${mat.name}`;
        merged.parent = wheelRoot;
        merged.metadata = { movingWheel: true, staticBatchExclude: true };
        merged.receiveShadows = true;
        if (meshes.some((mesh) => wheelCasters.has(mesh)))
          shadow.addShadowCaster(merged);
        for (const mesh of meshes) {
          shadow.removeShadowCaster(mesh);
          mesh.dispose(false, false);
        }
      }
      wheelRoot.position.set(x, y, z);
      root.position.copyFrom(originalPosition);
      root.rotation.y = originalAngle;
      root.computeWorldMatrix(true);
      wheels.push(wheelRoot);
    }
  }
  function lettering(
    label: string,
    sub: string,
    p: number[],
    w: number,
    h: number,
    rotation: number,
    bg = "#184c3e",
  ) {
    const plane = MeshBuilder.CreatePlane(
      label,
      { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    plane.parent = root;
    plane.position.copyFromFloats(p[0], p[1], p[2]);
    plane.rotation.y = rotation;
    const m = new StandardMaterial(`${label} ink`, scene);
    m.diffuseTexture = signTexture(scene, label, sub, bg, "#eee3bc", 768, 192);
    m.specularColor = Color3.Black();
    plane.material = m;
    return plane;
  }
  return {
    root,
    wheels,
    rubber,
    chrome,
    iron,
    black,
    finish,
    rod,
    ball,
    panel,
    loft,
    box,
    wheel,
    lettering,
  };
}

function modelRickshaw(
  scene: Scene,
  shadow: ShadowGenerator,
  position: Vector3,
  angle: number,
  movingWheels = false,
) {
  const t = tools(
    scene,
    shadow,
    "Dhaka floral pedal rickshaw — v2",
    position,
    angle,
    movingWheels,
  );
  const { root, rod, box, wheel, ball, loft, chrome, iron } = t;
  const art = surfaceMaterial(
      scene,
      "Rickshaw hand-painted tin",
      "rickshaw-art",
      1,
      1,
    ),
    foil = shared(
      scene,
      "Rickshaw embossed silver foil",
      "#bbc1b9",
      0.35,
      0.88,
    ),
    gold = shared(scene, "Rickshaw brass and gold trim", "#c7a34e", 0.39, 0.7),
    red = shared(scene, "Rickshaw red vinyl upholstery", "#7d2030", 0.64),
    frame = shared(
      scene,
      "Rickshaw green painted tubes",
      "#315d48",
      0.48,
      0.35,
    );
  wheel(-0.62, -0.69, 0.4, true);
  wheel(0.62, -0.69, 0.4, true);
  wheel(0, 1.12, 0.4, true);
  rod(
    "Rickshaw rear axle",
    [
      [-0.71, 0.4, -0.69],
      [0.71, 0.4, -0.69],
    ],
    0.035,
    iron,
  );
  rod(
    "Bicycle down tube",
    [
      [0, 0.45, 0.21],
      [0, 0.81, 1.02],
    ],
    0.027,
    frame,
  );
  rod(
    "Bicycle seat tube",
    [
      [0, 0.43, 0.21],
      [0, 1.0, 0.34],
    ],
    0.026,
    frame,
  );
  rod(
    "Bicycle top tube",
    [
      [0, 1.0, 0.34],
      [0, 1.02, 0.96],
    ],
    0.025,
    frame,
  );
  for (const s of [-1, 1]) {
    rod(
      "Cycle chain stay",
      [
        [s * 0.05, 0.44, 0.21],
        [s * 0.58, 0.4, -0.69],
      ],
      0.023,
      frame,
    );
    rod(
      "Cycle seat stay",
      [
        [0, 0.96, 0.34],
        [s * 0.58, 0.4, -0.69],
      ],
      0.022,
      frame,
    );
    rod(
      "Fork steel leg",
      [
        [s * 0.055, 1.02, 0.98],
        [s * 0.055, 0.4, 1.12],
      ],
      0.02,
      chrome,
    );
  }
  rod(
    "Curved handlebar",
    [
      [-0.33, 1.1, 1.07],
      [-0.27, 1.2, 1.05],
      [0, 1.22, 1.01],
      [0.27, 1.2, 1.05],
      [0.33, 1.1, 1.07],
    ],
    0.022,
    chrome,
  );
  for (const s of [-1, 1])
    rod(
      "Rubber handle grip",
      [
        [s * 0.24, 1.2, 1.05],
        [s * 0.34, 1.12, 1.07],
      ],
      0.027,
      t.rubber,
    );
  loft(
    "Curved leather driver saddle",
    [
      { z: 0.22, half: 0.14, bottom: 0.96, top: 1.02 },
      { z: 0.38, half: 0.11, bottom: 0.97, top: 1.04 },
      { z: 0.53, half: 0.045, bottom: 0.98, top: 1.02 },
    ],
    t.black,
  );
  const crank = MeshBuilder.CreateTorus(
    "Crank chain wheel",
    { diameter: 0.23, thickness: 0.016, tessellation: 28 },
    scene,
  );
  t.finish(crank, chrome);
  crank.position.set(0.07, 0.45, 0.21);
  crank.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    rod(
      "Pedal crank arm",
      [
        [s * 0.08, 0.45, 0.21],
        [s * 0.12, 0.45 + s * 0.13, 0.21],
      ],
      0.015,
      chrome,
    );
    box(
      "Rubber pedal",
      s * 0.18,
      0.45 + s * 0.13,
      0.21,
      0.18,
      0.035,
      0.08,
      t.rubber,
    );
  }
  const chain = MeshBuilder.CreateTube(
    "Tensioned bicycle chain",
    {
      path: [
        new Vector3(0.075, 0.56, 0.22),
        new Vector3(0.075, 0.45, -0.69),
        new Vector3(0.075, 0.34, 0.22),
        new Vector3(0.075, 0.56, 0.22),
      ],
      radius: 0.01,
      tessellation: 5,
    },
    scene,
  );
  t.finish(chain, iron);
  loft(
    "Passenger tin body",
    [
      { z: -1.02, half: 0.62, bottom: 0.51, top: 0.7 },
      { z: -0.81, half: 0.63, bottom: 0.49, top: 0.7 },
      { z: -0.17, half: 0.6, bottom: 0.45, top: 0.64 },
    ],
    foil,
  );
  box("Passenger cushion", 0, 0.8, -0.63, 1.11, 0.2, 0.63, red);
  box("Padded passenger backrest", 0, 1.16, -0.91, 1.12, 0.63, 0.12, red);
  for (let i = -4; i <= 4; i++)
    rod(
      "Upholstery stitched channel",
      [
        [i * 0.115, 0.902, -0.9],
        [i * 0.115, 0.902, -0.34],
      ],
      0.004,
      gold,
    );
  box("Passenger foot plate", 0, 0.43, -0.04, 1.09, 0.055, 0.55, foil);
  for (let k = -4; k <= 4; k++)
    rod(
      "Footplate ridges",
      [
        [k * 0.115, 0.462, -0.3],
        [k * 0.115, 0.462, 0.21],
      ],
      0.006,
      chrome,
    );
  // Floral back and side tin panels have depth and their own protective metal edging.
  t.panel(
    "Rear painted floral panel",
    [
      [-0.62, 0.58, -1.035],
      [0.62, 0.58, -1.035],
      [0.62, 1.27, -1.035],
      [-0.62, 1.27, -1.035],
    ],
    art,
  );
  for (const s of [-1, 1]) {
    t.panel(
      "Painted rickshaw side panel",
      [
        [s * 0.64, 0.52, -1],
        [s * 0.64, 0.52, -0.25],
        [s * 0.64, 1.18, -0.32],
        [s * 0.64, 1.31, -0.99],
      ],
      art,
    );
    rod(
      "Seat guard rail",
      [
        [s * 0.63, 0.5, 0.15],
        [s * 0.63, 1.12, -0.1],
        [s * 0.64, 1.35, -0.83],
      ],
      0.022,
      gold,
    );
    rod(
      "Canopy upright",
      [
        [s * 0.62, 0.57, -0.98],
        [s * 0.65, 1.45, -1.02],
        [s * 0.55, 1.98, -0.78],
      ],
      0.022,
      chrome,
    );
  }
  const paths = [];
  for (let z = -1.08; z <= 0.26; z += 0.075) {
    const path = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI;
      path.push(new Vector3(Math.cos(a) * 0.68, 1.43 + Math.sin(a) * 0.63, z));
    }
    paths.push(path);
  }
  const hood = MeshBuilder.CreateRibbon(
    "Deep arched painted rickshaw hood",
    { pathArray: paths, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  t.finish(hood, art);
  rod(
    "Canopy bound edge",
    paths[paths.length - 1].map((p) => [p.x, p.y, p.z]),
    0.018,
    gold,
  );
  for (let i = 1; i < 24; i++) {
    const a = (i / 24) * Math.PI,
      x = Math.cos(a) * 0.68,
      y = 1.43 + Math.sin(a) * 0.63;
    ball("Rickshaw canopy bead", [x, y, 0.285], 0.036, i % 2 ? gold : foil);
    rod(
      "Decorative canopy fringe",
      [
        [x, y - 0.025, 0.285],
        [x, y - 0.07 - (i % 3) * 0.017, 0.285],
      ],
      0.008,
      i % 2 ? red : gold,
    );
  }
  for (const s of [-1, 1]) {
    const path = [];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI;
      path.push([
        s * 0.65,
        0.4 + Math.sin(a) * 0.45,
        -0.69 + Math.cos(a) * 0.45,
      ]);
    }
    rod("Rear wheel mudguard edge", path, 0.023, foil);
  }
  t.lettering(
    "ঢাকার রং",
    "প্রতিশ্রুতি মোড়",
    [0, 0.7, -1.049],
    0.86,
    0.2,
    0,
    "#173d70",
  );
  return { root, wheels: t.wheels };
}

export function createRickshaw(scene: Scene, shadow: ShadowGenerator, position: Vector3, angle: number) {
  return modelRickshaw(scene, shadow, position, angle).root;
}

export function createCNG(
  scene: Scene,
  shadow: ShadowGenerator,
  position: Vector3,
  angle: number,
  options: { movingWheels?: boolean; drivable?: boolean } = {},
): ParkedVehicle {
  const t = tools(
    scene,
    shadow,
    "Dhaka green CNG — v2",
    position,
    angle,
    options.movingWheels,
  );
  const { root, rod, box, wheel, ball, loft, chrome, iron, black } = t;
  const green = surfaceMaterial(
      scene,
      "CNG weathered green enamel",
      "cng-enamel",
      1.6,
      1.2,
    ),
    seat = shared(scene, "CNG dark leather seat", "#262e29", 0.7),
    lamp = shared(scene, "Vehicle headlight lens", "#e3ddd0", 0.18, 0.12);
  green.clearCoat.isEnabled = true;
  green.clearCoat.intensity = 0.55;
  green.clearCoat.roughness = 0.24;
  const glass = shared(
    scene,
    "CNG laminated windshield",
    "#c9e5e4",
    0.09,
    0.06,
  );
  glass.alpha = 0.28;
  glass.backFaceCulling = false;
  wheel(-0.59, -0.73, 0.285);
  wheel(0.59, -0.73, 0.285);
  wheel(0, 1.02, 0.285);
  loft(
    "Curved rear CNG monocoque",
    [
      { z: -1.13, half: 0.59, bottom: 0.36, top: 0.66 },
      { z: -0.98, half: 0.67, bottom: 0.34, top: 0.66 },
      { z: -0.46, half: 0.68, bottom: 0.35, top: 0.64 },
    ],
    green,
  );
  box("CNG rear metal back wall", 0, 0.95, -1.105, 1.19, 0.72, 0.07, green);
  for (const s of [-1, 1])
    t.panel(
      "CNG rear quarter side metal",
      [
        [s * 0.67, 0.6, -1.03],
        [s * 0.67, 0.6, -0.4],
        [s * 0.67, 1.06, -0.46],
        [s * 0.67, 1.24, -1.03],
      ],
      green,
    );
  box("CNG internal floor", 0, 0.4, -0.04, 1.15, 0.09, 1.8, iron);
  box("CNG rear seat cushion", 0, 0.78, -0.69, 1.1, 0.16, 0.51, seat);
  box("CNG rear padded back", 0, 1.06, -1.01, 1.1, 0.5, 0.11, seat);
  for (let i = -4; i <= 4; i++)
    rod(
      "Seat cushion stitching",
      [
        [i * 0.115, 0.866, -0.91],
        [i * 0.115, 0.866, -0.48],
      ],
      0.0035,
      iron,
    );
  loft(
    "CNG driver seat",
    [
      { z: 0.19, half: 0.24, bottom: 0.7, top: 0.83 },
      { z: 0.47, half: 0.22, bottom: 0.72, top: 0.85 },
      { z: 0.58, half: 0.17, bottom: 0.73, top: 0.82 },
    ],
    seat,
  );
  box("Driver back cushion", 0, 1.03, 0.16, 0.43, 0.4, 0.1, seat);
  const nose = [];
  for (const [y, w, depth, zc] of [
    [0.42, 0.35, 0.17, 0.94],
    [0.57, 0.59, 0.21, 0.93],
    [0.84, 0.59, 0.2, 0.88],
    [1.02, 0.53, 0.13, 0.88],
  ]) {
    const path = [];
    for (let i = 0; i <= 24; i++) {
      const a = -Math.PI / 2 + (i / 24) * Math.PI;
      path.push(new Vector3(Math.sin(a) * w, y, zc + Math.cos(a) * depth));
    }
    nose.push(path);
  }
  t.finish(
    MeshBuilder.CreateRibbon(
      "Pressed curved CNG front sheet metal",
      { pathArray: nose, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    ),
    green,
  );
  t.panel(
    "Matte black CNG headlight fascia",
    [
      [-0.51, 0.64, 1.113],
      [0.51, 0.64, 1.113],
      [0.51, 0.95, 1.083],
      [-0.51, 0.95, 1.083],
    ],
    black,
  );
  for (const s of [-1, 1]) {
    const bezel = MeshBuilder.CreateTorus(
      "Headlamp chrome bezel",
      { diameter: 0.204, thickness: 0.018, tessellation: 32 },
      scene,
    );
    t.finish(bezel, chrome);
    bezel.position.set(s * 0.345, 0.823, 1.135);
    bezel.rotation.x = Math.PI / 2;
    ball(
      "Ribbed headlamp glass",
      [s * 0.345, 0.823, 1.143],
      0.18,
      lamp,
      1,
      1,
      0.24,
    );
    box(
      "Amber CNG indicator",
      s * 0.49,
      1.055,
      0.98,
      0.1,
      0.045,
      0.04,
      shared(scene, "Amber indicator glass", "#c37e29", 0.22),
    );
  }
  for (let k = -3; k <= 3; k++)
    box(
      "CNG front ventilation slit",
      k * 0.035,
      0.74,
      1.139,
      0.014,
      0.07,
      0.015,
      iron,
    );
  // Split windscreen follows the sloping front frame, with real thin glass rather than a solid block.
  t.panel(
    "CNG angled windshield",
    [
      [-0.51, 1.04, 1.01],
      [0.51, 1.04, 1.01],
      [0.54, 1.63, 0.75],
      [-0.54, 1.63, 0.75],
    ],
    glass,
  );
  rod(
    "Windscreen rubber gasket",
    [
      [-0.51, 1.04, 1.02],
      [-0.54, 1.63, 0.76],
      [0.54, 1.63, 0.76],
      [0.51, 1.04, 1.02],
      [-0.51, 1.04, 1.02],
    ],
    0.022,
    black,
  );
  rod(
    "Windscreen wiper",
    [
      [0.1, 1.07, 1.035],
      [-0.14, 1.4, 0.9],
    ],
    0.008,
    iron,
  );
  rod(
    "Wiper blade",
    [
      [-0.22, 1.36, 0.91],
      [-0.07, 1.47, 0.86],
    ],
    0.013,
    black,
  );
  for (const s of [-1, 1]) {
    rod(
      "CNG structural cabin frame",
      [
        [s * 0.64, 0.42, -1.04],
        [s * 0.66, 1.5, -1.05],
        [s * 0.62, 1.78, -0.84],
        [s * 0.58, 1.78, 0.56],
        [s * 0.52, 1.04, 1.01],
      ],
      0.027,
      iron,
    );
    rod(
      "Passenger safety side rail",
      [
        [s * 0.65, 0.54, -1.03],
        [s * 0.65, 1.04, -0.91],
        [s * 0.65, 1.04, -0.25],
        [s * 0.65, 0.54, -0.23],
      ],
      0.025,
      chrome,
    );
    rod(
      "Passenger entry lower step",
      [
        [s * 0.67, 0.38, -0.37],
        [s * 0.77, 0.38, 0.38],
      ],
      0.025,
      chrome,
    );
    rod(
      "Wing mirror stem",
      [
        [s * 0.55, 1.35, 0.86],
        [s * 0.78, 1.37, 0.89],
      ],
      0.013,
      iron,
    );
    ball("CNG wing mirror", [s * 0.8, 1.38, 0.89], 0.13, chrome, 0.7, 1, 0.18);
  }
  const hood = [];
  for (let z = -1.15; z <= 0.86; z += 0.1) {
    const path = [];
    for (let i = 0; i <= 20; i++) {
      const x = -0.7 + (i / 20) * 1.4;
      path.push(
        new Vector3(
          x,
          1.64 +
            Math.sin((i / 20) * Math.PI) * 0.2 -
            (z > 0.5 ? (z - 0.5) * 0.34 : 0),
          z,
        ),
      );
    }
    hood.push(path);
  }
  t.finish(
    MeshBuilder.CreateRibbon(
      "Tensioned black CNG canvas roof",
      { pathArray: hood, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    ),
    black,
  );
  for (const z of [-1.08, -0.5, 0.2])
    rod(
      "Canvas roof stitched bow",
      hood[Math.min(hood.length - 1, Math.round((z + 1.15) / 0.1))].map((p) => [
        p.x,
        p.y + 0.008,
        p.z,
      ]),
      0.008,
      iron,
    );
  const fender = [];
  for (const x of [-0.13, 0.13]) {
    const path = [];
    for (let i = 0; i <= 18; i++) {
      const a = 0.08 + (i / 18) * (Math.PI - 0.16);
      path.push(
        new Vector3(x, 0.285 + Math.sin(a) * 0.34, 1.02 + Math.cos(a) * 0.34),
      );
    }
    fender.push(path);
  }
  t.finish(
    MeshBuilder.CreateRibbon(
      "Curved front wheel mudguard",
      { pathArray: fender, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    ),
    green,
  );
  for (const s of [-1, 1])
    rod(
      "Front suspension fork",
      [
        [s * 0.065, 0.29, 1.02],
        [s * 0.065, 0.77, 0.94],
      ],
      0.023,
      chrome,
    );
  rod(
    "CNG front bumper",
    [
      [-0.55, 0.44, 1.11],
      [-0.48, 0.39, 1.2],
      [0.48, 0.39, 1.2],
      [0.55, 0.44, 1.11],
    ],
    0.028,
    chrome,
  );
  rod(
    "Driver handlebar",
    [
      [-0.26, 1.12, 0.72],
      [0, 1.17, 0.69],
      [0.26, 1.12, 0.72],
    ],
    0.017,
    iron,
  );
  for (let k = 0; k < 7; k++)
    box(
      "Rear engine cooling grille",
      -0.3 + k * 0.1,
      0.88,
      -1.148,
      0.035,
      0.27,
      0.02,
      black,
    );
  t.lettering(
    "ঢাকা • কল্প",
    "০১–২৩৪৫",
    [0, 0.52, 1.16],
    0.44,
    0.18,
    Math.PI,
    "#e1dfc5",
  );
  t.lettering(
    "সিএনজি",
    "নিরাপদ যাত্রা",
    [-0.687, 0.7, -0.7],
    0.45,
    0.2,
    Math.PI / 2,
    "#236b47",
  );
  batchParkedBody(root, shadow);
  const anchor = (name: string, x: number, y: number, z: number, yaw = 0) => {
      const node = new TransformNode(`CNG ${name}`, scene);
      node.parent = root;
      node.position.set(x, y, z);
      node.rotation.y = yaw;
      return node;
    },
    // Use the actual open side doorway, ahead of the rear quarter safety rail.
    approach = anchor("safe approach", 1.38, 0, 0.08, -Math.PI / 2),
    entry = anchor("doorway step", 0.76, 0.08, 0.08, -Math.PI / 2),
    inside = anchor("inside doorway", 0.25, 0.28, options.drivable ? 0.21 : -0.18, -0.45),
    // The authored Seated clip lowers the pelvis to .56; .34 + .56 = .90,
    // placing the hips just above the .86 cushion, with feet on the .40 floor.
    seatAnchor = options.drivable
      ? anchor("driver position", 0, 0.31, 0.38)
      : anchor("rear practice seat", 0, 0.34, -0.67),
    frontExit = anchor("alternate safe exit", 1.38, 0, 0.55, -Math.PI / 2),
    otherInside = anchor("opposite inside doorway", -0.25, 0.28, -0.18, 0.45),
    otherEntry = anchor(
      "opposite doorway step",
      -0.76,
      0.08,
      0.08,
      Math.PI / 2,
    ),
    otherExit = anchor("opposite safe exit", -1.38, 0, 0.08, Math.PI / 2),
    pose = (node: TransformNode): BoardingPose => {
      const p = Vector3.TransformCoordinates(
        Vector3.Zero(),
        node.computeWorldMatrix(true),
      );
      return { x: p.x, y: p.y, z: p.z, yaw: root.rotation.y + node.rotation.y };
    };
  const footprint = { x: position.x, z: position.z, w: 1.6, d: 2.9, h: 1.9 };
  const ground = (node: TransformNode) => options.drivable ? rideGroundAnchor(pose(node), footprint, playerCollisionRadius) : pose(node);
  return {
    id: "practice-cng",
    name: "সবুজ সিএনজি",
    root,
    wheels: t.wheels,
    ride: options.drivable ? {
      kind: "cng", size: { w: 1.6, d: 2.9, h: 1.9 },
      home: { x: position.x, y: position.y, z: position.z, yaw: angle },
    } : undefined,
    footprint,
    occupied: false,
    anchors: {
      approach,
      entry,
      seat: seatAnchor,
      exits: [approach, frontExit, otherExit],
    },
    approachPose: () => ground(approach),
    entryPose: () => pose(entry),
    seatPose: () => pose(seatAnchor),
    exitPoses: () => [approach, frontExit, otherExit].map(ground),
    entryPath: () => [ground(approach), ...[entry, inside, seatAnchor].map(pose)],
    exitPaths: () => [
      [...[seatAnchor, inside, entry].map(pose), ground(approach)],
      [...[seatAnchor, inside, entry].map(pose), ground(frontExit)],
      [...[seatAnchor, otherInside, otherEntry].map(pose), ground(otherExit)],
    ],
  };
}

function cycleVehicle(
  kind: Exclude<RideKind, "cng">,
  scene: Scene,
  shadow: ShadowGenerator,
  model: { root: TransformNode; wheels: TransformNode[] },
  size: { w: number; d: number; h: number },
  seatY: number,
  seatZ: number,
): ParkedVehicle {
  const { root, wheels } = model;
  batchParkedBody(root, shadow);
  const { x, y, z } = root.position;
  const anchor = (name: string, x: number, y: number, z: number, yaw: number) => {
    const node = new TransformNode(name, scene);
    node.parent = root;
    node.position.set(x, y, z);
    node.rotation.y = yaw;
    return node;
  };
  const side = size.w / 2 + 0.47;
  const approach = anchor("Mount on right", side, 0, seatZ, -Math.PI / 2);
  const entry = anchor("Clear side step", side * 0.55, 0.13, seatZ, -0.4);
  const seat = anchor("Rider position", 0, seatY, seatZ, 0);
  const alternate = anchor("Mount on left", -side, 0, seatZ, Math.PI / 2);
  const left = anchor("Opposite side step", -side * 0.55, 0.13, seatZ, 0.4);
  const pose = (node: TransformNode): BoardingPose => {
    const p = Vector3.TransformCoordinates(Vector3.Zero(), node.computeWorldMatrix(true));
    return { x: p.x, y: p.y, z: p.z, yaw: root.rotation.y + node.rotation.y };
  };
  const footprint = { x, z, ...size };
  const ground = (node: TransformNode) => rideGroundAnchor(pose(node), footprint, playerCollisionRadius);
  return {
    id: `hub:${kind}`, name: rideProfiles[kind].label, root, wheels,
    footprint, occupied: false,
    ride: { kind, size, home: { x, y, z, yaw: root.rotation.y } },
    anchors: { approach, entry, seat, exits: [approach, alternate] },
    approachPose: () => ground(approach),
    entryPose: () => pose(entry),
    seatPose: () => pose(seat),
    exitPoses: () => [approach, alternate].map(ground),
    entryPath: () => [ground(approach), pose(entry), pose(seat)],
    entryPaths: () => [[ground(approach), pose(entry), pose(seat)], [ground(alternate), pose(left), pose(seat)]],
    exitPaths: () => [[pose(seat), pose(entry), ground(approach)], [pose(seat), pose(left), ground(alternate)]],
  };
}

export function createRideRickshaw(scene: Scene, shadow: ShadowGenerator, position: Vector3, angle: number) {
  return cycleVehicle("rickshaw", scene, shadow, modelRickshaw(scene, shadow, position, angle, true),
    { w: 1.62, d: 2.9, h: 2 }, 0.37, 0.37);
}

export function createBicycle(scene: Scene, shadow: ShadowGenerator, position: Vector3, angle: number) {
  const t = tools(scene, shadow, "Dhaka roadster bicycle", position, angle, true);
  const paint = shared(scene, "Roadster worn teal enamel", "#274e50", 0.52, 0.34);
  t.wheel(0, -0.62, 0.35, true);
  t.wheel(0, 0.74, 0.35, true);
  const joints = { saddle: [0, 0.96, -0.28], crank: [0, 0.39, -0.11], head: [0, 0.85, 0.53], rear: [0, 0.35, -0.62] };
  for (const [a, b] of [[joints.saddle, joints.crank], [joints.head, joints.crank], [joints.saddle, joints.head]])
    t.rod("Lugged roadster frame", [a, b], 0.029, paint);
  for (const sign of [-1, 1]) {
    t.rod("Rear frame stays", [joints.saddle, [sign * 0.072, ...joints.rear.slice(1)], joints.crank], 0.014, paint);
    t.rod("Raked front fork", [joints.head, [sign * 0.07, 0.62, 0.64], [sign * 0.075, 0.35, 0.74]], 0.018, paint);
    t.box("Treaded pedal", sign * 0.16, 0.39 + sign * 0.085, -0.11, 0.12, 0.025, 0.09, t.black);
    t.rod("Pedal crank", [[0, 0.39, -0.11], [sign * 0.16, 0.39 + sign * 0.085, -0.11]], 0.012);
  }
  t.rod("Chain guard edge", [[0.075, 0.47, -0.08], [0.075, 0.39, -0.62], [0.075, 0.31, -0.08]], 0.016, t.iron);
  t.ball("Sprung leather saddle", [0, 0.99, -0.3], 0.29, t.black, 0.61, 0.20, 1);
  t.rod("Swept chrome handlebar", [[-0.31, 1.06, 0.49], [-0.17, 1.11, 0.66], [0, 1.03, 0.64],
    [0.17, 1.11, 0.66], [0.31, 1.06, 0.49]], 0.015);
  t.rod("Steering stem", [joints.head, [0, 1.03, 0.64]], 0.023);
  for (const sign of [-1, 1])
    t.rod("Ribbed handlebar grip", [[sign * 0.23, 1.08, 0.55], [sign * 0.32, 1.06, 0.48]], 0.024, t.black);
  for (const axle of [-0.62, 0.74]) {
    const arch = Array.from({ length: 19 }, (_, i) => [0, 0.35 + Math.sin(i * Math.PI / 18) * 0.376, axle + Math.cos(i * Math.PI / 18) * 0.376]);
    t.rod("Curved enamel mudguard", arch, 0.028, paint);
  }
  t.ball("Rear red reflector", [0, 0.58, -0.98], 0.09, shared(scene, "Roadster red glass", "#8b242b", 0.29), 1, 0.7, 0.35);
  return cycleVehicle("bicycle", scene, shadow, t, { w: 0.75, d: 2.18, h: 1.65 }, 0.42, -0.30);
}

export function createBatteryAuto(scene: Scene, shadow: ShadowGenerator, position: Vector3, angle: number) {
  const t = tools(scene, shadow, "Dhaka battery autorickshaw", position, angle, true);
  const body = shared(scene, "Auto burgundy enamel", "#773d42", 0.49, 0.42);
  const fabric = shared(scene, "Auto ochre canopy", "#9a7038", 0.83);
  const accent = shared(scene, "Auto ivory pinstripe", "#cdbb82", 0.53);
  t.wheel(-0.58, -0.67, 0.32);
  t.wheel(0.58, -0.67, 0.32);
  t.wheel(0, 0.99, 0.32);
  t.loft("Rounded battery compartment and footboard", [
    { z: -1.15, half: 0.64, bottom: 0.29, top: 0.51 },
    { z: -0.65, half: 0.67, bottom: 0.26, top: 0.52 },
    { z: 0.52, half: 0.39, bottom: 0.3, top: 0.47 },
  ], body);
  t.loft("Weatherproof stitched canopy", [
    { z: -1.12, half: 0.66, bottom: 1.66, top: 1.83 },
    { z: -0.35, half: 0.67, bottom: 1.69, top: 1.89 },
    { z: 0.52, half: 0.44, bottom: 1.62, top: 1.82 },
  ], fabric);
  t.box("Rear upholstered bench", 0, 0.72, -0.73, 1.2, 0.16, 0.56, t.black);
  t.box("Rear padded back", 0, 1.03, -1.04, 1.2, 0.49, 0.13, t.black);
  t.ball("Driver saddle", [0, 0.86, 0.25], 0.35, t.black, 1, 0.35, 1.2);
  for (const s of [-1, 1]) {
    t.rod("Canopy stanchions", [[s * 0.66, 0.53, -1.06], [s * 0.64, 1.74, -1.06],
      [s * 0.44, 1.72, 0.47], [s * 0.38, 0.52, 0.47]], 0.026);
    t.rod("Passenger side rails", [[s * 0.66, 0.7, -1.05], [s * 0.67, 0.72, -0.32]], 0.025);
    t.box("Painted side trim", s * 0.652, 0.53, -0.8, 0.027, 0.044, 0.67, accent);
  }
  t.rod("Front steering fork", [[0, 0.32, 0.99], [0, 0.75, 0.83], [0, 1.14, 0.72]], 0.033);
  t.rod("Auto handlebar", [[-0.32, 1.17, 0.64], [0, 1.14, 0.74], [0.32, 1.17, 0.64]], 0.023);
  t.ball("Round ivory headlamp", [0, 0.92, 0.91], 0.19, accent, 1, 1, 0.49);
  t.lettering("ব্যাটারির অটো", "ঢাকা • কল্প", [0, 0.61, -1.163], 0.72, 0.17, 0, "#6d343f");
  return cycleVehicle("auto", scene, shadow, t, { w: 1.57, d: 2.79, h: 1.92 }, 0.30, 0.25);
}

export function createBus(
  scene: Scene,
  shadow: ShadowGenerator,
  position: Vector3,
  angle: number,
) {
  const t = tools(
    scene,
    shadow,
    "Weathered Dhaka local bus — v2",
    position,
    angle,
  );
  const { root, box, loft, rod, wheel, chrome, black } = t;
  const pink = material(scene, "Bus worn magenta paint", "#84485e", 0.64, 0.16),
    blue = shared(scene, "Bus dark blue stripe", "#183d54", 0.55, 0.12),
    cream = shared(scene, "Bus aged cream trim", "#b9b497", 0.69, 0.1),
    window = shared(scene, "Bus smoked glass", "#233f48", 0.16, 0.12),
    seat = shared(scene, "Bus passenger seats", "#6d5142", 0.88);
  pink.albedoTexture = texture(
    scene,
    "Original bus paint wear",
    512,
    256,
    (c) => {
      c.fillStyle = "#e9dcd3";
      c.fillRect(0, 0, 512, 256);
      let s = 88;
      for (let i = 0; i < 2600; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        const x = s % 512;
        s = (s * 1664525 + 1013904223) >>> 0;
        const y = s % 256;
        c.fillStyle = i % 4 ? "#f5e5d822" : "#4a49444a";
        c.fillRect(x, y, (i % 9) + 1, 1 + (i % 3));
      }
      for (let i = 0; i < 15; i++) {
        c.fillStyle = "#d8cbb088";
        c.fillRect(i * 37, 120 + (i % 3) * 3, 24, 2);
      }
    },
  );
  window.alpha = 0.72;
  window.backFaceCulling = false;
  loft(
    "Rounded coach shell",
    [
      { z: -4.15, half: 1.12, bottom: 0.47, top: 2.99 },
      { z: -3.94, half: 1.25, bottom: 0.43, top: 3.12 },
      { z: 3.25, half: 1.25, bottom: 0.43, top: 3.12 },
      { z: 3.96, half: 1.08, bottom: 0.49, top: 2.97 },
    ],
    pink,
  );
  for (const side of [-1, 1]) {
    box(
      "Long blue bus livery stripe",
      side * 1.255,
      1.32,
      -0.1,
      0.018,
      0.22,
      7.7,
      blue,
    );
    box(
      "Bus cream waist rail",
      side * 1.268,
      1.48,
      -0.1,
      0.021,
      0.055,
      7.71,
      cream,
    );
    box(
      "Bus lower rub rail",
      side * 1.265,
      0.62,
      -0.1,
      0.023,
      0.065,
      7.7,
      black,
    );
    for (let i = 0; i < 9; i++) {
      const z = -3.44 + i * 0.78;
      box(
        "Bus window rubber surround",
        side * 1.255,
        2.18,
        z,
        0.027,
        1.1,
        0.73,
        black,
      );
      box(
        "Recessed coach window glass",
        side * 1.275,
        2.2,
        z,
        0.015,
        0.99,
        0.65,
        window,
      );
      box(
        "Sliding window centre frame",
        side * 1.289,
        2.2,
        z,
        0.018,
        0.99,
        0.02,
        chrome,
      );
      box("Bus side seat back", side * 0.76, 1.78, z, 0.55, 0.59, 0.12, seat);
    }
    for (const z of [-2.72, 2.45]) wheel(side * 1.23, z, 0.48);
    for (const z of [-2.72, 2.45]) {
      const arch = [];
      for (let i = 0; i <= 20; i++) {
        const a = (i / 20) * Math.PI;
        arch.push([
          side * 1.28,
          0.48 + Math.sin(a) * 0.55,
          z + Math.cos(a) * 0.55,
        ]);
      }
      rod("Bus wheel arch lip", arch, 0.032, cream);
    }
    for (let k = 0; k < 5; k++)
      box(
        "Bus luggage panel joint",
        side * 1.274,
        0.94,
        -2.8 + k * 1.25,
        0.012,
        0.45,
        0.015,
        black,
      );
  }
  t.panel(
    "Dark recessed bus cockpit",
    [
      [-1.05, 1.68, 3.973],
      [1.05, 1.68, 3.973],
      [1.02, 2.76, 3.973],
      [-1.02, 2.76, 3.973],
    ],
    black,
  );
  t.panel(
    "Coach windscreen",
    [
      [-1.05, 1.68, 3.985],
      [1.05, 1.68, 3.985],
      [1.02, 2.76, 3.985],
      [-1.02, 2.76, 3.985],
    ],
    window,
  );
  rod(
    "Front windscreen frame",
    [
      [-1.07, 1.66, 4.01],
      [-1.07, 2.78, 4.01],
      [1.07, 2.78, 4.01],
      [1.07, 1.66, 4.01],
      [-1.07, 1.66, 4.01],
    ],
    0.025,
    black,
  );
  rod(
    "Bus divided windshield",
    [
      [0, 1.68, 4.02],
      [0, 2.77, 4.02],
    ],
    0.02,
    chrome,
  );
  for (const s of [-1, 1]) {
    rod(
      "Bus windscreen wiper",
      [
        [s * 0.7, 1.69, 4.04],
        [s * 0.38, 2.29, 4.04],
      ],
      0.012,
      black,
    );
    rod(
      "Bus wing mirror arm",
      [
        [s * 1.02, 2.58, 3.76],
        [s * 1.48, 2.58, 3.84],
      ],
      0.025,
      chrome,
    );
    box("Bus side mirror", s * 1.49, 2.46, 3.84, 0.16, 0.43, 0.07, black);
    box(
      "Bus front headlight cluster",
      s * 0.8,
      0.96,
      3.99,
      0.36,
      0.18,
      0.05,
      cream,
    );
    box(
      "Bus amber turn indicator",
      s * 0.96,
      1.22,
      3.98,
      0.14,
      0.07,
      0.045,
      shared(scene, "Bus amber lamp", "#d7a34d", 0.21),
    );
  }
  box("Coach front grille", 0, 0.94, 4.0, 0.91, 0.32, 0.025, black);
  for (let i = -4; i <= 4; i++)
    box(
      "Coach grille slats",
      i * 0.094,
      0.94,
      4.025,
      0.025,
      0.29,
      0.015,
      chrome,
    );
  box("Bus front bumper", 0, 0.56, 4.01, 2.11, 0.16, 0.16, cream);
  for (let i = 0; i < 7; i++)
    loft(
      "Bus roof ventilation cap",
      [
        { z: -2.9 + i * 0.72, half: 0.26, bottom: 3.105, top: 3.23 },
        { z: -2.57 + i * 0.72, half: 0.25, bottom: 3.11, top: 3.22 },
      ],
      cream,
    );
  t.lettering(
    "নতুন সকাল",
    "প্রতিশ্রুতি মোড়",
    [0, 2.89, 4.015],
    1.88,
    0.28,
    Math.PI,
    "#293e54",
  );
  t.lettering(
    "ঢাকা • কল্প",
    "১১–৭৬৫৪",
    [0, 0.68, 4.11],
    0.51,
    0.18,
    Math.PI,
    "#e1dfc5",
  );
  t.lettering(
    "নতুন সকাল পরিবহন",
    "ধীরে চলুন, নিরাপদে ফিরুন",
    [-1.286, 1.32, -0.2],
    4.4,
    0.27,
    Math.PI / 2,
    "#173f58",
  );
  return root;
}
