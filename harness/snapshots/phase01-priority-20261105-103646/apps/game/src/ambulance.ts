import {
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  TransformNode,
  Vector3,
} from "./engine";
import { material, signTexture, surfaceMaterial } from "./art";
import type { AIPose } from "./missionAI";
import {
  ambulanceAnchorsAt,
  ambulanceFootprint,
  ambulanceLocalAnchors,
} from "./ambulanceGeometry";

/** Original fictional Bangladeshi microbus ambulance. Shared textures belong to
 * this factory; the returned disposer never touches other sector materials. */
export function createAmbulance(scene: Scene, shadow: ShadowGenerator) {
  const root = new TransformNode("স্বস্তি সেবা — সহায়তার গাড়ি", scene);
  const ownedMaterials: PBRMaterial[] = [];
  const mat = (name: string, color: string, rough = 0.6, metal = 0) => {
    const m = material(scene, `Ambulance ${name}`, color, rough, metal);
    ownedMaterials.push(m);
    return m;
  };
  const enamel = surfaceMaterial(
    scene,
    "Ambulance lightly worn enamel",
    "cng-enamel",
    2,
    1,
    "#e9e8d9",
  );
  ownedMaterials.push(enamel);
  const teal = mat("teal medical stripe", "#287c75", 0.4, 0.15),
    rubber = mat("tire rubber", "#1b2220", 0.94),
    black = mat("window seals", "#26332f", 0.8),
    glass = mat("smoked cabin glass", "#6b918c", 0.14, 0.5),
    chrome = mat("brushed wheel steel", "#8d9998", 0.3, 0.78),
    lamp = mat("warm lamps", "#f1deb2", 0.25),
    red = mat("tail lamp glass", "#9f3830", 0.2),
    blue = mat("blue beacon glass", "#4086ad", 0.2),
    mattress = mat("woven stretcher cushion", "#688b81", 0.9),
    fabric = mat("rear bench woven vinyl", "#4c6258", 0.86);
  lamp.emissiveColor.set(0.42, 0.31, 0.1);
  const wheels: Mesh[] = [],
    lights: Mesh[] = [],
    doors: TransformNode[] = [];
  const own = <T extends Mesh>(
    mesh: T,
    m: PBRMaterial,
    parent = root,
    cast = true,
  ) => {
    mesh.material = m;
    mesh.parent = parent;
    mesh.receiveShadows = true;
    mesh.metadata = {
      staticBatchExclude: true,
      vehicleId: "mission-ambulance",
    };
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
    m: PBRMaterial,
    parent = root,
  ) => {
    const b = own(
      MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene),
      m,
      parent,
    );
    b.position.set(x, y, z);
    return b;
  };
  const rod = (
    name: string,
    points: number[][],
    radius = 0.025,
    parent = root,
  ) =>
    own(
      MeshBuilder.CreateTube(
        name,
        {
          path: points.map((p) => Vector3.FromArray(p)),
          radius,
          tessellation: 8,
        },
        scene,
      ),
      chrome,
      parent,
    );
  // Framed shell with actual openings, curved roof and a stepped bonnet.
  box("Microbus chassis", 0, 0.42, 0, 1.84, 0.2, 4.7, black);
  box("Interior ambulance floor", 0, 0.66, -0.1, 1.8, 0.12, 4.3, enamel);
  box("Rounded bonnet lower", 0, 0.86, 1.97, 1.88, 0.5, 0.8, enamel);
  const bonnet = box(
    "Sloped ambulance bonnet",
    0,
    1.18,
    1.91,
    1.86,
    0.12,
    0.82,
    enamel,
  );
  bonnet.rotation.x = 0.12;
  box("Front chrome bumper", 0, 0.56, 2.38, 1.97, 0.17, 0.14, chrome);
  box("Rear chrome bumper", 0, 0.53, -2.43, 1.97, 0.16, 0.16, chrome);
  box("Front grille recess", 0, 0.82, 2.39, 0.95, 0.24, 0.025, black);
  for (let i = 0; i < 5; i++)
    box(
      "Chrome grille slat",
      0,
      0.73 + i * 0.042,
      2.41,
      0.88,
      0.016,
      0.025,
      chrome,
    );
  for (const side of [-1, 1]) {
    box(
      "Low ambulance side panel",
      side * 0.94,
      0.96,
      -0.56,
      0.08,
      0.55,
      3.58,
      enamel,
    );
    box(
      "Teal ambulance side stripe",
      side * 0.985,
      1.04,
      -0.56,
      0.018,
      0.23,
      3.56,
      teal,
    );
    box("Roof sill", side * 0.93, 2.04, -0.45, 0.1, 0.11, 3.72, enamel);
    for (const z of [-2.18, -1.22, 0.15, 1.3])
      box("Window body pillar", side * 0.92, 1.62, z, 0.09, 0.83, 0.1, enamel);
    for (const z of [-1.71, -0.53]) {
      box(
        "Black window surround",
        side * 0.965,
        1.64,
        z,
        0.05,
        0.69,
        0.99,
        black,
      );
      box(
        "Tinted passenger glazing",
        side * 0.996,
        1.64,
        z,
        0.018,
        0.58,
        0.88,
        glass,
      );
      box(
        "Window safety rail",
        side * 1.013,
        1.51,
        z,
        0.018,
        0.025,
        0.89,
        chrome,
      );
    }
    box("Headlamp glass", side * 0.69, 0.99, 2.39, 0.41, 0.25, 0.035, lamp);
    box("Tail lamp cluster", side * 0.84, 1.01, -2.39, 0.16, 0.53, 0.05, red);
    box(
      "Amber turn indicator",
      side * 0.87,
      1.19,
      2.36,
      0.15,
      0.09,
      0.04,
      lamp,
    );
    const mirror = box(
      "Door mirror",
      side * 1.18,
      1.62,
      1.42,
      0.24,
      0.19,
      0.11,
      black,
    );
    rod(
      "Mirror support",
      [
        [side * 0.95, 1.53, 1.4],
        [side * 1.18, 1.53, 1.42],
      ],
      0.025,
    );
    mirror.rotation.y = side * 0.12;
    // Cabin doors open about real forward hinges for medic entry and exit.
    const door = new TransformNode("Front cabin door hinge", scene);
    door.parent = root;
    door.position.set(side * 0.96, 0, 1.3);
    box("Cabin door steel", 0, 1.01, -0.52, 0.075, 0.57, 1.03, enamel, door);
    box(
      "Cabin door stripe",
      side * 0.041,
      1.05,
      -0.52,
      0.02,
      0.21,
      1.01,
      teal,
      door,
    );
    box("Cabin door glass seal", 0, 1.59, -0.5, 0.06, 0.66, 0.94, black, door);
    box(
      "Cabin door glass",
      side * 0.035,
      1.61,
      -0.5,
      0.02,
      0.54,
      0.8,
      glass,
      door,
    );
    box(
      "Cabin door handle",
      side * 0.075,
      1.24,
      -0.8,
      0.04,
      0.04,
      0.19,
      chrome,
      door,
    );
    doors.push(door);
  }
  const roof = own(
    MeshBuilder.CreateCylinder(
      "Elliptical pressed roof",
      { diameter: 1, height: 3.91, tessellation: 24 },
      scene,
    ),
    enamel,
  );
  roof.rotation.x = Math.PI / 2;
  roof.scaling.set(1.96, 1, 0.32);
  roof.position.set(0, 2.055, -0.36);
  const windshield = box(
    "Broad front windshield",
    0,
    1.65,
    1.35,
    1.74,
    0.7,
    0.045,
    glass,
  );
  windshield.rotation.x = -0.16;
  box("Windshield upper seal", 0, 2.0, 1.3, 1.8, 0.06, 0.08, black);
  for (const side of [-1, 1]) {
    rod(
      "Windscreen wiper",
      [
        [side * 0.48, 1.32, 1.43],
        [side * 0.3, 1.68, 1.4],
      ],
      0.013,
    );
    box(
      "Driver seat cushion",
      side * 0.48,
      0.94,
      0.72,
      0.6,
      0.14,
      0.65,
      fabric,
    );
    const back = box(
      "Driver seat back",
      side * 0.48,
      1.2,
      0.44,
      0.6,
      0.65,
      0.14,
      fabric,
    );
    back.rotation.x = -0.12;
    const head = box(
      "Driver headrest",
      side * 0.48,
      1.6,
      0.4,
      0.36,
      0.19,
      0.13,
      fabric,
    );
    head.rotation.x = -0.12;
  }
  box("Dashboard", 0, 1.13, 1.21, 1.6, 0.23, 0.35, black);
  const steering = own(
    MeshBuilder.CreateTorus(
      "Steering wheel",
      { diameter: 0.38, thickness: 0.034, tessellation: 20 },
      scene,
    ),
    black,
  );
  steering.position.set(0.48, 1.32, 1.02);
  steering.rotation.x = 0.55;
  for (const x of [-0.99, 0.99])
    for (const z of [-1.52, 1.48]) {
      const wheelRoot = new TransformNode("Ambulance suspension", scene);
      wheelRoot.parent = root;
      wheelRoot.position.set(x, 0.45, z);
      const tire = own(
        MeshBuilder.CreateCylinder(
          "Radial tread tire",
          { diameter: 0.76, height: 0.22, tessellation: 24 },
          scene,
        ),
        rubber,
        wheelRoot,
      );
      tire.rotation.z = Math.PI / 2;
      const hub = own(
        MeshBuilder.CreateCylinder(
          "Wheel rim",
          { diameter: 0.43, height: 0.235, tessellation: 16 },
          scene,
        ),
        chrome,
        wheelRoot,
      );
      hub.rotation.z = Math.PI / 2;
      for (let spoke = 0; spoke < 6; spoke++) {
        const angle = (spoke * Math.PI) / 3;
        box(
          "Rim ventilation recess",
          x < 0 ? -0.13 : 0.13,
          Math.sin(angle) * 0.12,
          Math.cos(angle) * 0.12,
          0.014,
          0.065,
          0.07,
          black,
          wheelRoot,
        );
      }
      // Rotate the complete wheel hierarchy rather than the untextured tire only.
      wheels.push(tire);
      tire.metadata = { ...tire.metadata, rotationRoot: wheelRoot };
    }
  // Stretcher, metal rails, four casters and folded blanket are visible at rear.
  box("Stretcher mattress", 0, 0.91, -0.8, 0.67, 0.11, 1.72, mattress);
  box("Stretcher pillow", 0, 1.0, -0.18, 0.54, 0.1, 0.36, fabric);
  for (const x of [-0.36, 0.36]) {
    rod(
      "Stretcher top rail",
      [
        [x, 0.87, -1.75],
        [x, 0.87, 0.08],
      ],
      0.025,
    );
    rod(
      "Stretcher fold leg",
      [
        [x, 0.86, -1.4],
        [x, 0.72, -0.9],
        [x, 0.71, -0.3],
      ],
      0.022,
    );
    for (const z of [-1.4, -0.25]) {
      const caster = own(
        MeshBuilder.CreateCylinder(
          "Stretcher rubber caster",
          { diameter: 0.1, height: 0.04, tessellation: 12 },
          scene,
        ),
        rubber,
      );
      caster.position.set(x, 0.71, z);
      caster.rotation.z = Math.PI / 2;
    }
  }
  box("Folded cotton blanket", 0, 1.0, -1.35, 0.6, 0.07, 0.45, fabric);
  box("Rear attendant bench", -0.65, 0.95, -0.8, 0.4, 0.13, 1.4, fabric);
  box("Rear medical cabinet", 0.64, 1.03, -0.7, 0.35, 0.67, 1.35, enamel);
  for (const z of [-1.1, -0.5])
    box("Cabinet handle", 0.438, 1.16, z, 0.025, 0.04, 0.16, chrome);
  for (const side of [-1, 1]) {
    const door = new TransformNode("Rear ambulance door hinge", scene);
    door.parent = root;
    door.position.set(side * 0.92, 0, -2.29);
    box(
      "Rear door panel",
      -side * 0.45,
      1.27,
      0,
      0.89,
      1.46,
      0.065,
      enamel,
      door,
    );
    box(
      "Rear door window surround",
      -side * 0.45,
      1.7,
      -0.04,
      0.72,
      0.48,
      0.02,
      black,
      door,
    );
    box(
      "Rear door window",
      -side * 0.45,
      1.7,
      -0.055,
      0.61,
      0.39,
      0.018,
      glass,
      door,
    );
    box(
      "Rear door teal strip",
      -side * 0.45,
      1.05,
      -0.045,
      0.87,
      0.22,
      0.02,
      teal,
      door,
    );
    box(
      "Rear door handle",
      -side * 0.75,
      1.31,
      -0.068,
      0.04,
      0.18,
      0.035,
      chrome,
      door,
    );
    doors.push(door);
  }
  box("Beacon bar base", 0, 2.27, 0.78, 1.3, 0.09, 0.32, black);
  for (const side of [-1, 1]) {
    const beacon = box(
      "Roof safety beacon",
      side * 0.47,
      2.37,
      0.78,
      0.32,
      0.17,
      0.29,
      side < 0 ? blue : red,
    );
    lights.push(beacon);
  }
  function sign(text: string, sub: string, side: number) {
    const m = mat(`Bengali service label ${side}`, "#ffffff");
    m.albedoTexture = signTexture(
      scene,
      text,
      sub,
      "#e5e7d9",
      "#195b54",
      1024,
      256,
    );
    const panel = own(
      MeshBuilder.CreatePlane(
        "স্বস্তি সেবা পরিচয়",
        { width: 2.45, height: 0.58 },
        scene,
      ),
      m,
    );
    panel.position.set(side * 1.009, 1.26, -0.65);
    panel.rotation.y = (side * Math.PI) / 2;
  }
  sign("স্বস্তি সেবা", "কাল্পনিক সহায়তা • স্বস্তি ক্লিনিক", -1);
  sign("স্বস্তি সেবা", "শান্ত থাকুন • পথ খোলা রাখুন", 1);
  const plateMat = mat("fictional Bengali registration", "#ffffff");
  plateMat.albedoTexture = signTexture(
    scene,
    "ঢাকা কল্প–০৭",
    "সহায়তার গাড়ি",
    "#deded1",
    "#24423a",
    512,
    192,
  );
  const plate = own(
    MeshBuilder.CreatePlane(
      "কাল্পনিক নম্বরপ্লেট",
      { width: 0.57, height: 0.22 },
      scene,
    ),
    plateMat,
  );
  plate.position.set(0, 0.57, 2.47);
  const anchor = (name: string, x: number, y: number, z: number, yaw = 0) => {
    const node = new TransformNode(name, scene);
    node.parent = root;
    node.position.set(x, y, z);
    node.rotation.y = yaw;
    return node;
  };
  const fromPose = (name: string, p: AIPose) =>
    anchor(name, p.x, p.y, p.z, p.yaw);
  const nodes = {
    rear: fromPose("Leader rear entry", ambulanceLocalAnchors.rear),
    rest: fromPose("Leader stretcher rest", ambulanceLocalAnchors.rest),
    seats: ambulanceLocalAnchors.seats.map((p, i) =>
      fromPose(`Paramedic seat ${i}`, p),
    ),
    exits: ambulanceLocalAnchors.exits.map((p, i) =>
      fromPose(`Paramedic exit ${i}`, p),
    ),
  };
  const toPose = (node: TransformNode): AIPose => {
    root.computeWorldMatrix(true);
    node.computeWorldMatrix(true);
    const p = node.getAbsolutePosition();
    return { x: p.x, y: p.y, z: p.z, yaw: root.rotation.y + node.rotation.y };
  };
  let previousTravel = 0;
  return {
    root,
    wheels,
    lights,
    doors,
    nodes,
    anchors: ambulanceAnchorsAt,
    worldPose: toPose,
    footprint: { ...ambulanceFootprint, h: 2.5 },
    update(
      pose: AIPose,
      travel: number,
      doorOpen: number,
      time: number,
      siren: boolean,
    ) {
      root.position.set(pose.x, pose.y, pose.z);
      root.rotation.y = pose.yaw;
      const delta = travel - previousTravel;
      previousTravel = travel;
      for (const tire of wheels) {
        const suspension = tire.metadata.rotationRoot as TransformNode;
        suspension.rotation.x += delta / 0.38;
      }
      for (let i = 0; i < doors.length; i++)
        doors[i].rotation.y =
          (i % 2 ? 1 : -1) *
          Math.max(0, Math.min(1, doorOpen)) *
          (i < 2 ? 0.9 : 1.65);
      for (let i = 0; i < lights.length; i++) {
        const m = lights[i].material as PBRMaterial;
        m.emissiveColor
          .copyFrom(m.albedoColor)
          .scaleInPlace(
            siren && Math.sin(time * 11 + i * Math.PI) > 0 ? 2 : 0.06,
          );
      }
      root.computeWorldMatrix(true);
    },
    dispose() {
      for (const mesh of root.getChildMeshes()) shadow.removeShadowCaster(mesh);
      root.dispose(false, false);
      for (const m of ownedMaterials) m.dispose(false, true);
    },
  };
}
export type AmbulanceModel = ReturnType<typeof createAmbulance>;

/** Rigid accessories attach to the real animated joints, so the hand-held
 * phone and medical identifiers follow the rig rather than floating at root. */
export function attachMissionAccessories(
  scene: Scene,
  root: TransformNode,
  shadow: ShadowGenerator,
  paramedic = false,
) {
  const node = (name: string) =>
    root
      .getDescendants(false)
      .find(
        (n) => n instanceof TransformNode && n.name.endsWith(`/${name}`),
      ) as TransformNode | undefined;
  const hand = node("Hand.R"),
    chest = node("Chest");
  const owned: Mesh[] = [],
    materials: PBRMaterial[] = [];
  const makeMat = (name: string, color: string, rough = 0.7) => {
    const m = material(scene, `${root.name} ${name}`, color, rough);
    materials.push(m);
    return m;
  };
  const phoneRoot = new TransformNode(`${root.name} ফোন`, scene);
  phoneRoot.parent = hand ?? root;
  phoneRoot.position.set(-0.025, -0.045, 0.04);
  phoneRoot.rotation.x = -0.3;
  const black = makeMat("phone polymer", "#263330", 0.38),
    screen = makeMat("phone screen", "#76998d", 0.17);
  screen.emissiveColor.set(0.035, 0.065, 0.045);
  const mesh = (
    name: string,
    width: number,
    height: number,
    depth: number,
    mat: PBRMaterial,
    parent: TransformNode,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
    m.material = mat;
    m.parent = parent;
    m.position.set(x, y, z);
    m.metadata = { staticBatchExclude: true };
    owned.push(m);
    shadow.addShadowCaster(m);
    return m;
  };
  mesh(
    "Phone rounded black body",
    0.067,
    0.13,
    0.013,
    black,
    phoneRoot,
    0,
    0,
    0,
  );
  mesh(
    "Phone glass screen",
    0.057,
    0.103,
    0.002,
    screen,
    phoneRoot,
    0,
    0.002,
    -0.008,
  );
  mesh(
    "Phone earpiece",
    0.021,
    0.004,
    0.002,
    screen,
    phoneRoot,
    0,
    0.058,
    -0.008,
  );
  mesh(
    "Phone home button",
    0.013,
    0.005,
    0.002,
    screen,
    phoneRoot,
    0,
    -0.058,
    -0.008,
  );
  phoneRoot.setEnabled(false);
  if (paramedic && chest) {
    const reflective = makeMat("medical reflective trim", "#ced1b0"),
      label = makeMat("Bengali medical badge", "#ffffff");
    label.albedoTexture = signTexture(
      scene,
      "সহায়তা",
      "স্বস্তি সেবা",
      "#e9e8db",
      "#185a50",
      512,
      256,
    );
    mesh(
      "Medical reflective chest strip",
      0.42,
      0.035,
      0.018,
      reflective,
      chest,
      0,
      -0.07,
      0.14,
    );
    mesh(
      "Medical reflective back strip",
      0.42,
      0.035,
      0.018,
      reflective,
      chest,
      0,
      -0.07,
      -0.14,
    );
    const badge = MeshBuilder.CreatePlane(
      "বাংলা সহায়তাকারীর পরিচয়",
      { width: 0.19, height: 0.1 },
      scene,
    );
    badge.parent = chest;
    badge.position.set(-0.1, 0.005, 0.156);
    badge.material = label;
    badge.metadata = { staticBatchExclude: true };
    owned.push(badge);
  }
  return {
    phone: phoneRoot,
    dispose() {
      for (const m of owned) {
        shadow.removeShadowCaster(m);
        m.dispose();
      }
      phoneRoot.dispose();
      for (const m of materials) m.dispose(false, true);
    },
  };
}
