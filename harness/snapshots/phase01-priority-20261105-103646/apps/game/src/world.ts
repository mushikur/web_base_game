import {
  createRickshaw,
  createCNG,
  createBus,
  type ParkedVehicle,
} from "./vehicles";
import { addDhakaDetails } from "./sceneDetails";
import { cameraBounds, type CameraObstacle } from "./cameraCollision";
import { streetPuddles, surfacePatches } from "@neta/shared";
import {
  AbstractMesh,
  Color3,
  Color4,
  Curve3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "./engine";
import {
  hex,
  material,
  random,
  signTexture,
  weathered,
  texture,
  surfaceMaterial,
} from "./art";
export type Obstacle = {
  x: number;
  z: number;
  w: number;
  d: number;
  h?: number;
};
export type World = {
  obstacles: Obstacle[];
  cameraObstacles: CameraObstacle[];
  vehicles: ParkedVehicle[];
  lamps: Mesh[];
  buildings: Mesh[];
  shadow: ShadowGenerator;
};
export function createWorld(scene: Scene, shadow: ShadowGenerator): World {
  const obstacles: Obstacle[] = [],
    cameraObstacles: CameraObstacle[] = [],
    lamps: Mesh[] = [],
    buildings: Mesh[] = [];
  const asphalt = surfaceMaterial(
      scene,
      "Photographic Dhaka asphalt",
      "asphalt",
      34,
      52,
    ),
    concrete = weathered(scene, "Old pavement", "#ac9f85"),
    cream = surfaceMaterial(
      scene,
      "Photographic lime plaster",
      "plaster",
      1,
      2,
      "#ede9df",
    ),
    ochre = surfaceMaterial(
      scene,
      "Ochre aged plaster",
      "plaster",
      1,
      2,
      "#c7b18b",
    ),
    teal = surfaceMaterial(
      scene,
      "Faded green plaster",
      "plaster",
      1,
      2,
      "#91aaa0",
    ),
    pink = surfaceMaterial(
      scene,
      "Old rose plaster",
      "plaster",
      1,
      2,
      "#bca39a",
    ),
    brick = weathered(scene, "Red brick", "#8e5943"),
    wood = weathered(scene, "Tea stall wood", "#67452b", "wood");
  const black = material(scene, "Painted iron", "#252e2b", 0.68, 0.4),
    yellow = material(scene, "Faded curb yellow", "#d9af3d"),
    glass = material(scene, "Dark blue window glass", "#263f43", 0.22, 0.32),
    steel = material(scene, "Galvanized roof", "#86928d", 0.58, 0.68),
    red = material(scene, "Terracotta", "#9f4c35"),
    paper = material(scene, "Old paper", "#d9c6a1"),
    rubber = material(scene, "Tire rubber", "#242927"),
    chrome = material(scene, "Wheel steel", "#9ca39d", 0.35, 0.8);
  function box(
    n: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: PBRMaterial,
    cast = false,
  ) {
    const b = MeshBuilder.CreateBox(
      n,
      { width: w, height: h, depth: d },
      scene,
    );
    b.position.set(x, y, z);
    b.material = m;
    b.receiveShadows = true;
    if (cast) shadow.addShadowCaster(b);
    return b;
  }
  function cameraBlocker(mesh: Mesh) {
    cameraObstacles.push(cameraBounds(mesh));
    return mesh;
  }
  function post(
    n: string,
    a: Vector3,
    b: Vector3,
    r: number,
    m: PBRMaterial,
    parent?: TransformNode,
  ) {
    const length = Vector3.Distance(a, b);
    const mesh = MeshBuilder.CreateCylinder(
      n,
      { height: length, diameter: r * 2, tessellation: 10 },
      scene,
    );
    mesh.position = Vector3.Center(a, b);
    mesh.rotationQuaternion = null;
    const dir = b.subtract(a).normalize();
    mesh.rotation.z = -Math.atan2(dir.x, dir.y);
    mesh.rotation.x = Math.atan2(dir.z, Math.hypot(dir.x, dir.y));
    mesh.material = m;
    if (parent) mesh.parent = parent;
    return mesh;
  }
  function label(
    text: string,
    sub: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    angle: number,
    bg?: string,
  ) {
    const p = MeshBuilder.CreatePlane(
      text,
      { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    p.position.set(x, y, z);
    p.rotation.y = angle;
    const m = new StandardMaterial(text, scene);
    m.diffuseTexture = signTexture(scene, text, sub, bg);
    m.emissiveColor = new Color3(0.19, 0.16, 0.11);
    m.specularColor = Color3.Black();
    p.material = m;
    return p;
  }
  box("Road foundation", 0, -0.16, 3, 46, 0.3, 70, asphalt);
  const ground = MeshBuilder.CreateGround(
    "Distant ground",
    { width: 230, height: 230 },
    scene,
  );
  ground.position.y = -0.32;
  ground.material = concrete;
  for (const s of [-1, 1]) {
    box("Raised footpath", s * 7, 0.06, 3, 3.1, 0.25, 48, concrete);
    obstacles.push({ x: s * 12, z: 2, w: 8, d: 48, h: 18 });
    for (let z = -20; z < 27; z += 1.35) {
      box(
        "Black yellow curb",
        s * 5.43,
        0.16,
        z,
        0.27,
        0.32,
        1.3,
        Math.round(z / 1.35) % 2 ? black : yellow,
      );
    }
    for (let z = -20; z < 27; z += 2.5) {
      box("Pavement joint", s * 7, 0.192, z, 3, 0.012, 0.025, black);
    }
  }
  for (let z = -18; z < 24; z += 6)
    box("Worn road lane mark", 0, 0.007, z, 0.09, 0.011, 2.8, paper);
  // Reflective shallow puddles with irregular outlines, rather than opaque blue discs.
  const wet = material(
    scene,
    "Water dark asphalt reflection",
    "#354244",
    0.12,
    0,
  );
  wet.alpha = 0.72;
  wet.clearCoat.isEnabled = true;
  wet.clearCoat.intensity = 1;
  wet.clearCoat.roughness = 0.08;
  for (const [x, z, sx, sz] of streetPuddles) {
    const shape = Array.from(
      { length: 18 },
      (_, i) =>
        new Vector3(
          Math.cos((i / 18) * 6.283) * (1 + random() * 0.25) * sx,
          0,
          Math.sin((i / 18) * 6.283) * sz,
        ),
    );
    const positions = shape.flatMap((v) => [v.x + x, 0.016, v.z + z]);
    positions.unshift(x, 0.016, z);
    const indices = [];
    for (let i = 1; i <= 18; i++) indices.push(0, i === 18 ? 1 : i + 1, i);
    const mesh = new Mesh("Shallow road puddle", scene);
    mesh.setVerticesData("position", positions);
    mesh.setIndices(indices);
    mesh.createNormals(true);
    mesh.material = wet;
  }
  const brickWalk = material(scene, "Textured brick footpath", "#ffffff", 0.94);
  brickWalk.albedoTexture = texture(
    scene,
    "Original footpath brickwork",
    256,
    256,
    (c) => {
      c.fillStyle = "#77634b";
      c.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 8; row++)
        for (let column = -1; column < 5; column++) {
          c.fillStyle = (row + column) % 3 ? "#a57351" : "#93674d";
          c.fillRect(column * 64 + (row % 2) * 32 + 2, row * 32 + 2, 60, 28);
        }
    },
  );
  const dirt = weathered(scene, "Dry roadside soil", "#80704e"),
    mud = weathered(scene, "Damp roadside soil", "#514839");
  for (const patch of surfacePatches) {
    if (patch.surface === "shop") {
      for (
        let z = patch.z - patch.d / 2 + 0.13;
        z < patch.z + patch.d / 2;
        z += 0.28
      )
        box(
          "Tea shop timber threshold plank",
          patch.x,
          patch.y - 0.06,
          z,
          patch.w,
          0.12,
          0.26,
          wood,
        );
    } else
      box(
        "Walkable textured " + patch.surface,
        patch.x,
        patch.y - 0.009,
        patch.z,
        patch.w,
        0.018,
        patch.d,
        patch.surface === "brick"
          ? brickWalk
          : patch.surface === "mud"
            ? mud
            : dirt,
      );
  }
  // Recessed openings, lintels, balconies, grilles and damp walls make each facade architectural.
  const colors = [ochre, teal, cream, pink, brick];
  for (const side of [-1, 1])
    for (let i = 0; i < 6; i++) {
      const z = -17 + i * 8.2,
        w = 7.5,
        height = 8 + (i % 3) * 2.8,
        x = side * 11.5,
        front = side * 8.0;
      if (side === -1 && i === 2) continue;
      const body = box(
        "Weathered concrete apartment",
        x,
        height / 2,
        z,
        7,
        height,
        w,
        colors[(i + (side > 0 ? 2 : 0)) % 5],
        true,
      );
      body.checkCollisions = true;
      buildings.push(body);
      box("Roof parapet", x, height + 0.22, z, 7.2, 0.45, w + 0.2, cream, true);
      box(
        "Street level lintel",
        front - side * 0.06,
        3,
        z,
        0.36,
        0.22,
        w,
        cream,
      );
      const floors = Math.floor(height / 2.6);
      for (let f = 0; f < floors; f++)
        for (let col = -1; col <= 1; col++) {
          const zz = z + col * 2.2,
            yy = 1.55 + f * 2.6;
          box(
            "Deep window recess",
            front - side * 0.025,
            yy,
            zz,
            0.11,
            1.65,
            1.46,
            black,
          );
          box(
            "Glass window",
            front - side * 0.09,
            yy,
            zz,
            0.13,
            1.45,
            1.26,
            glass,
          );
          box(
            "Window centre mullion",
            front - side * 0.18,
            yy,
            zz,
            0.12,
            1.5,
            0.055,
            cream,
          );
          box(
            "Window sill",
            front - side * 0.2,
            yy - 0.83,
            zz,
            0.45,
            0.12,
            1.65,
            cream,
          );
          if (f > 0) {
            box(
              "Balcony floor",
              front - side * 0.6,
              yy - 0.87,
              zz,
              1.1,
              0.14,
              1.9,
              cream,
              true,
            );
            box(
              "Balcony top rail",
              front - side * 1.04,
              yy - 0.1,
              zz,
              0.065,
              0.055,
              1.85,
              black,
            );
            for (let b = -3; b <= 3; b++)
              box(
                "Balcony vertical grille",
                front - side * 1.04,
                yy - 0.48,
                zz + b * 0.26,
                0.045,
                0.76,
                0.035,
                black,
              );
          }
          if ((f + col + i) % 3 === 0) {
            const ac = box(
              "Air conditioner",
              front - side * 0.3,
              yy + 0.37,
              zz + 0.7,
              0.5,
              0.43,
              0.58,
              steel,
            );
            for (let sl = 0; sl < 4; sl++)
              box(
                "AC grille",
                ac.position.x - side * 0.26,
                yy + 0.22 + sl * 0.08,
                zz + 0.7,
                0.01,
                0.025,
                0.46,
                black,
              );
          }
        }
      for (let f = 1; f < floors; f++)
        box(
          "Concrete floor band",
          front - side * 0.12,
          f * 2.6 + 0.08,
          z,
          0.3,
          0.14,
          w,
          cream,
        );
      const shops = [
        "শেষ কাপ গণতন্ত্র",
        "মায়ের দোয়া ফার্মেসি",
        "তাজা সবজির বাজার",
        "নতুন সকাল স্টুডিও",
        "মামা ভ্যারাইটিজ",
        "মেরামত ঘর",
      ];
      label(
        shops[i],
        "প্রতিশ্রুতি মোড় • ঢাকা",
        front - side * 0.3,
        2.8,
        z,
        5.9,
        0.82,
        (side * Math.PI) / 2,
        i % 2 ? "#772d2a" : "#22463e",
      );
      // Grimy corrugated shop shutter with individual slats.
      for (let zz = z - 2.7; zz < z + 2.7; zz += 0.19)
        box(
          "Shop shutter slat",
          front - side * 0.2,
          1.3,
          zz,
          0.07,
          2.4,
          0.18,
          steel,
        );
      if (i % 2 === 0) {
        box("Roof water tank", x, height + 1.0, z, 2, 1.45, 1.7, black);
        post(
          "Tank water pipe",
          new Vector3(x, height + 0.8, z),
          new Vector3(front, height + 0.8, z),
          0.04,
          black,
        );
      }
    }
  // Back street bend: brickwork and roofs close the sight line without a flat backdrop.
  for (let i = 0; i < 4; i++) {
    const x = -15 + i * 9;
    box(
      "Distant street block",
      x,
      5 + (i % 2),
      31,
      8,
      10 + (i % 2) * 3,
      8,
      colors[i],
      true,
    );
    for (let j = 0; j < 3; j++)
      for (let f = 0; f < 3; f++) {
        const wx = x - 2.5 + j * 2.5,
          wy = 2 + f * 2.7;
        box("Distant window", wx, wy, 26.95, 1.2, 1.5, 0.06, glass);
        for (const offset of [-0.64, 0, 0.64])
          box(
            "Distant recessed window mullion",
            wx + offset,
            wy,
            26.87,
            0.055,
            1.58,
            0.13,
            steel,
          );
        for (const offset of [-0.78, 0.78])
          box(
            "Distant concrete window sill",
            wx,
            wy + offset,
            26.83,
            1.4,
            0.07,
            0.25,
            concrete,
          );
      }
  }
  // কেটলি কেবিনেট — open tea shop with service shelf, bench, stove, cups and kettle.
  const tx = -8.7,
    tz = 0;
  cameraBlocker(
    box("Tea shop brick back", -11.3, 1.6, tz, 0.28, 3.2, 7.2, brick, true),
  );
  box("Tea shop floor", tx, 0.22, tz, 5.7, 0.22, 7.2, concrete);
  for (const zz of [-3.6, 3.6]) {
    cameraBlocker(
      box("Tea shop brick side", tx, 1.3, zz, 5.7, 2.6, 0.21, ochre, true),
    );
    cameraBlocker(
      post(
        "Tea shop front column",
        new Vector3(-5.75, 0.2, zz),
        new Vector3(-5.75, 3.4, zz),
        0.06,
        black,
      ),
    );
  }
  for (let z = -3.9; z < 4; z += 0.22) {
    const roof = box(
      "Corrugated tin roof",
      tx,
      3.58,
      z,
      6.6,
      0.075,
      0.2,
      steel,
      true,
    );
    roof.rotation.z = -0.06;
  }
  label(
    "কেটলি কেবিনেট",
    "গরম চা, ঠান্ডা প্রতিশ্রুতি",
    -5.38,
    3.15,
    0,
    6.85,
    1.0,
    -Math.PI / 2,
    "#20594a",
  );
  label(
    "চা ১০ টাকা",
    "বাকির খাতা বন্ধ",
    -11.1,
    2.1,
    -1.7,
    2,
    0.9,
    -Math.PI / 2,
    "#7b302b",
  );
  box("Tea service counter", -6.7, 0.95, 0.2, 1.0, 1.42, 5.8, wood, true);
  box("Counter stone top", -6.7, 1.7, 0.2, 1.2, 0.1, 6.0, concrete);
  obstacles.push({ x: -6.7, z: 0.2, w: 1.25, d: 6, h: 1.75 });
  box("Bench seat", -9.5, 0.6, -2.8, 2.5, 0.16, 0.48, wood, true);
  for (const x of [-10.4, -8.6])
    box("Bench legs", x, 0.31, -2.8, 0.1, 0.55, 0.4, black);
  const cupMat = material(scene, "Tea cup ceramic", "#ded5b6", 0.28),
    teaMat = material(scene, "Tea in cup", "#673515", 0.4);
  for (let i = 0; i < 9; i++) {
    const x = -6.65 + random() * 0.4,
      z = -2 + i * 0.55;
    const cup = MeshBuilder.CreateCylinder(
      "Small tea glass",
      {
        height: 0.14,
        diameterTop: 0.095,
        diameterBottom: 0.065,
        tessellation: 14,
      },
      scene,
    );
    cup.position.set(x, 1.81, z);
    cup.material = cupMat;
    const tea = MeshBuilder.CreateDisc(
      "Tea surface",
      { radius: 0.04, tessellation: 14 },
      scene,
    );
    tea.rotation.x = Math.PI / 2;
    tea.position.set(x, 1.883, z);
    tea.material = teaMat;
  }
  const kettle = MeshBuilder.CreateLathe(
    "Aluminium kettle body",
    {
      shape: [
        new Vector3(0.06, 0, 0),
        new Vector3(0.22, 0.05, 0),
        new Vector3(0.24, 0.23, 0),
        new Vector3(0.17, 0.3, 0),
        new Vector3(0.17, 0.32, 0),
        new Vector3(0, 0.34, 0),
      ],
      tessellation: 28,
    },
    scene,
  );
  kettle.position.set(-6.65, 1.76, 1.3);
  kettle.material = chrome;
  post(
    "Kettle spout",
    new Vector3(-6.5, 1.86, 1.3),
    new Vector3(-6.24, 2.04, 1.3),
    0.045,
    chrome,
  );
  const handle = MeshBuilder.CreateTorus(
    "Kettle handle",
    { diameter: 0.43, thickness: 0.035, tessellation: 24 },
    scene,
  );
  handle.position.set(-6.7, 2.05, 1.3);
  handle.rotation.x = Math.PI / 2;
  handle.material = black;
  const jarGlass = material(scene, "Biscuit jar clear glass", "#d1dfce", 0.14);
  jarGlass.alpha = 0.26;
  jarGlass.backFaceCulling = false;
  jarGlass.twoSidedLighting = true;
  const biscuit = weathered(
    scene,
    "Baked tea biscuit crumb",
    "#b77d38",
    "wood",
  );
  for (let i = 0; i < 3; i++) {
    const jz = -1.4 + i * 0.4;
    const jar = MeshBuilder.CreateLathe(
      "Clear glass biscuit jar",
      {
        shape: [
          new Vector3(0, 0, 0),
          new Vector3(0.115, 0.015, 0),
          new Vector3(0.12, 0.04, 0),
          new Vector3(0.12, 0.34, 0),
          new Vector3(0.105, 0.37, 0),
          new Vector3(0.105, 0.4, 0),
        ],
        tessellation: 24,
        sideOrientation: Mesh.DOUBLESIDE,
      },
      scene,
    );
    jar.position.set(-6.7, 1.8, jz);
    jar.material = jarGlass;
    for (let k = 0; k < 7 - i; k++) {
      const cookie = MeshBuilder.CreateCylinder(
        "Crimp-edged tea biscuit",
        {
          diameter: 0.19,
          height: 0.031,
          tessellation: 16,
        },
        scene,
      );
      cookie.position.set(
        -6.7 + Math.sin(k * 2.3) * 0.008,
        1.835 + k * 0.039,
        jz,
      );
      cookie.material = biscuit;
    }
    const cap = MeshBuilder.CreateCylinder(
      "Biscuit jar brushed tin lid",
      {
        diameter: 0.23,
        height: 0.035,
        tessellation: 28,
      },
      scene,
    );
    cap.position.set(-6.7, 2.215, jz);
    cap.material = chrome;
    const rim = MeshBuilder.CreateTorus(
      "Biscuit jar rolled lid rim",
      {
        diameter: 0.225,
        thickness: 0.012,
        tessellation: 24,
      },
      scene,
    );
    rim.position.set(-6.7, 2.2, jz);
    rim.material = chrome;
  }
  box("Stove base", -7.0, 1.77, 2.4, 0.52, 0.1, 0.54, black);
  const hob = MeshBuilder.CreateTorus(
    "Tea stove cast iron burner",
    {
      diameter: 0.29,
      thickness: 0.035,
      tessellation: 24,
    },
    scene,
  );
  hob.position.set(-7, 1.84, 2.4);
  hob.material = black;
  for (const axis of [-1, 1]) {
    post(
      "Tea stove pot support",
      new Vector3(-7.2, 1.86, 2.4 + axis * 0.16),
      new Vector3(-6.8, 1.86, 2.4 - axis * 0.16),
      0.016,
      chrome,
    );
  }
  // Tattered cloth awning, newspaper stack and produce baskets.
  const awningMat = material(scene, "Tea awning striped fabric", "#b84a32");
  const awning = box(
    "Tea shop shade",
    -5.25,
    2.67,
    0,
    1.1,
    0.035,
    6.6,
    awningMat,
  );
  awning.rotation.z = 0.18;
  const mural = MeshBuilder.CreateGround(
    "Dhaka hand-painted awning underside",
    { width: 1.08, height: 6.6 },
    scene,
  );
  mural.position.set(-5.25, 2.635, 0);
  mural.rotation.z = 0.18;
  const muralMaterial = surfaceMaterial(
    scene,
    "Hand-painted civic canopy",
    "rickshaw-art",
    1,
    4,
  );
  muralMaterial.backFaceCulling = false;
  muralMaterial.twoSidedLighting = true;
  mural.material = muralMaterial;
  for (let z = -3.2; z < 3.2; z += 0.5)
    box("Awning pale stripes", -5.25, 2.7, z, 1.1, 0.02, 0.18, paper);
  for (let i = 0; i < 5; i++)
    box(
      "Newspaper stack",
      -6.7,
      1.77 + i * 0.012,
      -2.4,
      0.45,
      0.01,
      0.3,
      paper,
    );
  // Utility poles with insulators and many hanging cables crossing the lane.
  for (const z of [-14, 6, 22])
    for (const s of [-1, 1]) {
      const x = s * 5.8;
      post(
        "Concrete electric pole",
        new Vector3(x, 0, z),
        new Vector3(x, 9, z),
        0.11,
        cream,
      );
      box("Power crossbar", x, 8.2, z, 2, 0.09, 0.09, black);
      for (let k = -1; k <= 1; k++) {
        post(
          "Ceramic insulator",
          new Vector3(x + k * 0.65, 8.2, z),
          new Vector3(x + k * 0.65, 8.5, z),
          0.055,
          glass,
        );
        const next = z + 20;
        if (z < 22) {
          const path = Curve3.CreateQuadraticBezier(
            new Vector3(x + k * 0.2, 8.45, z),
            new Vector3(x + k * 0.2, 6.0, z + 10),
            new Vector3(x + k * 0.2, 8.45, next),
            25,
          ).getPoints();
          const cable = MeshBuilder.CreateTube(
            "Sagging utility cable",
            { path, radius: 0.014, tessellation: 5 },
            scene,
          );
          cable.material = black;
        }
      }
      const cross = Curve3.CreateQuadraticBezier(
        new Vector3(-5.8, 8.0, z),
        new Vector3(0, 5.7, z + 1),
        new Vector3(5.8, 8.4, z + 0.5),
        25,
      ).getPoints();
      for (let k = 0; k < 3; k++) {
        const cable = MeshBuilder.CreateTube(
          "Tangled wire crossing street",
          {
            path: cross.map((p) => p.add(new Vector3(0, k * 0.13, k * 0.12))),
            radius: 0.013,
            tessellation: 5,
          },
          scene,
        );
        cable.material = black;
      }
      const arm = post(
        "Street lamp arm",
        new Vector3(x, 6.9, z),
        new Vector3(x - s * 1.6, 6.8, z),
        0.035,
        black,
      );
      arm.receiveShadows = true;
      const lamp = box(
        "Street lamp housing",
        x - s * 1.6,
        6.76,
        z,
        0.5,
        0.12,
        0.23,
        cream,
      );
      lamps.push(lamp);
    }
  // Divider planters and yellow/black road barriers at the bend.
  for (let z = 13; z < 24; z += 2.3) {
    box("Divider concrete base", -0.2, 0.24, z, 0.46, 0.5, 1.9, yellow, true);
    box("Divider black band", -0.2, 0.25, z, 0.48, 0.24, 0.4, black);
  }
  // Fictional road meeting, bamboo frame, banner and microphones.
  const stage = box(
    "Temporary wooden meeting platform",
    1.8,
    0.23,
    10.6,
    4,
    0.45,
    3,
    wood,
    true,
  );
  obstacles.push({ x: 1.8, z: 10.6, w: 4, d: 3, h: 0.45 });
  for (const x of [0, 3.7])
    post(
      "Bamboo banner support",
      new Vector3(x, 0, 12),
      new Vector3(x, 4, 12),
      0.045,
      wood,
    );
  label(
    "রাস্তা বন্ধ, উন্নয়ন চলছে!",
    "কাল্পনিক প্রতিশ্রুতি পরিষদ",
    1.85,
    3.0,
    11.95,
    4.5,
    1.0,
    0,
    "#722f29",
  );
  box("Podium", 1.8, 0.95, 9.55, 0.75, 1.35, 0.5, wood, true);
  label("কথাই কাজ", "বজলু ভাই", 1.8, 1.16, 9.28, 0.67, 0.58, 0, "#22564b");
  post(
    "Microphone stand",
    new Vector3(1.8, 1.5, 9.55),
    new Vector3(1.8, 2.05, 9.55),
    0.018,
    black,
  );
  post(
    "Microphone",
    new Vector3(1.8, 2.05, 9.55),
    new Vector3(1.8, 2.05, 9.35),
    0.035,
    black,
  );
  for (const x of [-0.25, 4.0]) {
    box("PA speaker cabinet", x, 0.8, 10, 0.7, 1.2, 0.65, black, true);
    for (const y of [0.55, 1.04]) {
      const speaker = MeshBuilder.CreateCylinder(
        "Speaker cone",
        { diameter: 0.43, height: 0.03, tessellation: 24 },
        scene,
      );
      speaker.position.set(x, y, 9.66);
      speaker.rotation.x = Math.PI / 2;
      speaker.material = rubber;
    }
  }
  stage.receiveShadows = true;
  // Posters and cloth laundry: all text stays Bengali and fictional.
  for (const [x, z, a] of [
    [-7.96, 7.5, -Math.PI / 2],
    [7.96, -5, Math.PI / 2],
    [7.96, 13, Math.PI / 2],
  ]) {
    label(
      "প্রতিশ্রুতির শেষ নাই",
      "পথচারীর পথ চাই",
      x,
      1.7,
      z,
      1.3,
      1.7,
      a,
      "#e3cc91",
    );
  }
  for (let i = 0; i < 10; i++) {
    const x = 8.1,
      z = -14 + i * 0.47;
    box("Hanging local cloth", x, 5.9, z, 0.05, 0.9, 0.35, i % 2 ? teal : red);
  }
  // Small debris is textured paper and leaves, never large placeholder props.
  for (let i = 0; i < 36; i++) {
    const x = (random() > 0.5 ? 1 : -1) * (4.8 + random() * 0.4),
      z = -18 + random() * 42;
    const litter = box(
      "Street paper",
      x,
      0.03,
      z,
      0.12 + random() * 0.12,
      0.006,
      0.1,
      paper,
    );
    litter.rotation.y = random() * 6.3;
  }
  createRickshaw(scene, shadow, new Vector3(-4.1, 0, -3.7), -0.18);
  const cng = createCNG(scene, shadow, new Vector3(4.0, 0, 2.0), Math.PI);
  obstacles.push({ x: -4.1, z: -3.7, w: 1.6, d: 2.8, h: 2 }, cng.footprint);
  createBus(scene, shadow, new Vector3(3.1, 0, 21.5), Math.PI);
  obstacles.push({ x: 3.1, z: 21.5, w: 2.6, d: 8.3, h: 3.25 });
  // Small potted palms beside the tea stall.
  for (const z of [-4.3, 4.5]) {
    const pot = MeshBuilder.CreateLathe(
      "Clay plant pot",
      {
        shape: [
          new Vector3(0.19, 0, 0),
          new Vector3(0.3, 0.47, 0),
          new Vector3(0.31, 0.52, 0),
        ],
        tessellation: 18,
        sideOrientation: Mesh.DOUBLESIDE,
      },
      scene,
    );
    pot.position.set(-6.4, 0.2, z);
    pot.material = red;
    const leafMat = material(scene, `Palm leaves ${z}`, "#465e32");
    for (let j = 0; j < 9; j++) {
      const a = (j / 9) * Math.PI * 2;
      const path = Curve3.CreateQuadraticBezier(
        new Vector3(-6.4, 0.6, z),
        new Vector3(-6.4 + Math.cos(a) * 0.5, 1.7, z + Math.sin(a) * 0.5),
        new Vector3(-6.4 + Math.cos(a) * 0.8, 1.2, z + Math.sin(a) * 0.8),
        8,
      ).getPoints();
      const leaf = MeshBuilder.CreateTube(
        "Palm frond",
        { path, radius: 0.035, tessellation: 5 },
        scene,
      );
      leaf.material = leafMat;
    }
  }
  addDhakaDetails(scene, shadow);
  obstacles.push(
    { x: -7.2, z: -13.5, w: 0.45, d: 0.45, h: 6 },
    { x: 7.2, z: 11.7, w: 0.45, d: 0.45, h: 6 },
    { x: -0.2, z: 18.5, w: 0.7, d: 10, h: 1.3 },
  );
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = hex("#b5c3bb");
  scene.fogDensity = 0.009;
  scene.clearColor = new Color4(0.63, 0.73, 0.74, 1);
  return {
    obstacles,
    cameraObstacles,
    vehicles: [cng],
    lamps,
    buildings,
    shadow,
  };
}

export function disposeMeshes(meshes: AbstractMesh[]) {
  for (const m of meshes) m.dispose();
}
export type ArtTexture = DynamicTexture;
