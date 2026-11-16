import { streetHeightAt } from "@neta/shared";
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
import type { BoardingVehicle } from "./boarding";

export type BoardingQaObstacle = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
};
export type BoardingQaBlockers = {
  /** This stable array is empty when the visible barricades are disabled. */
  obstacles: BoardingQaObstacle[];
  setEnabled(enabled: boolean): void;
  dispose(): void;
};

/** Deliberate, visible QA fixture for a parked vehicle's blocked-exit retry.
 * It is disabled on creation and belongs only in an explicitly enabled QA view.
 * The original welded roadside rails use Bengali labels rather than invisible
 * test collisions, and share the same footprint data used by world clearance. */
export function createBoardingQaBlockers(
  scene: Scene,
  shadow: ShadowGenerator,
  vehicle: BoardingVehicle,
): BoardingQaBlockers {
  const roots: TransformNode[] = [],
    meshes: Mesh[] = [],
    obstacles: BoardingQaObstacle[] = [];
  const footprints: BoardingQaObstacle[] = [];
  let disposed = false;
  // Keep the wear pattern deterministic for repeatable visual QA.
  let wearSeed = 19075;
  const random = () => {
    wearSeed = (wearSeed * 1664525 + 1013904223) >>> 0;
    return wearSeed / 4294967296;
  };
  const enamel = material(
    scene,
    "QA barricade worn yellow enamel",
    "#ffffff",
    0.67,
    0.45,
  );
  enamel.albedoTexture = texture(
    scene,
    "Original scratched yellow rail paint",
    256,
    128,
    (c) => {
      c.fillStyle = "#c9a13d";
      c.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 500; i++) {
        c.fillStyle = i % 3 ? "#655a3f66" : "#d9d4bd88";
        c.fillRect(
          random() * 256,
          random() * 128,
          1 + random() * 7,
          0.5 + random() * 2,
        );
      }
    },
  );
  const iron = material(
    scene,
    "QA barricade exposed welded steel",
    "#ffffff",
    0.75,
    0.75,
  );
  iron.albedoTexture = texture(
    scene,
    "Original brushed dusty steel",
    128,
    128,
    (c) => {
      c.fillStyle = "#45504b";
      c.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 128; y++) {
        c.fillStyle = `rgba(180,180,157,${random() * 0.18})`;
        c.fillRect(0, y, 128, 1);
      }
    },
  );
  const caution = material(
    scene,
    "QA barricade chipped black yellow warning plate",
    "#ffffff",
    0.72,
    0.42,
  );
  caution.albedoTexture = texture(
    scene,
    "Original diagonal roadside caution paint",
    256,
    128,
    (c) => {
      c.fillStyle = "#cfaa3d";
      c.fillRect(0, 0, 256, 128);
      c.fillStyle = "#252e2b";
      for (let x = -128; x < 384; x += 64) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x + 32, 0);
        c.lineTo(x + 128, 128);
        c.lineTo(x + 96, 128);
        c.closePath();
        c.fill();
      }
      for (let i = 0; i < 400; i++) {
        c.fillStyle = i % 3 ? "#b5a37e55" : "#6c503e88";
        c.fillRect(
          random() * 256,
          random() * 128,
          1 + random() * 10,
          0.5 + random() * 2,
        );
      }
    },
  );
  const label = material(
    scene,
    "QA barricade Bengali enamel notice",
    "#ffffff",
    0.72,
    0.25,
  );
  label.albedoTexture = signTexture(
    scene,
    "পরীক্ষার বাধা",
    "পথ আটকে আছে",
    "#d0ad51",
    "#24352d",
  );
  const materials = [enamel, iron, caution, label];

  function finish(mesh: Mesh, root: TransformNode, mat: PBRMaterial) {
    mesh.parent = root;
    mesh.material = mat;
    mesh.receiveShadows = true;
    mesh.metadata = { staticBatchExclude: true, boardingQaFixture: true };
    meshes.push(mesh);
    shadow.addShadowCaster(mesh);
    return mesh;
  }
  function bar(
    root: TransformNode,
    name: string,
    a: number[],
    b: number[],
    radius: number,
    mat = enamel,
  ) {
    return finish(
      MeshBuilder.CreateTube(
        name,
        {
          path: [Vector3.FromArray(a), Vector3.FromArray(b)],
          radius,
          tessellation: 8,
          cap: Mesh.CAP_ALL,
        },
        scene,
      ),
      root,
      mat,
    );
  }
  const seen = new Set<string>();
  for (const exit of vehicle.exitPoses()) {
    const key = `${Math.round(exit.x * 1000)},${Math.round(exit.z * 1000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const root = new TransformNode("Visible Bengali boarding QA rail", scene);
    root.position.set(exit.x, streetHeightAt(exit.x, exit.z), exit.z);
    root.rotation.y = exit.yaw;
    root.setEnabled(false);
    roots.push(root);
    footprints.push({ x: exit.x, z: exit.z, w: 0.72, d: 0.72, h: 0.88 });

    for (const side of [-1, 1]) {
      const x = side * 0.285;
      bar(
        root,
        "Barricade upright yellow steel tube",
        [x, 0.045, 0],
        [x, 0.82, 0],
        0.027,
      );
      const foot = finish(
        MeshBuilder.CreateBox(
          "Barricade flat steel stabilising shoe",
          { width: 0.11, height: 0.035, depth: 0.44 },
          scene,
        ),
        root,
        iron,
      );
      foot.position.set(x, 0.025, 0);
      // Diagonal welded braces and exposed collars make a real portable rail.
      for (const z of [-0.18, 0.18])
        bar(
          root,
          "Barricade welded foot brace",
          [x, 0.04, z],
          [x, 0.26, 0],
          0.012,
          iron,
        );
      const cap = finish(
        MeshBuilder.CreateCylinder(
          "Barricade rounded post cap",
          { diameter: 0.065, height: 0.025, tessellation: 12 },
          scene,
        ),
        root,
        iron,
      );
      cap.position.set(x, 0.83, 0);
    }
    bar(
      root,
      "Barricade upper horizontal rail",
      [-0.285, 0.79, 0],
      [0.285, 0.79, 0],
      0.025,
    );
    bar(
      root,
      "Barricade lower horizontal rail",
      [-0.285, 0.3, 0],
      [0.285, 0.3, 0],
      0.022,
    );
    for (const x of [-0.145, 0, 0.145])
      bar(
        root,
        "Barricade slim internal railing",
        [x, 0.3, 0],
        [x, 0.77, 0],
        0.012,
        iron,
      );
    const warningPlate = finish(
      MeshBuilder.CreateBox(
        "Barricade scratched diagonal caution plate",
        { width: 0.65, height: 0.155, depth: 0.036 },
        scene,
      ),
      root,
      caution,
    );
    warningPlate.position.y = 0.67;
    const noticeBack = finish(
      MeshBuilder.CreateBox(
        "Barricade enamel notice backing",
        { width: 0.62, height: 0.19, depth: 0.025 },
        scene,
      ),
      root,
      iron,
    );
    noticeBack.position.y = 0.475;
    for (const side of [-1, 1]) {
      const notice = finish(
        MeshBuilder.CreatePlane(
          "পরীক্ষার বাধা — বাংলা ফলক",
          { width: 0.6, height: 0.17 },
          scene,
        ),
        root,
        label,
      );
      notice.position.set(0, 0.475, side * 0.014);
      notice.rotation.y = side === 1 ? Math.PI : 0;
      for (const x of [-0.275, 0.275])
        for (const y of [0.412, 0.538]) {
          const bolt = finish(
            MeshBuilder.CreateSphere(
              "Barricade exposed notice rivet",
              { diameter: 0.014, segments: 6 },
              scene,
            ),
            root,
            iron,
          );
          bolt.position.set(x, y, side * 0.018);
        }
    }
  }
  return {
    obstacles,
    setEnabled(enabled) {
      if (disposed) return;
      for (const root of roots) root.setEnabled(enabled);
      obstacles.splice(0, obstacles.length, ...(enabled ? footprints : []));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      obstacles.length = 0;
      for (const mesh of meshes) shadow.removeShadowCaster(mesh);
      for (const root of roots) root.dispose();
      for (const mat of materials) mat.dispose(true, true);
    },
  };
}
