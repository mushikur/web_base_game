import {
  AnimationGroup,
  AbstractMesh,
  AssetContainer,
  Color4,
  HDRCubeTexture,
  DefaultRenderingPipeline,
  SSAO2RenderingPipeline,
  DirectionalLight,
  Engine,
  FreeCamera,
  HavokPlugin,
  HemisphericLight,
  LoadAssetContainerAsync,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  PBRMaterial,
  PhysicsAggregate,
  PhysicsMotionType,
  Quaternion,
  PhysicsShapeType,
  Ray,
  Scene,
  ShadowGenerator,
  TransformNode,
  Vector3,
  VertexBuffer,
} from "./engine";
import "@babylonjs/loaders/glTF";
import HavokPhysics from "@babylonjs/havok";
import havokUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import {
  bn,
  playerCollisionRadius,
  content,
  launchVelocity,
  qualitySettings,
  qualityPreferenceKey,
  parseQualityPreference,
  rewardForHit,
  streetPuddles,
  factorySpawnRegistry,
  parseSpawnRegistry,
  chooseSafeSpawn,
  safeSpawnPoint,
  newTutorialProgress,
  advanceTutorial,
  skipTutorial,
  parseTutorialPreference,
  shouldShowTutorial,
  tutorialPreference,
  type SpawnRegistry,
  type SpawnEnvironment,
  type TutorialProgress,
  type TutorialEvent,
  type Item,
  type Quality,
  type Role,
} from "@neta/shared";
import { createWorld, type World } from "./world";
import { hex, material, texture } from "./art";
import { StreetAudio } from "./audio";
import { dressCharacter } from "./characterStyle";
import { FrameWindow } from "./frameStats";
import { SectorManager } from "./sectors";
import { SectorTraffic } from "./sectorTraffic";
import { MissionDirector } from "./missionWorld";
import { createHarmlessPaperProp } from "./missionProps";
import { movingThrowAim, sweptProjectileDistance } from "./projectileAim";
import { canMoveAroundActors } from "./missionClearance";
import type { MissionMapData } from "./missionMap";
import {
  worldAreas,
  worldBounds,
  worldHeightAt,
  worldSurfaceAt,
  type AreaId,
} from "../../../packages/shared/src/world-layout";
import {
  worldCanWalk,
  segmentClear,
  type NavigationObstacle,
} from "../../../packages/shared/src/navigation";
import { newMatchMissions } from "../../../packages/shared/src/missions";
import { FootContacts, type Contact } from "./footsteps";
import {
  cameraCollider,
  cameraRetractionDistance,
  avatarOpacityForDistance,
  nextAvatarOpacity,
} from "./cameraCollision";
import { BoardingController } from "./boarding";
import {
  civilianPatrol,
  civilianPatrolBounds,
  initialOccupantClearance,
  maximumSimulationStep,
} from "./patrol";
import {
  createBoardingQaBlockers,
  type BoardingQaBlockers,
} from "./boardingQa";

export type Snapshot = {
  missionMap: MissionMapData;
  hasSavedRun: boolean;
  ready: boolean;
  playing: boolean;
  paused: boolean;
  score: number;
  health: number;
  egg: number;
  sandal: number;
  selected: Item;
  message: string;
  subtitle: string;
  target: string;
  targetHealth: number;
  fps: number;
  x: number;
  z: number;
  yaw: number;
  nearPickup: boolean;
  throws: number;
  hits: number;
  civilianHits: number;
  quality: Quality;
  evening: boolean;
  muted: boolean;
  error: string;
  tutorial: TutorialProgress;
  tutorialOpen: boolean;
  dontShowTutorial: boolean;
  mapOpen: boolean;
  markerViewed: boolean;
  selectedMapMarker: "mission" | "vehicle" | "";
  inputMode: "desktop" | "mobile";
  spawnBlocked: boolean;
  spawnId: string;
  nearVehicle: boolean;
  boardingState: string;
  vehiclePrompt: string;
  tutorialGuide: string;
  runEnabled: boolean;
};
const initial: Snapshot = {
  missionMap: {
    selectedId: null,
    activeId: null,
    phases: Object.fromEntries(
      worldAreas.map((a) => [a.id, newMatchMissions().missions[a.id].phase]),
    ) as MissionMapData["phases"],
    completed: 0,
    route: [],
    routeDistance: 0,
    routeMessage: "মানচিত্র থেকে গন্তব্য বেছে নিন।",
    pickups: [],
    vehicles: [],
    safeStarts: [],
    ambulance: null,
    friends: [],
  },
  hasSavedRun: false,
  ready: false,
  playing: false,
  paused: false,
  score: 0,
  health: 100,
  egg: 0,
  sandal: 0,
  selected: "egg",
  message: "ডিম আর স্যান্ডেল কুড়িয়ে রাস্তা খুলুন",
  subtitle: "",
  target: "",
  targetHealth: 100,
  fps: 0,
  x: 0,
  z: -9,
  yaw: 0,
  nearPickup: false,
  throws: 0,
  hits: 0,
  civilianHits: 0,
  quality: "desktop",
  evening: false,
  muted: false,
  error: "",
  tutorial: newTutorialProgress(),
  tutorialOpen: false,
  dontShowTutorial: false,
  mapOpen: false,
  markerViewed: false,
  selectedMapMarker: "",
  inputMode: "desktop",
  spawnBlocked: false,
  spawnId: "",
  nearVehicle: false,
  boardingState: "onFoot",
  vehiclePrompt: "",
  tutorialGuide: "",
  runEnabled: false,
};
export type Actor = {
  shadowMeshes: AbstractMesh[];
  shadowActive: boolean;
  velocity: Vector3;
  release: () => void;
  missionMotion?: string;
  missionMotionTime?: number;
  root: TransformNode;
  groups: AnimationGroup[];
  role: Role;
  name: string;
  health: number;
  base: Vector3;
  phase: number;
  anim: string;
  throwTime: number;
  hitTime: number;
  detail: AbstractMesh[];
  action: "Throw" | "Pickup";
};
type Pickup = {
  root: TransformNode;
  kind: Item;
  origin: Vector3;
  available: boolean;
  cooldown: number;
};
type Projectile = {
  previous: Vector3;
  id: string;
  harmless?: boolean;
  mesh: Mesh;
  body: PhysicsAggregate;
  age: number;
  kind: Item;
  hit: boolean;
};
export class DhakaGame {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: FreeCamera;
  readonly audio = new StreetAudio();
  state = { ...initial };
  world!: World;
  private sectors?: SectorManager;
  private traffic?: SectorTraffic;
  private trafficDrivers = new Set<Actor>();
  private dynamicBodies = new Map<
    string,
    { mesh: Mesh; camera: Mesh; body: PhysicsAggregate }
  >();
  private missions?: MissionDirector;
  private projectileSequence = 0;
  private impactHistory: {
    at: number;
    id: string;
    target: string;
    role: Role;
    item: Item;
    resolve: number;
    score: number;
  }[] = [];
  private readonly runId = crypto.randomUUID();
  private itemMaterials = new Map<string, PBRMaterial>();
  player!: Actor;
  actors: Actor[] = [];
  pickups: Pickup[] = [];
  projectiles: Projectile[] = [];
  colliders: Mesh[] = [];
  private container?: AssetContainer;
  private shadow: ShadowGenerator;
  private sun: DirectionalLight;
  private hemi: HemisphericLight;
  private pipeline: DefaultRenderingPipeline;
  private ambientOcclusion?: SSAO2RenderingPipeline;
  private keys = new Set<string>();
  private time = 0;
  private uiTime = 0;
  private yaw = 0;
  private pitch = 0.18;
  private cameraDistance = 4.8;
  private cameraResolvedDistance = 4.8;
  private avatarOpacity = 1;
  private avatarMeshes: { mesh: AbstractMesh; visibility: number }[] = [];
  private pointer?: {
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    dragged: boolean;
    touch: boolean;
  };
  private touch = { x: 0, y: 0 };
  private running = false;
  private disposed = false;
  private onChange: (s: Snapshot) => void;
  private messageUntil = 0;
  private subtitleUntil = 0;
  private targetUntil = 0;
  private healthTime = 0;
  private simulationActive = false;
  private boardingQa?: BoardingQaBlockers;
  private qaExitBlocked = false;
  private spawnRegistry: SpawnRegistry = factorySpawnRegistry;
  private spawnRegistryOrigin = "factory-bundled";
  private boarding!: BoardingController;
  private tutorialStorage = "neta-tutorial-v1";
  private wheelTime = -1;
  private readonly firstMarker = new Vector3(0, 0.035, 4.65);
  private cleanup: (() => void)[] = [];
  private frameWindow = new FrameWindow();
  private playerMotionsSeen = new Set<string>();
  private footContacts: Record<string, Contact[]> = {};
  private footStates = new WeakMap<
    Actor,
    { tracker: FootContacts; x: number; z: number }
  >();
  constructor(
    readonly canvas: HTMLCanvasElement,
    onChange: (s: Snapshot) => void,
  ) {
    this.onChange = onChange;
    this.state.muted = this.audio.settings.master.muted;
    this.state.inputMode = matchMedia("(pointer: coarse)").matches
      ? "mobile"
      : "desktop";
    this.state.dontShowTutorial = this.readTutorialPreference().dontShowAgain;
    this.audio.setSubtitleHandler((text) => this.subtitle(text));
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: false,
      powerPreference: "high-performance",
    });
    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true;
    this.scene.skipPointerDownPicking = true;
    this.scene.skipPointerUpPicking = true;
    this.scene.collisionsEnabled = true;
    this.camera = new FreeCamera(
      "Third person follow camera",
      new Vector3(1.8, 3, -14),
      this.scene,
    );
    this.camera.minZ = 0.12;
    this.camera.maxZ = 120;
    this.camera.fov = 0.9;
    this.camera.setTarget(new Vector3(0, 1.2, 0));
    this.scene.activeCamera = this.camera;
    this.sun = new DirectionalLight(
      "Humid Dhaka sunlight",
      new Vector3(0.65, -1, 0.5),
      this.scene,
    );
    this.sun.position.set(-25, 40, -20);
    this.sun.intensity = 2.0;
    this.sun.diffuse = hex("#ffe0ad");
    this.sun.shadowMinZ = 1;
    this.sun.shadowMaxZ = 95;
    this.sun.orthoLeft = -30;
    this.sun.orthoRight = 30;
    this.sun.orthoTop = 30;
    this.sun.orthoBottom = -30;
    this.sun.autoUpdateExtends = false;
    this.hemi = new HemisphericLight(
      "Sky bounce",
      new Vector3(0, 1, 0),
      this.scene,
    );
    this.hemi.intensity = 0.32;
    this.hemi.groundColor = hex("#525142");
    this.shadow = new ShadowGenerator(2048, this.sun);
    this.shadow.usePercentageCloserFiltering = true;
    this.shadow.filteringQuality = ShadowGenerator.QUALITY_LOW;
    this.shadow.bias = 0.0006;
    this.shadow.normalBias = 0.025;
    this.pipeline = new DefaultRenderingPipeline(
      "Restrained film tone",
      true,
      this.scene,
      [this.camera],
    );
    this.pipeline.fxaaEnabled = true;
    this.pipeline.bloomEnabled = true;
    this.pipeline.bloomThreshold = 1.5;
    this.pipeline.bloomWeight = 0.1;
    this.pipeline.bloomKernel = 32;
    this.pipeline.samples = 1;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = 1;
    this.scene.imageProcessingConfiguration.exposure = 1.03;
    this.scene.imageProcessingConfiguration.contrast = 1.12;
    this.listen();
    this.engine.runRenderLoop(() => this.frame());
  }
  async init() {
    try {
      await document.fonts.load('700 48px "Noto Sans Bengali"');
      await document.fonts.ready;
      const havok = await HavokPhysics({ locateFile: () => havokUrl });
      if (this.disposed) return;
      this.scene.enablePhysics(
        new Vector3(0, -9.81, 0),
        new HavokPlugin(true, havok),
      );
      this.world = createWorld(this.scene, this.shadow);
      this.audio.setObstacles(this.world.obstacles);
      await this.environment();
      this.mergeArchitecture();
      this.physics();
      this.container = await LoadAssetContainerAsync(
        "/assets/models/dhaka-character.glb",
        this.scene,
      );
      if (this.disposed) return;
      const contactResponse = await fetch("/assets/models/foot-contacts.json");
      if (!contactResponse.ok)
        throw new Error("Animation contact calibration is missing.");
      this.footContacts = (await contactResponse.json()).contacts;
      const missionContacts = await fetch(
        "/assets/models/mission-foot-contacts.json",
      );
      if (!missionContacts.ok)
        throw new Error("Mission animation contact calibration is missing.");
      Object.assign(this.footContacts, (await missionContacts.json()).contacts);
      this.player = this.actor(
        "সজল পথিক",
        "civilian",
        new Vector3(0, 0, -9),
        "#ac5933",
      );
      this.avatarMeshes = this.player.root
        .getChildMeshes()
        .map((mesh) => ({ mesh, visibility: mesh.visibility }));
      this.actors.push(
        this.actor(
          content.leader,
          "leader",
          new Vector3(1.8, 0.46, 10.6),
          "#e5d9ae",
        ),
      );
      [
        new Vector3(-1.8, 0, 7.8),
        new Vector3(3.3, 0, 7.4),
        new Vector3(0.1, 0, 6.6),
      ].forEach((p, i) =>
        this.actors.push(
          this.actor(
            content.workers[i],
            "worker",
            p,
            i === 1 ? "#6f433a" : "#47776d",
          ),
        ),
      );
      [
        new Vector3(-6.1, 0.2, -7),
        new Vector3(6.3, 0.2, 5.8),
        new Vector3(-6.1, 0.2, 8),
        new Vector3(6.4, 0.2, -10),
        new Vector3(-8.4, 0.33, 0.6),
      ].forEach((p, i) =>
        this.actors.push(
          this.actor(
            content.civilians[i],
            "civilian",
            p,
            ["#c9a471", "#c57568", "#a3b4a4", "#6491a0", "#cdbfa0"][i],
          ),
        ),
      );
      this.addPickup("egg", new Vector3(-1.4, 0.15, -5.7));
      this.addPickup("sandal", new Vector3(1.25, 0.15, -3.4));
      this.sectors = new SectorManager(this.scene, this.shadow);
      this.traffic = new SectorTraffic(this.scene, this.shadow, {
        createDriver: (vehicle, pose) => {
          const driver = this.actor(
            vehicle.id.includes("east") ? "চালক রফিক" : "চালক মিলন",
            "civilian",
            Vector3.Zero(),
            "#8f9d86",
          );
          driver.root.parent = vehicle.root;
          driver.root.position.set(pose.x, pose.y, pose.z);
          driver.root.rotation.set(0, pose.yaw, 0);
          for (const group of driver.groups) group.stop();
          const seated = driver.groups.find((g) => g.name.endsWith("Seated"));
          seated?.start(true);
          seated?.setWeightForAllAnimatables(1);
          driver.anim = "Seated";
          this.trafficDrivers.add(driver);
          return () => {
            this.trafficDrivers.delete(driver);
            driver.release();
          };
        },
      });
      this.missions = new MissionDirector({
        scene: this.scene,
        shadow: this.shadow,
        sectors: this.sectors,
        actors: this.actors,
        player: () => this.player,
        createActor: (name, role, p, color) => this.actor(name, role, p, color),
        releaseActor: (actor) => this.releaseActor(actor),
        animate: (actor, dt, moving, run, speed) =>
          this.animate(actor, dt, moving, run, speed),
        obstacles: () => this.navigationObstacles(),
        traffic: () => this.traffic?.obstacles ?? [],
        addPickup: (kind, p) => {
          this.addPickup(kind, p);
          const pickup = this.pickups.at(-1)!;
          return () => {
            this.pickups = this.pickups.filter((v) => v !== pickup);
            pickup.root
              .getChildMeshes()
              .forEach((m) => this.shadow.removeShadowCaster(m));
            pickup.root.dispose(false, false);
          };
        },
        message: (text) => this.message(text),
        subtitle: (text) => this.subtitle(text),
        sound: (cue, point, name) => {
          this.audio.event(cue, point, name ?? "*");
        },
        paper: (from, to) => this.throwPaper(from, to),
      });
      await this.missions.init();
      this.state.hasSavedRun = this.missions.hasSavedRun;
      this.boarding = new BoardingController(
        this.player.root,
        this.world.vehicles,
        {
          canStand: (x, z, ignoredVehicleId) =>
            safeSpawnPoint(
              { x, z },
              this.spawnEnvironment(ignoredVehicleId),
              playerCollisionRadius,
            ),
          heightAt: worldHeightAt,
          message: (text) => this.message(text),
          onEvent: (event, vehicle) => {
            if (event === "interact")
              this.tutorialEvent({ type: "vehicle-interacted" });
            if (event === "entered") {
              this.audio.event("enter", vehicle.seatPose());
              this.tutorialEvent({ type: "vehicle-entered" });
            }
            if (event === "exited") {
              this.audio.event("exit", this.player.root.position);
              this.tutorialEvent({ type: "vehicle-exited" });
            }
          },
        },
      );
      await this.loadSpawnRegistry();
      const marker = MeshBuilder.CreateTorus(
        "প্রথম অভিযানের প্রবেশচিহ্ন",
        { diameter: 1.35, thickness: 0.075, tessellation: 40 },
        this.scene,
      );
      marker.position.copyFrom(this.firstMarker);
      marker.material = material(
        this.scene,
        "অভিযানের সোনালি চিহ্ন",
        "#e8b84d",
        0.45,
      );
      marker.isPickable = false;
      this.dust();
      let preference: ReturnType<typeof parseQualityPreference> = null;
      try {
        preference = parseQualityPreference(
          localStorage.getItem(qualityPreferenceKey),
        );
      } catch {
        /* Device storage can be unavailable. */
      }
      this.setQuality(
        preference?.profile ?? (innerWidth < 760 ? "mobile" : "desktop"),
        false,
      );
      this.state.ready = true;
      this.emit();
    } catch (e) {
      console.error(e);
      this.state.error = "গলিটা খুলতে সমস্যা হয়েছে। আবার চেষ্টা করুন।";
      this.emit();
    }
  }
  private async environment() {
    await new Promise<void>((resolve, reject) => {
      const env = new HDRCubeTexture(
        "/assets/environment/dhaka-daylight-sky-1k.hdr",
        this.scene,
        128,
        false,
        true,
        false,
        true,
        () => resolve(),
        (message) => reject(new Error(message ?? "HDR lighting load failed")),
      );
      env.name = "Locally bundled CC0 daylight HDR probe";
      env.rotationY = 0.9;
      this.scene.environmentTexture = env;
      this.scene.environmentIntensity = 0.65;
      const sky = this.scene.createDefaultSkybox(env, true, 400, 0, false);
      if (sky) {
        sky.name = "Dhaka daylight atmosphere";
        sky.isPickable = false;
        sky.metadata = { staticBatchExclude: true };
      }
    });
  }
  private mergeArchitecture() {
    const map = new Map<PBRMaterial, Mesh[]>();
    const originalCasters = new Set(
      this.shadow.getShadowMap()?.renderList ?? [],
    );
    const excluded = new Set(this.world.lamps);
    for (const m of [...this.scene.meshes]) {
      if (
        !(m instanceof Mesh) ||
        !m.material ||
        !(m.material instanceof PBRMaterial) ||
        m.getTotalVertices() === 0 ||
        excluded.has(m) ||
        m.metadata?.staticBatchExclude
      )
        continue;
      m.computeWorldMatrix(true);
      const list = map.get(m.material) ?? [];
      list.push(m);
      map.set(m.material, list);
    }
    for (const [mat, list] of map) {
      if (list.length < 2) continue;
      const merged = Mesh.MergeMeshes(
        list,
        true,
        true,
        undefined,
        false,
        false,
      );
      if (merged) {
        merged.name = `Detailed street — ${mat.name}`;
        merged.receiveShadows = true;
        merged.freezeWorldMatrix();
        if (list.some((mesh) => originalCasters.has(mesh)))
          this.shadow.addShadowCaster(merged);
      }
    }
  }
  private physics() {
    const ground = MeshBuilder.CreateBox(
      "Hidden physics ground",
      { width: 180, height: 0.3, depth: 150 },
      this.scene,
    );
    ground.position.set(15, -0.19, 45);
    ground.visibility = 0;
    ground.isPickable = false;
    new PhysicsAggregate(
      ground,
      PhysicsShapeType.BOX,
      { mass: 0, restitution: 0.12 },
      this.scene,
    );
    for (const o of this.world.obstacles) {
      const h = o.h ?? 9;
      const m = MeshBuilder.CreateBox(
        "Hidden simple architecture collider",
        { width: o.w, height: h, depth: o.d },
        this.scene,
      );
      m.position.set(o.x, h / 2, o.z);
      m.visibility = 0;
      m.isPickable = false;
      m.checkCollisions = true;
      const vehicle = this.world.vehicles.find(
        (vehicle) => vehicle.footprint === o,
      );
      if (vehicle) m.metadata = { vehicleId: vehicle.id };
      new PhysicsAggregate(
        m,
        PhysicsShapeType.BOX,
        { mass: 0, restitution: 0.15 },
        this.scene,
      );
      this.colliders.push(m);
      if (vehicle) {
        const proxy = cameraCollider(this.scene, {
          name: vehicle.id,
          x: o.x,
          y: h / 2,
          z: o.z,
          w: o.w,
          h,
          d: o.d,
        });
        proxy.metadata = { ...proxy.metadata, vehicleId: vehicle.id };
        this.colliders.push(proxy);
      }
    }
    // Authored thin walls/columns do not belong in the broad walking obstacles.
    // Padded camera-only proxies also catch near-plane grazing along their edges.
    for (const bounds of this.world.cameraObstacles)
      this.colliders.push(cameraCollider(this.scene, bounds));
    for (const [name, x, y, z, w, h, d] of [
      ["Tea roof", -8.7, 3.56, 0, 6.6, 0.18, 8],
      ["Tea awning", -5.25, 2.7, 0, 1.1, 0.2, 6.6],
      ["Tea sign", -5.38, 3.15, 0, 0.16, 1.05, 6.85],
    ] as const) {
      const mesh = MeshBuilder.CreateBox(
        `Hidden camera collider ${name}`,
        { width: w, height: h, depth: d },
        this.scene,
      );
      mesh.position.set(x, y, z);
      mesh.visibility = 0;
      mesh.isPickable = false;
      this.colliders.push(mesh);
    }
  }
  private navigationObstacles(ignoredVehicleId?: string): NavigationObstacle[] {
    const ignored = this.world.vehicles.find((v) => v.id === ignoredVehicleId);
    return [
      ...this.world.obstacles,
      ...(this.sectors?.allObstacles ?? []),
    ].filter(
      (o) =>
        o !== ignored?.footprint && (!("id" in o) || o.id !== ignoredVehicleId),
    );
  }
  private releaseActor(actor: Actor) {
    const index = this.actors.indexOf(actor);
    if (index >= 0) this.actors.splice(index, 1);
    actor.release();
  }
  private updateSectors() {
    if (!this.sectors || !this.player) return;
    const boarded = this.boarding?.activeVehicle?.id;
    const vehicleArea = worldAreas.find((a) => boarded?.startsWith(a.id));
    const changes = this.sectors.update(this.player.root.position, [
      ...(this.missions?.pins ?? []),
      ...(vehicleArea ? [vehicleArea.id] : []),
    ]);
    for (const id of changes.loaded) {
      const handle = this.sectors.handles.find((h) => h.id === id)!;
      this.world.vehicles.push(...handle.parkedVehicles);
      const meshes: Mesh[] = [],
        bodies: PhysicsAggregate[] = [];
      for (const o of handle.obstacles) {
        const h = o.h ?? 8;
        const mesh = MeshBuilder.CreateBox(
          `Hidden sector collider ${id}`,
          { width: o.w, height: h, depth: o.d },
          this.scene,
        );
        mesh.position.set(o.x, h / 2, o.z);
        if (handle.parkedVehicles.some((v) => v.id === o.id))
          mesh.metadata = { vehicleId: o.id };
        mesh.visibility = 0;
        mesh.isPickable = false;
        bodies.push(
          new PhysicsAggregate(
            mesh,
            PhysicsShapeType.BOX,
            { mass: 0, restitution: 0.15 },
            this.scene,
          ),
        );
        meshes.push(mesh);
        this.colliders.push(mesh);
      }
      if (id === "road:north-link") {
        const ramp = MeshBuilder.CreateBox(
          "Hidden speech access ramp physics",
          { width: 1.29, height: 0.08, depth: 1.4 },
          this.scene,
        );
        ramp.position.set(4.4, 0.215, 10.6);
        ramp.rotation.z = -Math.atan2(0.46, 1.2);
        ramp.visibility = 0;
        ramp.isPickable = false;
        bodies.push(
          new PhysicsAggregate(
            ramp,
            PhysicsShapeType.BOX,
            { mass: 0, friction: 0.8 },
            this.scene,
          ),
        );
        meshes.push(ramp);
      }
      for (const o of handle.cameraObstacles) {
        const mesh = cameraCollider(this.scene, o);
        if (handle.parkedVehicles.some((v) => v.id === o.name))
          mesh.metadata = { ...mesh.metadata, vehicleId: o.name };
        meshes.push(mesh);
        this.colliders.push(mesh);
      }
      handle.own(() => {
        for (const body of bodies) body.dispose();
        for (const mesh of meshes) mesh.dispose();
        this.colliders = this.colliders.filter((m) => !meshes.includes(m));
        for (const vehicle of handle.parkedVehicles) {
          const at = this.world.vehicles.indexOf(vehicle);
          if (at >= 0) this.world.vehicles.splice(at, 1);
        }
      });
    }
    if (changes.loaded.length || changes.released.length)
      this.audio.setObstacles(this.navigationObstacles());
  }
  private updateDynamicColliders() {
    const vehicles = [
      ...(this.traffic?.poses ?? []).map((v) => ({
        ...v,
        y: 0,
        w: 1.6,
        d: 2.9,
        h: 1.9,
      })),
      ...(this.missions?.dynamicVehicles ?? []),
    ];
    const ids = new Set(vehicles.map((v) => v.id));
    for (const [id, entry] of this.dynamicBodies)
      if (!ids.has(id)) {
        entry.body.dispose();
        entry.mesh.dispose();
        entry.camera.dispose();
        this.colliders = this.colliders.filter((m) => m !== entry.camera);
        this.dynamicBodies.delete(id);
      }
    for (const v of vehicles) {
      const pos = new Vector3(v.x, v.y + v.h / 2, v.z),
        rotation = Quaternion.FromEulerAngles(0, v.yaw, 0);
      let entry = this.dynamicBodies.get(v.id);
      if (!entry) {
        const mesh = MeshBuilder.CreateBox(
          `Hidden animated vehicle ${v.id}`,
          { width: v.w, height: v.h, depth: v.d },
          this.scene,
        );
        mesh.position.copyFrom(pos);
        mesh.rotationQuaternion = rotation;
        mesh.visibility = 0;
        mesh.isPickable = false;
        const body = new PhysicsAggregate(
          mesh,
          PhysicsShapeType.BOX,
          { mass: 0 },
          this.scene,
        );
        body.body.setMotionType(PhysicsMotionType.ANIMATED);
        const camera = MeshBuilder.CreateBox(
          `Hidden moving camera ${v.id}`,
          { width: v.w + 0.5, height: v.h + 0.5, depth: v.d + 0.5 },
          this.scene,
        );
        camera.visibility = 0;
        camera.isPickable = false;
        entry = { mesh, camera, body };
        this.dynamicBodies.set(v.id, entry);
        this.colliders.push(camera);
      }
      entry.body.body.setTargetTransform(pos, rotation);
      entry.camera.position.copyFrom(pos);
      entry.camera.rotationQuaternion = rotation;
      entry.camera.computeWorldMatrix(true);
    }
  }
  private actor(name: string, role: Role, pos: Vector3, color: string): Actor {
    const instance = this.container!.instantiateModelsToScene(
      (n) => `${name}/${n}`,
      false,
      { doNotInstantiate: true },
    );
    const root = new TransformNode(name, this.scene);
    instance.rootNodes.forEach((n) => (n.parent = root));
    root.position.copyFrom(pos);
    const beforeMaterials = new Set(this.scene.materials);
    const detail = dressCharacter(
      this.scene,
      root,
      this.shadow,
      name,
      role,
      color,
    );
    const ownMaterials = this.scene.materials.filter(
      (m) => !beforeMaterials.has(m),
    );
    const groups = instance.animationGroups;
    let released = false;
    for (const g of groups) {
      g.enableBlending = true;
      g.blendingSpeed = 0.1;
      g.speedRatio = g.name.endsWith("Walk")
        ? 1.6
        : g.name.endsWith("Run")
          ? 1.3
          : 1;
      if (g.name.endsWith("Idle")) {
        g.start(true);
        g.setWeightForAllAnimatables(1);
        g.goToFrame(
          [...name].reduce((sum, c) => sum + c.codePointAt(0)!, 0) % 140,
        );
      }
    }
    root.rotation.y = role === "civilian" ? Math.PI * 0.85 : Math.PI;
    return {
      shadowMeshes: root
        .getChildMeshes()
        .filter((m) => this.shadow.getShadowMap()?.renderList?.includes(m)),
      shadowActive: true,
      velocity: Vector3.Zero(),
      release: () => {
        if (released) return;
        released = true;
        for (const mesh of root.getChildMeshes())
          this.shadow.removeShadowCaster(mesh);
        for (const group of groups) group.dispose();
        instance.dispose();
        root.dispose(false, false);
        for (const mat of ownMaterials) mat.dispose(false, false);
      },
      root,
      groups,
      role,
      name,
      health: 100,
      base: pos.clone(),
      phase: Math.random() * 6,
      anim: "Idle",
      throwTime: 0,
      hitTime: 0,
      detail,
      action: "Throw",
    };
  }
  private animate(
    a: Actor,
    dt: number,
    moving = false,
    run = false,
    speed = run ? 4.5 : 2.25,
  ) {
    let name =
      a.hitTime > 0
        ? "Hit"
        : a.throwTime > 0
          ? a.action
          : moving
            ? run
              ? "Run"
              : "Walk"
            : "Idle";
    if (a === this.player && this.boarding?.motion) name = this.boarding.motion;
    if (a.missionMotion) name = a.missionMotion;
    else if (a.health <= 0) name = "Idle";
    a.throwTime = Math.max(0, a.throwTime - dt);
    a.hitTime = Math.max(0, a.hitTime - dt);
    for (const group of a.groups) {
      const target = group.name.endsWith(name) ? 1 : 0;
      if (target && name === "Walk")
        group.speedRatio = Math.max(0.1, speed / 1.4);
      if (target && !group.isStarted) {
        group.start(name !== "EnterVehicle" && name !== "ExitVehicle");
        group.setWeightForAllAnimatables(0);
      }
      if (
        target &&
        a === this.player &&
        (name === "EnterVehicle" || name === "ExitVehicle")
      ) {
        if (a.anim !== name) group.reset();
        const fps = group.targetedAnimations[0]?.animation.framePerSecond ?? 60;
        group.goToFrame(
          Math.min(group.to, group.from + this.boarding.animationTime * fps),
        );
      }
      if (target && a.missionMotionTime !== undefined) {
        const fps = group.targetedAnimations[0]?.animation.framePerSecond ?? 60;
        const span = Math.max(1, group.to - group.from);
        const once = [
          "Defeated",
          "EnterVehicle",
          "ExitVehicle",
          "Loading",
          "EggReact",
          "SandalReact",
        ].includes(name);
        group.goToFrame(
          group.from +
            (once
              ? Math.min(span, a.missionMotionTime * fps)
              : (a.missionMotionTime * fps) % span),
        );
      }
      const old = group.animatables[0]?.weight ?? 0;
      const weight = old + (target - old) * Math.min(1, dt * 12);
      group.setWeightForAllAnimatables(weight);
      if (!target && weight < 0.01 && group.isStarted) group.stop();
    }
    a.anim = name;
    if (a === this.player) this.playerMotionsSeen.add(name);
  }
  private itemMaterial(name: string, color: string, roughness = 0.8) {
    let mat = this.itemMaterials.get(name);
    if (!mat) {
      mat = material(this.scene, name, color, roughness);
      this.itemMaterials.set(name, mat);
    }
    return mat;
  }
  private item(kind: Item, position: Vector3): Mesh {
    if (kind === "egg") {
      const egg = MeshBuilder.CreateSphere(
        "Textured egg",
        { diameterX: 0.136, diameterY: 0.2048, diameterZ: 0.136, segments: 20 },
        this.scene,
      );
      egg.position.copyFrom(position);
      egg.material = this.itemMaterial("Egg shell", "#e8ddbc", 0.75);
      return egg;
    }
    const shape = [
      new Vector3(-0.065, 0, -0.14),
      new Vector3(0.062, 0, -0.14),
      new Vector3(0.078, 0, 0.11),
      new Vector3(0.052, 0, 0.19),
      new Vector3(-0.043, 0, 0.2),
      new Vector3(-0.078, 0, 0.1),
    ];
    const positions = [
        0,
        0.01,
        0,
        ...shape.flatMap((p) => [p.x, 0.01, p.z]),
        0,
        -0.02,
        0,
        ...shape.flatMap((p) => [p.x, -0.02, p.z]),
      ],
      indices = [];
    for (let i = 0; i < 6; i++) {
      const n = (i + 1) % 6;
      indices.push(
        0,
        i + 1,
        n + 1,
        7,
        n + 8,
        i + 8,
        i + 1,
        i + 8,
        n + 8,
        i + 1,
        n + 8,
        n + 1,
      );
    }
    const m = new Mesh("Rubber sandal moulded sole", this.scene);
    m.setVerticesData(VertexBuffer.PositionKind, positions);
    m.setIndices(indices);
    m.createNormals(true);
    m.material = this.itemMaterial("Sandal turquoise rubber", "#326c65", 0.84);
    m.position.copyFrom(position);
    const strap = MeshBuilder.CreateTube(
      "Sandal Y strap",
      {
        path: [
          new Vector3(-0.065, 0.025, -0.03),
          new Vector3(0, 0.08, 0.08),
          new Vector3(0.065, 0.025, -0.03),
        ],
        radius: 0.014,
        tessellation: 8,
      },
      this.scene,
    );
    strap.parent = m;
    strap.material = this.itemMaterial("Sandal strap", "#a94e30");
    return m;
  }
  private addPickup(kind: Item, p: Vector3) {
    const root = new TransformNode(`${kind} pickup`, this.scene);
    root.position.copyFrom(p);
    for (let i = 0; i < 3; i++) {
      const mesh = this.item(
        kind,
        new Vector3((i - 1) * 0.19, 0, (i % 2) * 0.15),
      );
      mesh.parent = root;
      mesh.scaling.scaleInPlace(1.6);
      this.shadow.addShadowCaster(mesh);
    }
    this.pickups.push({
      root,
      kind,
      origin: p.clone(),
      available: true,
      cooldown: 0,
    });
  }
  private dust() {
    const ps = new ParticleSystem("Sunlit street dust", 40, this.scene);
    ps.particleTexture = texture(this.scene, "Dust mote", 32, 32, (c) => {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, "#ffe5aa");
      g.addColorStop(1, "#ffe5aa00");
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
    });
    ps.emitter = new Vector3(0, 1.2, 0);
    ps.minEmitBox = new Vector3(-5, 0, -15);
    ps.maxEmitBox = new Vector3(5, 4, 23);
    ps.color1 = new Color4(0.8, 0.73, 0.47, 0.08);
    ps.color2 = new Color4(0.7, 0.6, 0.35, 0.04);
    ps.colorDead = new Color4(0.7, 0.6, 0.4, 0);
    ps.minSize = 0.015;
    ps.maxSize = 0.045;
    ps.minLifeTime = 4;
    ps.maxLifeTime = 8;
    ps.emitRate = 4;
    ps.direction1 = new Vector3(0.03, 0.03, 0.06);
    ps.direction2 = new Vector3(0.12, 0.1, 0.15);
    ps.gravity = new Vector3(0, 0, 0);
    ps.start();
  }
  start(resume = false) {
    if (!this.state.ready) return;
    this.restoreAvatarVisibility();
    const { quality, evening, inputMode } = this.state;
    const preference = this.readTutorialPreference();
    const muted = this.audio.settings.master.muted;
    this.state = {
      ...initial,
      ready: true,
      playing: true,
      quality,
      evening,
      muted,
      inputMode,
      tutorial: newTutorialProgress(),
      tutorialOpen: shouldShowTutorial(preference),
      dontShowTutorial: preference.dontShowAgain,
    };
    this.boardingQa?.setEnabled(false);
    this.qaExitBlocked = false;
    this.boarding.reset();
    this.player.root.rotation.set(0, 0, 0);
    this.player.throwTime = 0;
    this.player.hitTime = 0;
    for (const a of this.actors) {
      a.health = 100;
      a.root.setEnabled(true);
      a.velocity.setAll(0);
      a.root.position.copyFrom(a.base);
      if (a.role === "civilian" && a.name !== content.civilians[4])
        a.root.position.z = civilianPatrol(a.base.z, this.time, a.phase).z;
      a.root.rotation.z = 0;
    }
    for (const p of this.pickups) {
      p.available = true;
      p.cooldown = 0;
      p.root.setEnabled(true);
    }
    for (const p of this.projectiles) {
      p.body.dispose();
      p.mesh.getChildMeshes().forEach((m) => m.dispose());
      p.mesh.dispose();
    }
    this.projectiles = [];
    this.impactHistory = [];
    const environment = this.spawnEnvironment();
    const spawn = chooseSafeSpawn(this.spawnRegistry, {
      ...environment,
      obstacles: [
        ...environment.obstacles,
        ...this.actors
          .filter(
            (actor) =>
              actor.role === "civilian" && actor.name !== content.civilians[4],
          )
          .map((actor) => civilianPatrolBounds(actor.base.x, actor.base.z)),
      ],
      occupants: environment.occupants.map((occupant) => ({
        ...occupant,
        radius: occupant.radius + initialOccupantClearance,
      })),
    });
    if (!spawn) {
      this.clearControls();
      this.simulationActive = false;
      this.state.spawnBlocked = true;
      this.state.message = "নিরাপদ জায়গা খালি নেই। আবার চেষ্টা করুন।";
      this.emit();
      return;
    }
    this.player.root.position.set(
      spawn.x,
      worldHeightAt(spawn.x, spawn.z),
      spawn.z,
    );
    this.player.root.rotation.y = spawn.facing;
    this.missions?.reset(resume);
    this.state.spawnId = spawn.id;
    this.resetBenchmark();
    this.playerMotionsSeen.clear();
    this.state.paused = false;
    this.simulationActive = true;
    this.yaw = spawn.facing;
    this.pitch = 0.18;
    this.cameraDistance = 4.8;
    this.clearControls();
    void this.audio
      .start("exploration")
      .catch(() =>
        this.message("শব্দ চালু করা যায়নি। সেটিংস থেকে আবার চেষ্টা করুন।"),
      );
    this.audio.setMuted(this.state.muted);
    this.message("সজল, আগে ডিম আর স্যান্ডেল কুড়িয়ে নিন।");
    this.subtitle("চা-মামা: চা খাইয়া যান, প্রতিশ্রুতি ফ্রি!");
    this.emit();
    this.canvas.focus();
  }
  pause() {
    if (!this.state.playing || this.state.spawnBlocked) return;
    if (this.state.paused && this.state.health === 0) {
      const failed = worldAreas.find(
        (a) => this.missions?.state.missions[a.id].phase === "restartable",
      );
      if (failed) {
        this.retryMission(failed.id);
        return;
      }
      this.start();
      return;
    }
    this.state.paused = !this.state.paused;
    this.simulationActive = !this.state.paused;
    this.clearControls();
    this.audio.pause(this.state.paused);
    this.emit();
  }
  home() {
    this.restoreAvatarVisibility();
    this.state.playing = false;
    this.state.paused = false;
    this.simulationActive = false;
    this.clearControls();
    this.audio.setMusicContext("menu");
    this.audio.pause(false);
    this.emit();
  }
  private readTutorialPreference() {
    try {
      return parseTutorialPreference(
        localStorage.getItem(this.tutorialStorage),
      );
    } catch {
      return parseTutorialPreference(null);
    }
  }
  private saveTutorialPreference() {
    try {
      localStorage.setItem(
        this.tutorialStorage,
        JSON.stringify(
          tutorialPreference(
            this.state.tutorial,
            this.state.dontShowTutorial,
            this.readTutorialPreference(),
          ),
        ),
      );
    } catch {
      /* Device preferences can be unavailable without blocking play. */
    }
  }
  private async loadSpawnRegistry() {
    const abort = new AbortController();
    const timeout = window.setTimeout(() => abort.abort(), 2400);
    try {
      const response = await fetch("/api/spawns", {
        signal: abort.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Spawn publication unavailable");
      this.spawnRegistry = parseSpawnRegistry(await response.json());
      this.spawnRegistryOrigin = "server-" + this.spawnRegistry.source;
    } catch {
      this.spawnRegistry = factorySpawnRegistry;
      this.spawnRegistryOrigin = "factory-bundled";
    } finally {
      clearTimeout(timeout);
    }
  }
  setQaExitBlocked(enabled: boolean) {
    if (!new URLSearchParams(location.search).has("qa")) return;
    if (enabled && this.boarding.state !== "seated") return;
    this.boardingQa ??= createBoardingQaBlockers(
      this.scene,
      this.shadow,
      this.world.vehicles[0],
    );
    this.boardingQa.setEnabled(enabled);
    this.qaExitBlocked = enabled;
    this.message(
      enabled
        ? "পরীক্ষার জন্য নামার পথে রেলিং রাখা হয়েছে।"
        : "পরীক্ষার রেলিং সরানো হয়েছে। আবার নামতে পারেন।",
    );
    this.emit();
    this.canvas.focus();
  }
  private spawnEnvironment(ignoredVehicleId?: string): SpawnEnvironment {
    return {
      bounds: worldBounds,
      obstacles: [
        ...this.navigationObstacles(ignoredVehicleId),
        ...(this.boardingQa?.obstacles ?? []),
      ],
      // The visible puddle's irregular rim extends up to 25% in x.
      water: streetPuddles.map(([x, z, rx, rz]) => ({
        x,
        z,
        rx: rx * 1.25,
        rz,
      })),
      occupants: [
        ...this.actors
          .filter((actor) => actor.health > 0 && actor.root.isEnabled())
          .map((actor) => ({
            x: actor.root.position.x,
            z: actor.root.position.z,
            radius: 0.58,
            kind: "npc" as const,
          })),
        { x: 1.05, z: 9.2, radius: 4.5, kind: "crowd" as const },
      ],
      canNavigate: (x, z, radius) =>
        worldCanWalk(x, z, this.navigationObstacles(ignoredVehicleId), radius),
    };
  }
  private tutorialEvent(event: TutorialEvent) {
    if (!this.state.tutorialOpen || !this.simulationActive) return;
    this.state.tutorial = advanceTutorial(this.state.tutorial, event);
    if (this.state.tutorial.status === "completed") {
      this.state.tutorialOpen = false;
      this.saveTutorialPreference();
      this.message("শেখা শেষ! এবার নিজের মতো গলি ঘুরে দেখুন।");
    }
  }
  setDontShowTutorial(value: boolean) {
    this.state.dontShowTutorial = value;
    this.saveTutorialPreference();
    this.emit();
  }
  skipTutorial() {
    this.canvas.focus();
    this.state.tutorial = skipTutorial(this.state.tutorial);
    this.state.tutorialOpen = false;
    this.saveTutorialPreference();
    this.message("শেখা এড়িয়ে গেছেন। সেটিংস থেকে আবার শিখতে পারবেন।");
    this.emit();
  }
  replayTutorial() {
    if (!this.state.playing || this.state.spawnBlocked) return false;
    if (this.state.health <= 0) {
      this.message("আগে নতুন করে খেলুন, তারপর শেখা আবার চালু করুন।");
      this.emit();
      return false;
    }
    if (this.boarding.locked) {
      this.message("আগে সিএনজি থেকে নিরাপদে নামুন, তারপর শেখা আবার শুরু করুন।");
      this.emit();
      return false;
    }
    this.clearControls();
    this.state.tutorial = newTutorialProgress();
    this.state.tutorialOpen = true;
    this.state.mapOpen = false;
    this.message(
      "শেখা আবার শুরু। আপনার পয়েন্ট, জিনিস ও গলির অগ্রগতি রাখা হয়েছে।",
    );
    this.emit();
    return true;
  }
  map(open = !this.state.mapOpen) {
    if (!this.simulationActive) return;
    this.clearControls();
    this.state.mapOpen = open;
    if (open) this.tutorialEvent({ type: "map-opened" });
    this.emit();
  }
  viewFirstMarker() {
    if (!this.simulationActive || !this.state.mapOpen) return;
    this.state.markerViewed = true;
    this.state.selectedMapMarker = "mission";
    this.missions?.select("promise-junction");
    this.audio.event("marker", this.firstMarker);
    this.tutorialEvent({ type: "mission-viewed" });
    this.emit();
  }
  viewVehicleMarker() {
    if (!this.simulationActive || !this.state.mapOpen) return;
    this.state.selectedMapMarker = "vehicle";
    this.emit();
  }
  selectMission(id: AreaId) {
    if (!this.simulationActive || !this.state.mapOpen) return;
    this.missions?.select(id);
    this.state.selectedMapMarker = "mission";
    this.emit();
  }
  retryMission(id: AreaId) {
    if (!this.missions?.retry(id)) return;
    this.state.health = 100;
    this.state.paused = false;
    this.simulationActive = true;
    this.audio.pause(false);
    this.clearControls();
    this.emit();
    this.canvas.focus();
  }
  vehicle() {
    if (!this.simulationActive || this.state.mapOpen) return;
    this.canvas.focus();
    this.clearControls();
    this.boarding.toggle();
    this.emit();
  }
  context() {
    if (!this.simulationActive || this.state.mapOpen) return;
    if (this.boarding.locked || this.boarding.nearVehicle) this.vehicle();
    else this.pickup();
  }
  private clearControls() {
    this.keys.clear();
    this.touch = { x: 0, y: 0 };
    this.running = false;
    this.state.runEnabled = false;
    if (this.pointer && this.canvas.hasPointerCapture(this.pointer.id))
      this.canvas.releasePointerCapture(this.pointer.id);
    this.pointer = undefined;
  }
  input(mode: "desktop" | "mobile") {
    this.state.inputMode = mode;
  }
  setQuality(q: Quality, persist = true) {
    this.resetBenchmark();
    this.state.quality = q;
    const s = qualitySettings[q];
    this.engine.setHardwareScalingLevel(s.scale);
    this.shadow.mapSize = s.shadow;
    this.camera.maxZ = s.view;
    this.pipeline.bloomEnabled = s.bloom;
    this.sectors?.setQuality(s);
    this.traffic?.setQuality(s);
    this.updateActorShadows();
    if (s.ao && this.engine.webGLVersion > 1 && !this.ambientOcclusion) {
      this.ambientOcclusion = new SSAO2RenderingPipeline(
        "Dhaka contact shading",
        this.scene,
        { ssaoRatio: 0.5, blurRatio: 0.5 },
        [this.camera],
      );
      this.ambientOcclusion.radius = 0.55;
      this.ambientOcclusion.totalStrength = 0.65;
      this.ambientOcclusion.samples = 8;
      this.ambientOcclusion.expensiveBlur = false;
      this.ambientOcclusion.maxZ = 45;
      const prepass = this.scene.enablePrePassRenderer();
      if (prepass) prepass.disableGammaTransform = true;
    } else if (!s.ao && this.ambientOcclusion) {
      this.ambientOcclusion.dispose();
      this.ambientOcclusion = undefined;
      this.scene.disablePrePassRenderer();
    }
    const dust = this.scene.particleSystems[0];
    if (dust) dust.emitRate = Math.max(0.5, s.particles / 8);
    if (persist)
      try {
        localStorage.setItem(
          qualityPreferenceKey,
          JSON.stringify({ version: 1, profile: q }),
        );
      } catch {
        /* Quality remains usable without device storage. */
      }
    this.emit();
  }
  setEvening(value: boolean) {
    this.audio.setNight(value);
    this.resetBenchmark();
    this.state.evening = value;
    this.sun.diffuse = hex(value ? "#ffb776" : "#ffe0ad");
    this.sun.intensity = value ? 2.2 : 2;
    this.sun.direction = value
      ? new Vector3(-0.8, -0.38, 0.5)
      : new Vector3(0.65, -1, 0.5);
    this.sun.position = value
      ? new Vector3(35, 23, -25)
      : new Vector3(-25, 40, -20);
    this.hemi.intensity = value ? 0.42 : 0.32;
    this.scene.fogColor = hex(value ? "#9f8582" : "#b5c3bb");
    this.scene.clearColor = value
      ? new Color4(0.57, 0.42, 0.39, 1)
      : new Color4(0.63, 0.73, 0.74, 1);
    this.scene.environmentIntensity = value ? 0.55 : 0.65;
    this.scene.imageProcessingConfiguration.exposure = value ? 1.2 : 1.03;
    this.emit();
  }
  mute() {
    this.state.muted = !this.audio.settings.master.muted;
    this.audio.setMuted(this.state.muted);
    if (!this.state.muted && this.state.playing) void this.audio.start();
    this.emit();
  }
  select(kind: Item) {
    if (!this.simulationActive || this.boarding.locked || this.state.mapOpen)
      return;
    this.canvas.focus();
    const changed = kind !== this.state.selected;
    if (kind !== this.state.selected) this.audio.event("equip");
    this.state.selected = kind;
    this.tutorialEvent({
      type: "item-selected",
      changed,
      owned: this.state[kind] > 0,
    });
    this.emit();
  }
  joystick(x: number, y: number) {
    this.input("mobile");
    if (!this.simulationActive || this.boarding.locked || this.state.mapOpen)
      return;
    this.touch = { x, y };
  }
  run(value = !this.running) {
    this.input("mobile");
    if (!this.simulationActive || this.state.mapOpen) return;
    this.running = value;
    this.state.runEnabled = value;
    this.emit();
  }
  look(dx: number, dy: number) {
    if (!this.simulationActive || this.state.mapOpen) return;
    const before = this.pitch;
    this.yaw += dx * 0.005;
    this.pitch = Math.max(-0.08, Math.min(0.66, this.pitch + dy * 0.003));
    this.tutorialEvent({
      type: "camera",
      radians: Math.hypot(dx * 0.005, this.pitch - before),
    });
  }
  zoom(amount: number) {
    if (!this.simulationActive) return;
    this.cameraDistance = Math.max(
      1.8,
      Math.min(6.5, this.cameraDistance + amount),
    );
  }
  resetBenchmark() {
    this.frameWindow.reset();
  }
  pickup() {
    if (!this.simulationActive || this.boarding.locked || this.state.mapOpen)
      return;
    this.canvas.focus();
    for (const p of this.pickups) {
      if (
        p.available &&
        Vector3.Distance(p.root.position, this.player.root.position) < 2.2
      ) {
        p.available = false;
        p.root.setEnabled(false);
        p.cooldown = 15;
        this.state[p.kind] += 6;
        this.state.selected = p.kind;
        this.player.action = "Pickup";
        this.player.throwTime = 0.85;
        this.player.groups.find((g) => g.name.endsWith("Pickup"))?.reset();
        this.audio.event("pickup", p.origin);
        this.tutorialEvent({ type: "picked-up", quantity: 6 });
        this.message(
          `${content.items[p.kind]} কুড়িয়েছেন! সঙ্গে এখন ${bn(this.state[p.kind])}টি।`,
        );
        this.emit();
        return;
      }
    }
    this.message("ডিম বা স্যান্ডেলের একটু কাছে যান।");
  }
  throw() {
    if (
      !this.simulationActive ||
      this.boarding.locked ||
      this.state.mapOpen ||
      (this.player.throwTime > 0 && this.player.action === "Throw")
    )
      return;
    this.canvas.focus();
    const kind = this.state.selected;
    if (this.state[kind] <= 0) {
      this.message(`${content.items[kind]} নেই! আগে কুড়িয়ে নিন।`);
      return;
    }
    this.state[kind]--;
    this.state.throws++;
    this.tutorialEvent({ type: "item-used", consumed: true });
    this.player.throwTime = 0.8;
    this.player.action = "Throw";
    const throwGroup = this.player.groups.find((g) => g.name.endsWith("Throw"));
    throwGroup?.reset();
    const direction = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const origin = this.player.root.position.add(
      new Vector3(direction.x * 0.5, 1.3, direction.z * 0.5),
    );
    let target = origin.add(direction.scale(9));
    target.y = 0.8;
    const candidates = this.actors
      .filter((a) => a.health > 0 && a.root.isEnabled())
      .map((a) => ({
        a,
        delta: a.root.position.subtract(this.player.root.position),
      }))
      .filter(
        ({ delta }) =>
          delta.length() < 14 &&
          Vector3.Dot(delta.normalizeToNew(), direction) > 0.93,
      )
      .sort((a, b) => a.delta.length() - b.delta.length());
    if (candidates[0])
      target = candidates[0].a.root.position.add(new Vector3(0, 1.0, 0));
    const aim = movingThrowAim(origin, target, candidates[0]?.a.velocity);
    const mesh = this.item(kind, origin);
    const body = new PhysicsAggregate(
      mesh,
      PhysicsShapeType.SPHERE,
      {
        mass: 0.18,
        restitution: 0.15,
        friction: 0.6,
        radius: kind === "egg" ? 0.1024 : 0.18,
      },
      this.scene,
    );
    body.body.setLinearVelocity(
      Vector3.FromArray(
        Object.values(launchVelocity(origin, aim.target, aim.flight)),
      ),
    );
    body.body.setAngularVelocity(new Vector3(7, 2, 4));
    this.projectiles.push({
      previous: origin.clone(),
      id: `${this.runId}:${++this.projectileSequence}`,
      mesh,
      body,
      age: 0,
      kind,
      hit: false,
    });
    this.audio.event("throw", origin);
    this.shadow.addShadowCaster(mesh);
    this.emit();
  }
  message(text: string) {
    this.state.message = text;
    this.messageUntil = this.time + 5;
  }
  private throwPaper(
    from: { x: number; y: number; z: number; yaw: number },
    to: { x: number; z: number },
  ) {
    if (this.state.tutorialOpen) return;
    const origin = new Vector3(from.x, from.y + 1.2, from.z);
    const mesh = createHarmlessPaperProp(this.scene);
    mesh.position.copyFrom(origin);
    const body = new PhysicsAggregate(
      mesh,
      PhysicsShapeType.SPHERE,
      { mass: 0.06, restitution: 0.3, radius: 0.12 },
      this.scene,
    );
    body.body.setLinearVelocity(
      Vector3.FromArray(
        Object.values(launchVelocity(origin, { x: to.x, y: 1, z: to.z }, 0.8)),
      ),
    );
    body.body.setAngularVelocity(new Vector3(5, 4, 2));
    this.projectiles.push({
      previous: origin.clone(),
      id: `${this.runId}:${++this.projectileSequence}`,
      mesh,
      body,
      age: 0,
      kind: "egg",
      hit: false,
      harmless: true,
    });
    this.shadow.addShadowCaster(mesh);
  }
  private subtitle(text: string) {
    this.state.subtitle = text;
    this.subtitleUntil = this.time + 4.5;
  }
  private hit(a: Actor, p: Projectile) {
    p.hit = true;
    if (this.missions && !this.missions.canImpact(a, this.state.tutorialOpen)) {
      this.message("আগে মানচিত্রে এই এলাকা বেছে প্রবেশচিহ্নে পৌঁছান।");
      return;
    }
    const firstHit = a.health === 100;
    a.health = Math.max(0, a.health - (p.kind === "egg" ? 25 : 40));
    this.missions?.impact(a, p.id, p.kind, this.state.tutorialOpen);
    a.hitTime = 0.45;
    a.groups.find((g) => g.name.endsWith("Hit"))?.reset();
    this.state.hits++;
    const reward = rewardForHit(a.role, p.kind);
    this.state.score += reward;
    const impact = p.mesh.position.clone(),
      mouth = Vector3.TransformCoordinates(
        new Vector3(0, 1.606, 0.076),
        a.root.computeWorldMatrix(true),
      ),
      reactions = [p.kind, firstHit ? "firstHit" : "repeatHit"];
    if (a.health <= 0) reactions.push("defeated");
    else if (a.health < 30) reactions.push("lowResolve");
    this.audio.event(p.kind, impact, a.name, "combat");
    this.audio.event("hit", impact, a.name, "combat");
    this.audio.event(reactions, mouth, a.name, "voices");
    if (a.role === "civilian") {
      this.state.civilianHits++;
      this.state.health = Math.max(0, this.state.health - 8);
      this.message(content.civilianWarning);
    } else {
      this.message(`লেগেছে! +${bn(reward)} পয়েন্ট`);
    }
    this.state.target = a.name;
    this.targetUntil = this.time + 4;
    this.state.targetHealth = a.health;
    this.impactHistory.push({
      at: this.time,
      id: p.id,
      target: a.name,
      role: a.role,
      item: p.kind,
      resolve: a.health,
      score: this.state.score,
    });
    if (this.impactHistory.length > 50) this.impactHistory.shift();
    if (a.health <= 0 && a.role !== "leader") {
      a.root.rotation.z = 0.13;
      a.root.position.y = Math.max(0, a.root.position.y - 0.13);
    }
  }
  private frame() {
    if (this.disposed) return;
    const dt = Math.min(
      this.engine.getDeltaTime() / 1000,
      maximumSimulationStep,
    );
    this.time += dt;
    if (this.state.ready) {
      if (!this.state.playing) {
        const t = this.time * 0.025;
        this.camera.position.set(2.2 + Math.sin(t) * 0.5, 3.2, -11.7);
        this.camera.setTarget(new Vector3(-1.7, 1.75, 3.2));
        this.animate(this.player, dt);
      } else if (this.simulationActive) {
        this.updateSectors();
        if (!this.state.mapOpen) this.boarding.tick(dt);
        this.updatePlayer(dt);
        if (!this.state.mapOpen) {
          this.traffic?.tick(
            dt,
            this.player.root.position,
            this.actors
              .filter((a) => a.root.isEnabled())
              .map((a) => a.root.position),
            this.missions?.sirenActive ?? false,
            this.state.tutorialOpen,
            false,
          );
          this.updateActors(dt);
          this.missions?.tick(dt, {
            tutorialSafe: this.state.tutorialOpen,
            paused: this.state.mapOpen,
            playerResolve: this.state.health,
            incoming: this.projectiles.find((v) => !v.harmless)?.mesh.position,
          });
          this.updatePickups(dt);
          this.updateProjectiles(dt);
          this.updateDynamicColliders();
        }
        this.updateCamera(dt);
        if (this.time > this.subtitleUntil) this.state.subtitle = "";
        if (this.time > this.targetUntil) this.state.target = "";
        if (this.time > this.messageUntil)
          this.state.message = "রাস্তা খুলুন, পথচারীদের ছাড়ুন।";
      }
      if (!this.simulationActive) {
        for (const a of [
          ...this.actors,
          ...(this.missions?.medicActors ?? []),
        ]) {
          if (
            !a.root.isEnabled() ||
            (!this.state.playing &&
              Vector3.DistanceSquared(a.root.position, this.camera.position) >
                35 * 35)
          ) {
            for (const group of a.groups) group.stop();
            continue;
          }
          this.animate(a, this.state.paused ? 0 : dt);
        }
      }
      this.scene.physicsEnabled = this.simulationActive && !this.state.mapOpen;
      this.scene.animationsEnabled = !this.state.paused && !this.state.mapOpen;
    }
    this.updateAvatarVisibility(dt);
    this.engine._drawCalls.fetchNewFrame();
    this.scene.render();
    if (this.simulationActive && !this.state.mapOpen) this.updateFootsteps();
    this.audio.tick();
    if (this.state.ready && this.state.playing && !this.state.paused) {
      this.frameWindow.record(
        this.engine.getDeltaTime(),
        document.visibilityState === "visible",
      );
    }
    this.uiTime += dt;
    if (this.uiTime > 0.12) {
      this.uiTime = 0;
      this.state.fps = Math.round(this.engine.getFps());
      this.state.muted = this.audio.settings.master.muted;
      if (this.player) {
        this.state.x = this.player.root.position.x;
        this.state.z = this.player.root.position.z;
        this.state.yaw = this.yaw;
        this.state.nearVehicle = !!this.boarding?.nearVehicle;
        this.state.boardingState = this.boarding?.state ?? "onFoot";
        this.state.vehiclePrompt =
          this.boarding?.state === "seated"
            ? this.state.inputMode === "mobile"
              ? "সিএনজিতে বসেছেন • গাড়ির বোতাম ছুঁয়ে নামুন"
              : "সিএনজিতে বসেছেন • নামতে Tab বা E চাপুন"
            : this.boarding?.locked
              ? "নিরাপদে সিটে যাওয়া বা নামা হচ্ছে…"
              : this.boarding?.nearVehicle
                ? this.state.inputMode === "mobile"
                  ? "গাড়ির বোতাম ছুঁয়ে উঠুন • খালি সিট ১টি"
                  : "Tab চাপুন — গাড়িতে উঠুন • খালি সিট ১টি"
                : "";
        this.state.tutorialGuide = this.tutorialGuide();
      }
      this.emit();
    }
  }
  private updatePlayer(dt: number) {
    if (this.boarding.locked || this.state.mapOpen) {
      this.state.nearPickup = false;
      this.animate(
        this.player,
        dt,
        this.boarding.state === "approach",
        false,
        2.1,
      );
      return;
    }
    const x =
      (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
      (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0) +
      this.touch.x;
    const z =
      (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
      (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0) -
      this.touch.y;
    const moving = Math.hypot(x, z) > 0.1,
      run =
        this.keys.has("ShiftLeft") ||
        this.keys.has("ShiftRight") ||
        this.running;
    const speed = run ? 4.5 : 2.25;
    const scale = Math.max(1, Math.hypot(x, z)),
      dx =
        ((x * Math.cos(this.yaw) + z * Math.sin(this.yaw)) / scale) *
        speed *
        dt,
      dz =
        ((z * Math.cos(this.yaw) - x * Math.sin(this.yaw)) / scale) *
        speed *
        dt;
    const p = this.player.root.position;
    const beforeX = p.x,
      beforeZ = p.z;
    if (moving) {
      const obstacles = [
        ...this.navigationObstacles(),
        ...(this.traffic?.obstacles ?? []),
        ...(this.missions?.dynamicVehicles ?? []).map((v) => ({
          x: v.x,
          z: v.z,
          w: Math.abs(Math.cos(v.yaw)) * v.w + Math.abs(Math.sin(v.yaw)) * v.d,
          d: Math.abs(Math.sin(v.yaw)) * v.w + Math.abs(Math.cos(v.yaw)) * v.d,
        })),
      ];
      const people = [...this.actors, ...(this.missions?.medicActors ?? [])]
        .filter((a) => a.root.isEnabled())
        .map((a) => a.root.position);
      if (
        segmentClear(p, { x: p.x + dx, z: p.z }, obstacles) &&
        canMoveAroundActors(p, { x: p.x + dx, z: p.z }, people)
      )
        p.x += dx;
      if (
        segmentClear(p, { x: p.x, z: p.z + dz }, obstacles) &&
        canMoveAroundActors(p, { x: p.x, z: p.z + dz }, people)
      )
        p.z += dz;
      const angle = Math.atan2(dx, dz);
      let d = angle - this.player.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.player.root.rotation.y += d * Math.min(1, dt * 14);
    }
    p.y = worldHeightAt(p.x, p.z);
    this.animate(
      this.player,
      dt,
      Math.hypot(p.x - beforeX, p.z - beforeZ) > 0.0002,
      run,
    );
    this.tutorialEvent({
      type: "movement",
      distance: Math.hypot(p.x - beforeX, p.z - beforeZ),
      running: run && this.player.anim === "Run",
    });
    const active = this.missions?.state.activeId;
    const phase = active
      ? this.missions?.state.missions[active].phase
      : undefined;
    this.audio.setMusicContext(
      phase === "leader-fleeing" ? "chase" : active ? "mission" : "exploration",
    );
    this.state.nearPickup = this.pickups.some(
      (v) => v.available && Vector3.Distance(v.root.position, p) < 2.2,
    );
    const near = this.actors.find(
      (a) =>
        a.role === "worker" &&
        a.health > 0 &&
        (!this.missions || this.missions.canImpact(a, false)) &&
        Vector3.Distance(a.root.position, p) < 1.05,
    );
    if (!this.state.tutorialOpen && near && this.time - this.healthTime > 2.3) {
      this.healthTime = this.time;
      this.state.health = Math.max(0, this.state.health - 5);
      this.message("ভিড়ের ধাক্কা! একটু দূরে থাকুন।");
    }
    if (
      this.state.health === 0 &&
      !active &&
      !worldAreas.some((a) =>
        ["failed", "restartable"].includes(
          this.missions?.state.missions[a.id].phase ?? "",
        ),
      )
    ) {
      this.message("একটু চা-বিরতি! নতুন করে চেষ্টা করুন।");
      this.state.paused = true;
      this.simulationActive = false;
    }
  }
  private tutorialGuide() {
    if (!this.state.tutorialOpen) return "";
    const step = this.state.tutorial.stepIndex;
    if (step === 8 && this.boarding.state === "seated")
      return "বসা হয়েছে। গাড়ির মিথস্ক্রিয়া দিয়ে এবার নিরাপদে নামুন।";
    const point =
      step === 4
        ? this.pickups
            .filter((pickup) => pickup.available)
            .sort(
              (a, b) =>
                Vector3.DistanceSquared(a.origin, this.player.root.position) -
                Vector3.DistanceSquared(b.origin, this.player.root.position),
            )[0]?.origin
        : step === 7 || step === 8
          ? this.world.vehicles[0]?.approachPose()
          : step === 9
            ? this.firstMarker
            : undefined;
    if (!point)
      return step === 4
        ? "জিনিস আবার আসা পর্যন্ত অপেক্ষা করুন।"
        : "কাজটি করলেই পরের ধাপ খুলবে।";
    const dx = point.x - this.player.root.position.x,
      dz = point.z - this.player.root.position.z;
    const distance = Math.hypot(dx, dz);
    const relative = Math.atan2(dx, dz) - this.yaw;
    const direction =
      Math.abs(Math.atan2(Math.sin(relative), Math.cos(relative))) < 0.65
        ? "সামনে"
        : Math.cos(relative) < -0.5
          ? "পেছনে"
          : Math.sin(relative) > 0
            ? "ডানে"
            : "বাঁয়ে";
    return `${direction} ${bn(distance)} মিটার • মানচিত্রে অবস্থান দেখুন`;
  }
  private updateActors(dt: number) {
    for (const a of this.actors) {
      const detailed =
        Vector3.DistanceSquared(a.root.position, this.camera.position) < 144;
      for (const mesh of a.detail) mesh.isVisible = detailed;
      if (this.missions?.controlsActor(a)) continue;
      const previous = a.root.position.clone();
      let moving = false,
        speed = 0;
      if (a.health > 0) {
        if (a.role === "civilian" && a.name !== content.civilians[4]) {
          const patrol = civilianPatrol(a.base.z, this.time, a.phase);
          const nextZ =
            a.root.position.z +
            Math.max(
              -0.5 * dt,
              Math.min(0.5 * dt, patrol.z - a.root.position.z),
            );
          if (
            Math.hypot(
              a.root.position.x - this.player.root.position.x,
              nextZ - this.player.root.position.z,
            ) > 0.72
          )
            a.root.position.z = nextZ;
          speed =
            Math.abs(a.root.position.z - previous.z) / Math.max(0.001, dt);
          moving = speed > 0.12;
          const desired = patrol.velocity > 0 ? 0 : Math.PI,
            delta = Math.atan2(
              Math.sin(desired - a.root.rotation.y),
              Math.cos(desired - a.root.rotation.y),
            );
          a.root.rotation.y += delta * Math.min(1, dt * 3.5);
        } else {
          const baseAngle = a.role === "civilian" ? Math.PI * 0.85 : Math.PI;
          a.root.rotation.y =
            baseAngle + Math.sin(this.time * 0.3 + a.phase) * 0.07;
        }
      }
      this.animate(a, dt, moving, false, speed);
      a.velocity
        .copyFrom(a.root.position.subtract(previous))
        .scaleInPlace(1 / Math.max(0.001, dt));
    }
  }
  private updateActorShadows() {
    if (!this.player) return;
    const distance = qualitySettings[this.state.quality].shadowDistance;
    for (const actor of [
      this.player,
      ...this.actors,
      ...this.trafficDrivers,
      ...(this.missions?.medicActors ?? []),
    ]) {
      const cast =
        actor === this.player ||
        (actor.root.isEnabled() &&
          Vector3.DistanceSquared(
            actor.root.position,
            this.player.root.position,
          ) <
            distance * distance);
      if (cast === actor.shadowActive) continue;
      actor.shadowActive = cast;
      for (const mesh of actor.shadowMeshes)
        if (cast) this.shadow.addShadowCaster(mesh);
        else this.shadow.removeShadowCaster(mesh);
    }
  }
  private updateFootsteps() {
    for (const actor of [
      this.player,
      ...this.actors,
      ...(this.missions?.medicActors ?? []),
    ]) {
      let state = this.footStates.get(actor);
      if (!state) {
        state = {
          tracker: new FootContacts(),
          x: actor.root.position.x,
          z: actor.root.position.z,
        };
        this.footStates.set(actor, state);
      }
      const p = actor.root.position,
        travelled = Math.hypot(p.x - state.x, p.z - state.z);
      state.x = p.x;
      state.z = p.z;
      const group = actor.groups.find((g) => g.name.endsWith(actor.anim));
      const frame = group?.getCurrentFrame() ?? 0,
        phase = group
          ? (frame - group.from) / Math.max(0.001, group.to - group.from)
          : 0;
      const moving =
        travelled > 0.001 &&
        travelled < 0.8 &&
        !!group &&
        (group.animatables[0]?.weight ?? 0) > 0.45;
      for (const contact of state.tracker.update(
        actor.anim,
        phase,
        moving,
        this.footContacts[actor.anim] ?? [],
      )) {
        if (Vector3.DistanceSquared(p, this.player.root.position) > 18 * 18)
          continue;
        this.audio.footstep(
          worldSurfaceAt(p.x, p.z),
          { x: p.x, y: p.y + 0.05, z: p.z },
          actor.anim === "Run",
          frame,
          actor.name + ":" + contact.foot,
        );
      }
    }
  }
  private updatePickups(dt: number) {
    for (const p of this.pickups) {
      if (!p.available) {
        p.cooldown -= dt;
        if (p.cooldown <= 0) {
          p.available = true;
          p.root.setEnabled(true);
        }
        continue;
      }
      p.root.position.y = p.origin.y + 0.05 + Math.sin(this.time * 2) * 0.04;
      p.root.rotation.y = Math.sin(this.time * 0.6) * 0.15;
    }
  }
  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      if (
        p.harmless &&
        !p.hit &&
        !this.state.tutorialOpen &&
        sweptProjectileDistance(
          p.previous,
          p.mesh.position,
          this.player.root.position.add(new Vector3(0, 1, 0)),
        ) < 0.5
      ) {
        p.hit = true;
        this.state.health = Math.max(0, this.state.health - 4);
        this.message("কাগজের গোলা! একটু পাশ কাটিয়ে যান।");
        this.audio.event("hit", p.mesh.position);
      }
      if (!p.hit && !p.harmless)
        for (const a of this.actors) {
          if (a.health <= 0 || !a.root.isEnabled()) continue;
          const center = a.root.position.add(new Vector3(0, 1, 0));
          if (
            sweptProjectileDistance(p.previous, p.mesh.position, center) < 0.58
          ) {
            this.hit(a, p);
            break;
          }
        }
      if (p.age > 4 || p.hit) {
        this.shadow.removeShadowCaster(p.mesh);
        p.body.dispose();
        p.mesh.getChildMeshes().forEach((m) => m.dispose());
        p.mesh.dispose();
        this.projectiles.splice(i, 1);
      } else p.previous.copyFrom(p.mesh.position);
    }
  }
  private updateCamera(dt: number) {
    this.updateActorShadows();
    this.sun.position.set(
      this.player.root.position.x - 25,
      40,
      this.player.root.position.z - 20,
    );
    this.audio.listener(
      this.player.root.position.x,
      this.player.root.position.z,
      this.yaw,
    );
    const focus = this.boarding?.cameraFocus;
    const target = focus
      ? new Vector3(focus.position.x, focus.position.y, focus.position.z)
      : this.player.root.position.add(new Vector3(0, 1.28, 0));
    const back = new Vector3(
      -Math.sin(this.yaw) * this.cameraDistance,
      0.35 + this.pitch * this.cameraDistance,
      -Math.cos(this.yaw) * this.cameraDistance,
    );
    const ideal = target.add(back);
    const dir = ideal.subtract(target);
    const ray = new Ray(target, dir.normalizeToNew(), dir.length());
    let dist = dir.length();
    for (const m of this.colliders) {
      if (focus && m.metadata?.vehicleId === focus.ignoredVehicleId) continue;
      const hit = ray.intersectsMesh(m, false);
      if (hit.hit)
        dist = Math.min(
          dist,
          cameraRetractionDistance(dir.length(), hit.distance),
        );
    }
    const desired = target.add(dir.normalizeToNew().scale(dist));
    this.camera.position =
      Vector3.Distance(this.camera.position, target) > dist
        ? desired
        : Vector3.Lerp(this.camera.position, desired, Math.min(1, dt * 10));
    this.camera.setTarget(
      target.add(
        new Vector3(Math.sin(this.yaw) * 0.6, 0.05, Math.cos(this.yaw) * 0.6),
      ),
    );
    this.cameraResolvedDistance = Vector3.Distance(
      this.camera.position,
      target,
    );
  }
  private restoreAvatarVisibility() {
    this.avatarOpacity = 1;
    for (const { mesh, visibility } of this.avatarMeshes)
      mesh.visibility = visibility;
  }
  private updateAvatarVisibility(dt: number) {
    if (!this.player) return;
    if (!this.state.playing) {
      this.restoreAvatarVisibility();
      return;
    }
    const upperBodyHeight = this.boarding?.state === "seated" ? 0.92 : 1.28;
    const bodyFocus = this.player.root.position.add(
      new Vector3(0, upperBodyHeight, 0),
    );
    const desiredOpacity = avatarOpacityForDistance(
      Vector3.Distance(this.camera.position, bodyFocus),
    );
    this.avatarOpacity = nextAvatarOpacity(
      this.avatarOpacity,
      desiredOpacity,
      dt,
    );
    for (const { mesh, visibility } of this.avatarMeshes)
      mesh.visibility = visibility * this.avatarOpacity;
  }
  private listen() {
    const on = <K extends keyof WindowEventMap>(
      key: K,
      fn: (e: WindowEventMap[K]) => void,
    ) => {
      window.addEventListener(key, fn);
      this.cleanup.push(() => window.removeEventListener(key, fn));
    };
    on("keydown", (e) => {
      if (
        !e.defaultPrevented &&
        e.code === "KeyM" &&
        this.state.mapOpen &&
        !(e.target as HTMLElement).closest(
          "input,select,textarea,[contenteditable]",
        )
      ) {
        e.preventDefault();
        this.map(false);
        return;
      }
      if (
        e.defaultPrevented ||
        (e.target as HTMLElement).closest(
          "input,select,textarea,[contenteditable], [role=dialog]",
        )
      )
        return;
      this.input("desktop");
      if (!this.audio.unlocked && e.isTrusted)
        void this.audio
          .start(this.state.playing ? "exploration" : "menu")
          .catch(() => {});
      if (e.code === "Escape") {
        if (!e.repeat) {
          if (this.state.mapOpen) this.map(false);
          else this.pause();
        }
        return;
      }
      if (!this.simulationActive) return;
      if (
        (e.target as HTMLElement).closest("button,a") &&
        ["Tab", "Enter", "Space"].includes(e.code)
      )
        return;
      if (
        [
          "Space",
          "Enter",
          "Tab",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code)
      )
        e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === "KeyE") this.context();
      if (e.code === "Tab") this.vehicle();
      if (e.code === "KeyM") this.map();
      if (e.code === "Space" || e.code === "Enter") this.throw();
      if (e.code === "Digit1") this.select("egg");
      if (e.code === "Digit2") this.select("sandal");
    });
    on("keyup", (e) => this.keys.delete(e.code));
    on("click", (e) => {
      if ((e.target as Element).closest("button,a"))
        void this.audio.interfaceClick();
    });
    on("pointerdown", (e) => {
      this.input(
        e.pointerType === "touch" ||
          window.matchMedia("(max-width: 760px)").matches
          ? "mobile"
          : "desktop",
      );
      if (!this.audio.unlocked && e.isTrusted)
        void this.audio
          .start(this.state.playing ? "exploration" : "menu")
          .catch(() => {});
    });
    on("blur", () => {
      this.clearControls();
    });
    const hidden = () => {
      if (document.visibilityState !== "visible") this.clearControls();
    };
    document.addEventListener("visibilitychange", hidden);
    this.cleanup.push(() =>
      document.removeEventListener("visibilitychange", hidden),
    );
    on("resize", () => this.engine.resize());
    const down = (e: PointerEvent) => {
      if (!this.simulationActive || this.state.mapOpen || e.button !== 0)
        return;
      this.pointer = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        dragged: false,
        touch: e.pointerType === "touch",
      };
      this.canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!this.pointer || this.pointer.id !== e.pointerId) return;
      if (
        Math.hypot(
          e.clientX - this.pointer.startX,
          e.clientY - this.pointer.startY,
        ) > 6
      )
        this.pointer.dragged = true;
      this.look(e.clientX - this.pointer.x, e.clientY - this.pointer.y);
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      const pointer = this.pointer;
      if (!pointer || pointer.id !== e.pointerId) return;
      this.pointer = undefined;
      if (this.canvas.hasPointerCapture(e.pointerId))
        this.canvas.releasePointerCapture(e.pointerId);
      if (!pointer.dragged && !pointer.touch && e.type === "pointerup")
        this.throw();
    };
    const wheel = (event: WheelEvent) => {
      if (!this.simulationActive || this.state.mapOpen) return;
      event.preventDefault();
      this.input("desktop");
      if (event.deltaY === 0 || this.time - this.wheelTime < 0.12) return;
      this.wheelTime = this.time;
      this.select(this.state.selected === "egg" ? "sandal" : "egg");
    };
    this.canvas.addEventListener("wheel", wheel, { passive: false });
    this.canvas.addEventListener("pointerdown", down);
    this.canvas.addEventListener("pointermove", move);
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", up);
    this.cleanup.push(() => {
      this.canvas.removeEventListener("pointerdown", down);
      this.canvas.removeEventListener("pointermove", move);
      this.canvas.removeEventListener("pointerup", up);
      this.canvas.removeEventListener("pointercancel", up);
      this.canvas.removeEventListener("wheel", wheel);
    });
  }
  private emit() {
    if (this.missions && this.world) {
      const environment = this.spawnEnvironment();
      this.state.missionMap = this.missions.mapData({
        pickups: this.pickups
          .filter((p) => p.available && p.root.isEnabled())
          .map((p) => ({ x: p.origin.x, z: p.origin.z, kind: p.kind })),
        vehicles: this.world.vehicles
          .filter((v) => v.root.isEnabled())
          .map((v) => ({ x: v.root.position.x, z: v.root.position.z }))
          .concat((this.traffic?.poses ?? []).map((v) => ({ x: v.x, z: v.z }))),
        safeStarts: this.spawnRegistry.locations
          .filter(
            (s) =>
              s.enabled &&
              safeSpawnPoint(
                s,
                {
                  ...environment,
                  obstacles: [
                    ...environment.obstacles,
                    ...this.actors
                      .filter(
                        (a) =>
                          a.role === "civilian" &&
                          a.name !== content.civilians[4] &&
                          Math.abs(a.base.x) < 7 &&
                          a.base.z < 22,
                      )
                      .map((a) => civilianPatrolBounds(a.base.x, a.base.z)),
                  ],
                },
                0.42,
              ),
          )
          .map((s) => ({ x: s.x, z: s.z })),
      });
      this.state.hasSavedRun = this.missions.hasSavedRun;
    }
    this.onChange({ ...this.state });
  }
  diagnostics() {
    return {
      ...this.frameWindow.summary(),
      simulationTime: this.time,
      missionDetails: this.missions?.diagnostics(),
      sectors: this.sectors?.diagnostics(),
      traffic: this.traffic?.diagnostics(),
      trafficDrivers: [...this.trafficDrivers].map((a) => ({
        name: a.name,
        animation: a.anim,
      })),
      renderDevice: {
        renderer: this.engine.getGlInfo().renderer,
        vendor: this.engine.getGlInfo().vendor,
        version: this.engine.getGlInfo().version,
      },
      pageVisible: document.visibilityState === "visible",
      controls: {
        keys: [...this.keys],
        touch: { ...this.touch },
        running: this.running,
        pointer: this.pointer ? { ...this.pointer } : null,
      },
      playerMotionsSeen: [...this.playerMotionsSeen],
      cameraPerspective: this.camera.mode === 0,
      cameraDistance: this.cameraDistance,
      cameraResolvedDistance: this.cameraResolvedDistance,
      avatarOpacity: this.avatarOpacity,
      hdrReady: this.scene.environmentTexture?.isReady() ?? false,
      ambientOcclusion: !!this.ambientOcclusion,
      actorStates: [this.player, ...this.actors]
        .filter((a) => !!a)
        .map((a) => ({
          name: a.name,
          role: a.role,
          resolve: a.health,
          enabled: a.root.isEnabled(),
          velocity: a.velocity.asArray(),
          position: a.root.position.asArray(),
          animation: a.anim,
          localGarments: a.root
            .getChildMeshes()
            .filter(
              (m) =>
                /optional tunic|Optional woven|Optional long|Optional moustache/.test(
                  m.name,
                ) && m.isEnabled(),
            )
            .map((m) => m.name),
        })),
      playerClips: this.player?.groups
        .filter((group) => group.isStarted)
        .map((group) => ({
          name: group.name,
          frame: group.getCurrentFrame(),
          from: group.from,
          to: group.to,
          fps: group.targetedAnimations[0]?.animation.framePerSecond,
          weight: group.animatables[0]?.weight,
        })),
      vehicleAnchors: this.world.vehicles.map((vehicle) => ({
        id: vehicle.id,
        occupied: vehicle.occupied,
        approach: vehicle.approachPose(),
        seat: vehicle.seatPose(),
        exits: vehicle.exitPoses(),
      })),
      activeProjectiles: this.projectiles.length,
      impacts: this.impactHistory,
      meshes: this.scene.meshes.length,
      materials: this.scene.materials.length,
      textures: this.scene.textures.length,
      activeMeshes: this.scene.getActiveMeshes().length,
      drawCalls: this.engine._drawCalls.current,
      position: this.player?.root.position.asArray(),
      cameraPosition: this.camera.position.asArray(),
      skeletons: this.scene.skeletons.length,
      animationGroups: this.scene.animationGroups.length,
      physics: !!this.scene.getPhysicsEngine(),
      dynamicVehicleBodies: this.dynamicBodies.size,
      cameraColliders: this.colliders.length,
      shadowCasters:
        this.shadow.getShadowMap()?.renderList?.filter((m) => m.isEnabled())
          .length ?? 0,
      qualityBudget: qualitySettings[this.state.quality],
      audio: this.audio.status,
      audioDetails: this.audio.diagnostics(),
      spawnRegistry: {
        revision: this.spawnRegistry.revision,
        source: this.spawnRegistry.source,
        origin: this.spawnRegistryOrigin,
      },
      tutorialSafety: this.state.tutorialOpen,
      qaExitBlocked: this.qaExitBlocked,
      boarding: this.boarding
        ? {
            state: this.boarding.state,
            locked: this.boarding.locked,
            motion: this.boarding.motion,
            animationTime: this.boarding.animationTime,
            vehicleId: this.boarding.activeVehicle?.id,
          }
        : null,
      ...this.state,
    };
  }
  dispose() {
    this.disposed = true;
    this.cleanup.forEach((f) => f());
    this.audio.dispose();
    this.traffic?.dispose();
    for (const entry of this.dynamicBodies.values()) entry.body.dispose();
    this.sectors?.dispose();
    this.missions?.dispose();
    this.boardingQa?.dispose();
    this.projectiles.forEach((p) => p.body.dispose());
    this.scene.dispose();
    this.engine.dispose();
  }
}
