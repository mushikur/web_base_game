import {
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  TransformNode,
  Vector3,
} from "./engine";
import { material, signTexture, texture } from "./art";

/** Original cloth banner carried by the actual character hand. The wrinkles,
 * hems, crossbar and cord are authored geometry; no animation observer or
 * freestanding portrait substitutes for the rig attachment. */
export function attachWorkerBanner(
  scene: Scene,
  actorRoot: TransformNode,
  shadow: ShadowGenerator,
  slogan: string,
) {
  if (
    !/\p{Script=Bengali}/u.test(slogan) ||
    /\p{Script=Devanagari}|\uFFFD/u.test(slogan) ||
    [...slogan].length > 80
  )
    throw new Error("ব্যানারের স্লোগান সঠিক বাংলায় লিখুন।");
  const leaf = (name: string) => name.slice(name.lastIndexOf("/") + 1);
  const socket = (name: string) =>
    actorRoot
      .getDescendants(false)
      .find(
        (node) => node instanceof TransformNode && leaf(node.name) === name,
      ) as TransformNode | undefined;
  const hand = socket("Hand.L"),
    anchor = hand ?? socket("Forearm.L");
  if (!anchor)
    throw new Error("কর্মীর হাতে ব্যানার ধরার প্রয়োজনীয় অস্থি পাওয়া যায়নি।");

  const prefix = `${actorRoot.name} হাতের ব্যানার`,
    root = new TransformNode(prefix, scene),
    meshes: Mesh[] = [],
    materials: PBRMaterial[] = [],
    textures = new Set<ReturnType<typeof texture>>();
  root.parent = anchor;
  root.position.set(-0.015, hand ? -0.025 : -0.225, 0.045);
  root.rotation.z = 0.055;
  root.metadata = { staticBatchExclude: true, rigSocket: leaf(anchor.name) };
  let disposed = false;
  const makeMaterial = (
    name: string,
    color: string,
    rough = 0.9,
    metal = 0,
  ) => {
    const result = material(scene, `${prefix} ${name}`, color, rough, metal);
    materials.push(result);
    return result;
  };
  const ownTexture = (map: ReturnType<typeof texture>) => {
    textures.add(map);
    return map;
  };
  const wood = makeMaterial("বাঁশের রং করা দণ্ড", "#b49a61", 0.86),
    cord = makeMaterial("সুতার বাঁধন", "#d2c9a7", 0.98),
    hem = makeMaterial("কাপড়ের সেলাই করা পাড়", "#c6ae70", 0.94),
    metal = makeMaterial("দণ্ডের ছোট ধাতব ঢাকনা", "#8f9280", 0.53, 0.5),
    front = makeMaterial("সামনের হাতে আঁকা কাপড়", "#ffffff", 0.96),
    back = makeMaterial("পেছনের সাদামাটা কাপড়", "#ffffff", 0.98);
  wood.albedoTexture = ownTexture(
    texture(scene, `${prefix} বাঁশের আঁশ`, 128, 512, (c) => {
      c.fillStyle = "#b7a06a";
      c.fillRect(0, 0, 128, 512);
      for (let x = 1; x < 128; x += 3) {
        c.strokeStyle = x % 2 ? "#6c654f66" : "#e1c99466";
        c.lineWidth = x % 5 ? 0.6 : 1.2;
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x + Math.sin(x) * 2, 512);
        c.stroke();
      }
      for (const y of [92, 314]) {
        c.fillStyle = "#70634b88";
        c.fillRect(0, y, 128, 5);
        c.fillStyle = "#e6ce9a88";
        c.fillRect(0, y + 5, 128, 2);
      }
    }),
  );
  front.albedoTexture = ownTexture(
    signTexture(
      scene,
      slogan,
      "পথ খোলা রাখুন • সভা শেষে চা",
      "#315c49",
      "#ead6a3",
      1024,
      512,
    ),
  );
  // A separate blank back face prevents mirrored Bengali lettering when the
  // player walks around the cloth. This is not a double-sided text plane.
  back.albedoTexture = ownTexture(
    texture(scene, `${prefix} পেছনের বোনা কাপড়`, 256, 128, (c) => {
      c.fillStyle = "#61735a";
      c.fillRect(0, 0, 256, 128);
      for (let y = 2; y < 128; y += 3) {
        c.fillStyle = y % 2 ? "#d3c59d22" : "#1d3b3022";
        c.fillRect(0, y, 256, 0.7);
      }
      c.strokeStyle = "#d1bd8a99";
      c.lineWidth = 1;
      c.strokeRect(3, 3, 250, 122);
    }),
  );
  const weave = ownTexture(
    texture(scene, `${prefix} কাপড়ের সূক্ষ্ম বুনন`, 128, 128, (c) => {
      c.fillStyle = "#8080ff";
      c.fillRect(0, 0, 128, 128);
      for (let i = 1; i < 128; i += 2) {
        c.fillStyle = i % 4 ? "#7888fb" : "#8878fb";
        c.fillRect(i, 0, 1, 128);
        c.fillRect(0, i, 128, 1);
      }
    }),
  );
  weave.level = 0.12;
  front.bumpTexture = back.bumpTexture = weave;
  for (const cloth of [front, back]) {
    cloth.backFaceCulling = true;
    cloth.environmentIntensity = 0.7;
  }
  const own = (mesh: Mesh, mat: PBRMaterial, cast = false) => {
    mesh.parent = root;
    mesh.material = mat;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    mesh.metadata = { staticBatchExclude: true, rigSocket: leaf(anchor.name) };
    meshes.push(mesh);
    if (cast) shadow.addShadowCaster(mesh);
    return mesh;
  };
  const rod = (
    name: string,
    a: Vector3,
    b: Vector3,
    radius: number,
    mat: PBRMaterial,
    cast = false,
  ) =>
    own(
      MeshBuilder.CreateTube(
        `${prefix} ${name}`,
        { path: [a, b], radius, tessellation: 10 },
        scene,
      ),
      mat,
      cast,
    );
  rod(
    "বাঁশের খাড়া দণ্ড",
    new Vector3(0, -0.24, 0),
    new Vector3(0, 1.25, 0),
    0.018,
    wood,
    true,
  );
  rod(
    "উপরের আড়াআড়ি বাঁশ",
    new Vector3(-0.025, 1.165, 0),
    new Vector3(1.075, 1.165, 0),
    0.012,
    wood,
    true,
  );
  for (const y of [-0.2, 1.23]) {
    const cap = own(
      MeshBuilder.CreateSphere(
        `${prefix} ধাতব মাথা`,
        { diameter: 0.039, segments: 8 },
        scene,
      ),
      metal,
    );
    cap.position.y = y;
    cap.scaling.y = 0.65;
  }
  for (const y of [-0.07, -0.025, 0.02, 1.125, 1.15, 1.175]) {
    const ring = own(
      MeshBuilder.CreateTorus(
        `${prefix} সুতার প্যাঁচ`,
        { diameter: 0.041, thickness: 0.007, tessellation: 12 },
        scene,
      ),
      cord,
    );
    ring.position.y = y;
  }

  const columns = 16,
    rows = 5,
    points: Vector3[] = [];
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    for (let col = 0; col <= columns; col++) {
      const u = col / columns;
      const sag = Math.sin(u * Math.PI) * 0.025;
      points.push(
        new Vector3(
          0.025 + u * 1.025,
          1.145 - v * 0.5 - sag + v * v * Math.sin(u * Math.PI * 13) * 0.006,
          Math.sin(u * Math.PI * 3 + v * 1.2) * (0.004 + v * 0.011),
        ),
      );
    }
  }
  for (const [side, mat] of [
    [1, front],
    [-1, back],
  ] as const) {
    const positions = points.flatMap((p) => [p.x, p.y, p.z + side * 0.002]),
      uv: number[] = [],
      indices: number[] = [];
    for (let row = 0; row <= rows; row++)
      for (let col = 0; col <= columns; col++)
        uv.push(col / columns, 1 - row / rows);
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        const a = row * (columns + 1) + col,
          b = a + 1,
          c = a + columns + 1,
          d = c + 1;
        if (side === 1) indices.push(a, c, b, b, c, d);
        else indices.push(a, b, c, b, d, c);
      }
    const cloth = own(
      new Mesh(
        `${prefix} ${side === 1 ? "বাংলা লেখা সামনে" : "লেখাহীন পেছন"}`,
        scene,
      ),
      mat,
      side === 1,
    );
    cloth.setVerticesData("position", positions);
    cloth.setVerticesData("uv", uv);
    cloth.setIndices(indices);
    cloth.createNormals(true);
  }
  // Seams follow the actual draped edge rather than floating straight trim.
  for (const edge of [
    points.slice(0, columns + 1),
    points.slice(rows * (columns + 1)),
    Array.from({ length: rows + 1 }, (_, row) => points[row * (columns + 1)]),
    Array.from(
      { length: rows + 1 },
      (_, row) => points[row * (columns + 1) + columns],
    ),
  ])
    own(
      MeshBuilder.CreateTube(
        `${prefix} সেলাই করা পাড়`,
        { path: edge, radius: 0.0045, tessellation: 6 },
        scene,
      ),
      hem,
    );
  // The hanging tie ends make the hand grip and crossbar construction legible.
  own(
    MeshBuilder.CreateTube(
      `${prefix} বাঁধনের ঝুলন্ত সুতা`,
      {
        path: [
          new Vector3(0.02, 1.14, 0.015),
          new Vector3(0.08, 1.06, 0.025),
          new Vector3(0.065, 0.99, 0.02),
        ],
        radius: 0.005,
        tessellation: 6,
      },
      scene,
    ),
    cord,
  );
  // Merge within banner-local space. Baking the actor's hand/world transform
  // here would apply it a second time when the carried object is re-parented.
  const carriedParent = root.parent,
    carriedPosition = root.position.clone(),
    carriedRotation = root.rotation.clone(),
    casters = new Set(shadow.getShadowMap()?.renderList ?? []);
  root.parent = null;
  root.position.setAll(0);
  root.rotation.setAll(0);
  root.computeWorldMatrix(true);
  for (const mat of materials) {
    const parts = meshes.filter((mesh) => mesh.material === mat);
    if (parts.length < 2) continue;
    for (const part of parts) part.computeWorldMatrix(true);
    const merged = Mesh.MergeMeshes(
      parts,
      false,
      true,
      undefined,
      false,
      false,
    );
    if (!merged) continue;
    merged.name = `${prefix} ${mat.name.slice(prefix.length).trim()}`;
    merged.parent = root;
    merged.material = mat;
    merged.receiveShadows = true;
    merged.isPickable = false;
    merged.metadata = {
      staticBatchExclude: true,
      rigSocket: leaf(anchor.name),
    };
    if (parts.some((part) => casters.has(part))) shadow.addShadowCaster(merged);
    for (const part of parts) {
      shadow.removeShadowCaster(part);
      part.dispose(false, false);
    }
  }
  meshes.splice(
    0,
    meshes.length,
    ...root
      .getChildMeshes()
      .filter((mesh): mesh is Mesh => mesh instanceof Mesh),
  );
  root.parent = carriedParent;
  root.position.copyFrom(carriedPosition);
  root.rotation.copyFrom(carriedRotation);
  root.computeWorldMatrix(true);
  return {
    setEnabled(enabled: boolean) {
      if (!disposed) root.setEnabled(enabled);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const mesh of meshes) shadow.removeShadowCaster(mesh);
      root.dispose(false, false);
      for (const mat of materials) mat.dispose(false, false);
      for (const map of textures) map.dispose();
    },
  };
}
