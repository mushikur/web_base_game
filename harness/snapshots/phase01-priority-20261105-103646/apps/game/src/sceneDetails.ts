import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
} from "./engine";
import { material, random, signTexture, texture, weathered } from "./art";

/** Reference-led Dhaka street details. Everything remains actual spatial geometry. */
export function addDhakaDetails(scene: Scene, shadow: ShadowGenerator) {
  const iron = material(
      scene,
      "Weathered pedestrian railing iron",
      "#344138",
      0.78,
      0.5,
    ),
    yellow = material(
      scene,
      "Dhaka divider yellow enamel",
      "#c79b35",
      0.64,
      0.35,
    ),
    bark = weathered(scene, "Tropical tree fissured bark", "#655748", "wood"),
    dust = material(scene, "Dust accumulated in drains", "#343a32", 0.95);
  function rod(n: string, path: Vector3[], radius: number, m: PBRMaterial) {
    const mesh = MeshBuilder.CreateTube(
      n,
      { path, radius, tessellation: 7 },
      scene,
    );
    mesh.material = m;
    mesh.receiveShadows = true;
    shadow.addShadowCaster(mesh);
    return mesh;
  }
  function box(
    n: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: PBRMaterial,
  ) {
    const mesh = MeshBuilder.CreateBox(
      n,
      { width: w, height: h, depth: d },
      scene,
    );
    mesh.position.set(x, y, z);
    mesh.material = m;
    mesh.receiveShadows = true;
    return mesh;
  }
  // Galvanised/yellow pedestrian barriers and worn Bengali public notices, inspired by the divider photograph.
  for (let z = 13.1; z < 24; z += 1.8) {
    for (const zz of [z, z + 1.65]) {
      rod(
        "Yellow median railing post",
        [new Vector3(-0.2, 0.4, zz), new Vector3(-0.2, 1.4, zz)],
        0.035,
        yellow,
      );
      const cap = MeshBuilder.CreateCylinder(
        "Pointed divider post cap",
        { height: 0.12, diameterTop: 0, diameterBottom: 0.09, tessellation: 4 },
        scene,
      );
      cap.position.set(-0.2, 1.45, zz);
      cap.material = yellow;
    }
    rod(
      "Median top rail",
      [new Vector3(-0.2, 1.35, z), new Vector3(-0.2, 1.35, z + 1.65)],
      0.033,
      yellow,
    );
    rod(
      "Median lower rail",
      [new Vector3(-0.2, 0.64, z), new Vector3(-0.2, 0.64, z + 1.65)],
      0.025,
      iron,
    );
    for (let k = 1; k < 6; k++)
      rod(
        "Median vertical railing",
        [
          new Vector3(-0.2, 0.64, z + k * 0.275),
          new Vector3(-0.2, 1.34, z + k * 0.275),
        ],
        0.013,
        iron,
      );
  }
  for (const s of [-1, 1])
    for (let z = -16; z < 24; z += 5.3) {
      box("Storm drain recess", s * 5.2, 0.022, z, 0.29, 0.028, 0.78, dust);
      for (let k = 0; k < 10; k++)
        box(
          "Drain iron grille",
          s * 5.2,
          0.045,
          z - 0.34 + k * 0.075,
          0.29,
          0.02,
          0.018,
          iron,
        );
    }
  // A real branch structure and individually shaped leaf sprigs; no spherical green canopy placeholders.
  const leaves = material(scene, "Tropical leaf canopy", "#ffffff", 0.91);
  leaves.backFaceCulling = false;
  leaves.twoSidedLighting = true;
  leaves.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
  const leafTexture = texture(
    scene,
    "Original tropical leaf sprig",
    512,
    512,
    (c) => {
      c.clearRect(0, 0, 512, 512);
      c.strokeStyle = "#465735";
      c.lineWidth = 8;
      c.beginPath();
      c.moveTo(242, 495);
      c.quadraticCurveTo(270, 280, 244, 40);
      c.stroke();
      for (let k = 0; k < 8; k++)
        for (const side of [-1, 1]) {
          const y = 75 + k * 48,
            x = 253 + side * (65 + (k % 3) * 9);
          c.strokeStyle = "#425831";
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(250, y + 35);
          c.lineTo(x, y);
          c.stroke();
          c.save();
          c.translate(x, y);
          c.rotate(side * -0.65);
          const g = c.createLinearGradient(-30, 0, 30, 0);
          g.addColorStop(0, "#314b29");
          g.addColorStop(0.5, "#647847");
          g.addColorStop(1, "#3c582f");
          c.fillStyle = g;
          c.beginPath();
          c.moveTo(0, -48);
          c.bezierCurveTo(36, -18, 32, 31, 0, 48);
          c.bezierCurveTo(-32, 25, -31, -21, 0, -48);
          c.fill();
          c.strokeStyle = "#8c9c6655";
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(0, -45);
          c.lineTo(0, 44);
          c.stroke();
          c.restore();
        }
    },
  );
  leafTexture.hasAlpha = true;
  leaves.albedoTexture = leafTexture;
  leaves.useAlphaFromAlbedoTexture = true;
  for (const [tx, tz, height] of [
    [-7.2, -13.5, 6.7],
    [7.2, 11.7, 7.4],
    [-7.4, 19.7, 7.2],
  ]) {
    const trunk = MeshBuilder.CreateCylinder(
      "Tropical street tree trunk",
      { height, diameterTop: 0.18, diameterBottom: 0.43, tessellation: 12 },
      scene,
    );
    trunk.position.set(tx, height / 2, tz);
    trunk.material = bark;
    shadow.addShadowCaster(trunk);
    for (let branch = 0; branch < 8; branch++) {
      const a = (branch / 8) * Math.PI * 2,
        x = tx + Math.cos(a) * (1.3 + random() * 0.7),
        z = tz + Math.sin(a) * (1.4 + random() * 0.7),
        yy = height - 1 + random() * 1.6;
      rod(
        "Forked tree branch",
        [
          new Vector3(tx, height * 0.56, tz),
          new Vector3(
            tx + Math.cos(a) * 0.6,
            height * 0.86,
            tz + Math.sin(a) * 0.6,
          ),
          new Vector3(x, yy, z),
        ],
        0.045,
        bark,
      );
      for (let j = 0; j < 8; j++) {
        const leaf = MeshBuilder.CreatePlane(
          "Layered tropical foliage sprig",
          {
            width: 1.25 + random() * 0.65,
            height: 1.2 + random() * 0.75,
            sideOrientation: Mesh.DOUBLESIDE,
          },
          scene,
        );
        leaf.position.set(
          x + (random() - 0.5) * 1.7,
          yy + (random() - 0.5) * 1.6,
          z + (random() - 0.5) * 1.7,
        );
        leaf.rotation.set(
          (random() - 0.5) * 2,
          random() * Math.PI * 2,
          (random() - 0.5) * 1.5,
        );
        leaf.material = leaves;
        shadow.addShadowCaster(leaf);
      }
    }
    box("Tree pavement soil opening", tx, 0.197, tz, 0.75, 0.025, 0.75, dust);
  }
  // Fictional layered wall posters preserve the photographic density without copying real political identities.
  const messages = [
    ["পথ চাই!", "সভা নয়, চলাচল"],
    ["আজও আশ্বাস", "আগামীকাল আবার সভা"],
    ["গলির খবর", "চায়ের কাপে আলোচনা"],
  ];
  const posters = messages.map(([title, sub], i) => {
    const m = new StandardMaterial(
      `Fictional Bengali street poster ${i}`,
      scene,
    );
    m.diffuseTexture = signTexture(
      scene,
      title,
      sub,
      ["#ddd3b8", "#426659", "#934936"][i],
      i === 0 ? "#31473c" : "#eae1bf",
      384,
      512,
    );
    m.specularColor = Color3.Black();
    return m;
  });
  for (const side of [-1, 1])
    for (const zBase of [-10.8, 7.2, 15.9])
      for (let i = 0; i < 4; i++) {
        const p = MeshBuilder.CreatePlane(
          "Layered Bengali community poster",
          { width: 0.68, height: 1.05 },
          scene,
        );
        p.position.set(side * 7.978, 1.17 + (i % 2) * 0.21, zBase + i * 0.58);
        p.rotation.y = (side * Math.PI) / 2;
        p.rotation.z = (random() - 0.5) * 0.09;
        p.material = posters[(i + (side > 0 ? 1 : 0)) % posters.length];
      }
  // Short utility service boxes, meters and rain streaks give street-level human scale.
  const meter = material(
    scene,
    "Aged service meter housing",
    "#777f73",
    0.78,
    0.4,
  );
  for (const [side, z] of [
    [-1, -9.2],
    [1, -2.3],
    [1, 14.4],
  ]) {
    box("Wall service meter", side * 7.86, 1.75, z, 0.25, 0.48, 0.33, meter);
    box("Meter smoked display", side * 7.71, 1.83, z, 0.025, 0.18, 0.19, iron);
    rod(
      "Wall conduit",
      [
        new Vector3(side * 7.92, 0.25, z + 0.28),
        new Vector3(side * 7.92, 2.6, z + 0.28),
        new Vector3(side * 7.92, 2.6, z + 0.7),
      ],
      0.018,
      iron,
    );
  }
}
