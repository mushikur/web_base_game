import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { validateBytes } from "gltf-validator";
import type { CatalogAssetKind } from "../../../packages/shared/src/catalog.ts";
import { ApiError } from "./content.ts";

type Model = {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: {
    name?: string;
    translation?: number[];
    rotation?: number[];
    scale?: number[];
    matrix?: number[];
    children?: number[];
    mesh?: number;
    skin?: number;
  }[];
  skins?: { joints?: number[]; skeleton?: number }[];
  materials?: { pbrMetallicRoughness?: object }[];
  meshes?: {
    primitives?: {
      mode?: number;
      indices?: number;
      material?: number;
      attributes?: Record<string, number>;
    }[];
  }[];
  animations?: { name?: string; channels?: { target?: { node?: number } }[] }[];
  accessors?: { count?: number; min?: number[]; max?: number[] }[];
  buffers?: { uri?: string }[];
  bufferViews?: { byteOffset?: number; byteLength: number }[];
  images?: { uri?: string; bufferView?: number }[];
  extensionsUsed?: string[];
};
function unpack(data: Buffer) {
  if (
    data.length < 32 ||
    data.readUInt32LE(0) !== 0x46546c67 ||
    data.readUInt32LE(4) !== 2 ||
    data.readUInt32LE(8) !== data.length ||
    data.readUInt32LE(16) !== 0x4e4f534a
  )
    throw new ApiError(400, "স্বয়ংসম্পূর্ণ ত্রিমাত্রিক ফাইল দিন।");
  const end = 20 + data.readUInt32LE(12);
  if (
    end > data.length - 8 ||
    data.readUInt32LE(end + 4) !== 0x004e4942 ||
    end + 8 + data.readUInt32LE(end) !== data.length
  )
    throw new ApiError(400, "ত্রিমাত্রিক ফাইলের গঠন সঠিক নয়।");
  return {
    model: JSON.parse(data.subarray(20, end).toString("utf8")) as Model,
    bin: data.subarray(end + 8),
  };
}
const requiredMotions = [
  "Idle",
  "Walk",
  "Run",
  "Throw",
  "Hit",
  "Pickup",
  "EnterVehicle",
  "Seated",
  "ExitVehicle",
];
const defaultTransform = (node: NonNullable<Model["nodes"]>[number]) =>
  !node.matrix &&
  (!node.rotation || node.rotation.join() === "0,0,0,1") &&
  (!node.scale || node.scale.join() === "1,1,1");
const translation = (node: NonNullable<Model["nodes"]>[number]) =>
  node.translation ?? [0, 0, 0];

async function validateModel(data: Buffer, root: string) {
  const { model, bin } = unpack(data);
  if (
    !Array.isArray(model.nodes) ||
    model.nodes.length > 80 ||
    !Array.isArray(model.meshes) ||
    model.meshes.length > 28 ||
    !Array.isArray(model.materials) ||
    model.materials.length > 24 ||
    model.buffers?.length !== 1 ||
    model.buffers[0].uri !== undefined ||
    (model.images?.length ?? 0) > 10 ||
    model.images?.some((image) => image.uri !== undefined) ||
    (model.extensionsUsed?.length ?? 0) > 0 ||
    (model.animations?.length ?? 0) > 14
  )
    throw new ApiError(
      400,
      "মডেলের গঠন, উপাদান বা ছবির সীমা মানুন। ফাইলের বাইরের উপকরণ চলবে না।",
    );
  const report = await validateBytes(data, { format: "glb", maxIssues: 80 });
  const errors = report.issues.messages.filter((entry) => entry.severity === 0);
  // The original rig emitted empty leaf children arrays. They have no runtime effect.
  if (
    errors.length !== report.issues.numErrors ||
    errors.some(
      ({ code, pointer }) =>
        code !== "EMPTY_ENTITY" ||
        !/^\/nodes\/\d+\/children$/.test(pointer ?? ""),
    )
  )
    throw new ApiError(
      400,
      "ত্রিমাত্রিক ফাইলের মেশ, রিগ বা অ্যানিমেশনের তথ্য ক্ষতিগ্রস্ত।",
    );

  const original = unpack(
    await readFile(
      join(root, "public/assets/models/dhaka-character-phase01.glb"),
    ),
  ).model;
  const reference = original.skins![0].joints!;
  const skin = model.skins?.[0],
    joints = skin?.joints,
    nodes = model.nodes;
  const sceneRoots = model.scenes?.[model.scene ?? 0]?.nodes;
  if (
    model.skins?.length !== 1 ||
    !joints ||
    joints.length !== reference.length ||
    skin.skeleton !== joints[0] ||
    sceneRoots?.length !== 1
  )
    throw new ApiError(400, "গেমের সতেরো জোড়ার মানব রিগ প্রয়োজন।");
  const parent = (source: NonNullable<Model["nodes"]>, index: number) =>
    source.findIndex((node) => node.children?.includes(index));
  const sceneRoot = sceneRoots[0];
  if (
    parent(nodes, joints[0]) !== sceneRoot ||
    !defaultTransform(nodes[sceneRoot]) ||
    translation(nodes[sceneRoot]).some((axis) => axis !== 0) ||
    joints.some((index, i) => {
      const node = nodes[index],
        expected = original.nodes![reference[i]];
      return (
        node.name !== expected.name ||
        !defaultTransform(node) ||
        (i > 0 &&
          joints.indexOf(parent(nodes, index)) !==
            reference.indexOf(parent(original.nodes!, reference[i]))) ||
        translation(node).some(
          (axis, component) =>
            Math.abs(axis - translation(expected)[component]) > 0.002,
        )
      );
    })
  )
    throw new ApiError(
      400,
      "গেমের মূল রিগের জোড়ার নাম, ভঙ্গি, দিক ও মাপ বজায় রাখুন।",
    );
  if (
    model.animations?.length !== requiredMotions.length ||
    !requiredMotions.every((motion) =>
      model.animations?.some(
        (animation) =>
          animation.name === motion &&
          animation.channels?.some((channel) =>
            joints.includes(channel.target?.node ?? -1),
          ),
      ),
    )
  )
    throw new ApiError(
      400,
      "হাঁটা, দৌড়, বসা, ওঠানামা ও অন্যান্য প্রয়োজনীয় অ্যানিমেশন যোগ করুন।",
    );

  let triangles = 0,
    meshCount = 0,
    top = 0,
    bottom = Infinity;
  for (const [index, node] of nodes.entries()) {
    if (node.mesh === undefined) continue;
    meshCount++;
    if (
      node.skin !== 0 ||
      parent(nodes, index) !== sceneRoot ||
      !defaultTransform(node) ||
      translation(node).some((axis) => axis !== 0)
    )
      throw new ApiError(
        400,
        "মেশকে মূল রিগের সঙ্গে বসান এবং ভঙ্গি স্থির রাখুন।",
      );
    for (const primitive of model.meshes[node.mesh].primitives ?? []) {
      const position = model.accessors?.[primitive.attributes?.POSITION ?? -1];
      if (
        (primitive.mode ?? 4) !== 4 ||
        primitive.material === undefined ||
        !model.materials[primitive.material].pbrMetallicRoughness ||
        primitive.attributes?.JOINTS_0 === undefined ||
        primitive.attributes.WEIGHTS_0 === undefined ||
        !position?.min ||
        !position.max ||
        Math.max(
          Math.abs(position.min[0]),
          Math.abs(position.max[0]),
          Math.abs(position.min[2]),
          Math.abs(position.max[2]),
        ) > 0.9
      )
        throw new ApiError(
          400,
          "মডেলের জ্যামিতি, উপাদান বা সংঘর্ষের মাপ সঠিক নয়।",
        );
      bottom = Math.min(bottom, position.min[1]);
      top = Math.max(top, position.max[1]);
      triangles +=
        (model.accessors?.[primitive.indices ?? -1]?.count ??
          position.count ??
          0) / 3;
    }
  }
  if (
    !meshCount ||
    triangles < 32 ||
    triangles > 50_000 ||
    bottom < -0.12 ||
    bottom > 0.2 ||
    top < 1.4 ||
    top > 2.02
  )
    throw new ApiError(
      400,
      "মডেলের উচ্চতা, পায়ের অবস্থান বা ত্রিভুজের সংখ্যা সীমার বাইরে।",
    );
  for (const image of model.images ?? []) {
    const view = model.bufferViews?.[image.bufferView ?? -1];
    if (!view) throw new ApiError(400, "মডেলের ছবিগুলো একই ফাইলে রাখুন।");
    const start = view.byteOffset ?? 0;
    const meta = await sharp(bin.subarray(start, start + view.byteLength), {
      limitInputPixels: 1024 * 1024,
    }).metadata();
    if (
      !meta.width ||
      !meta.height ||
      meta.width > 1024 ||
      meta.height > 1024 ||
      !["png", "jpeg"].includes(meta.format ?? "") ||
      (meta.pages ?? 1) > 1
    )
      throw new ApiError(
        400,
        "মডেলের প্রতিটি ছবি সর্বোচ্চ ১০২৪×১০২৪ পিক্সেল রাখুন।",
      );
  }
}

export async function prepareGameAsset(
  kind: CatalogAssetKind,
  data: Buffer,
  root: string,
) {
  try {
    if (kind === "model") {
      await validateModel(data, root);
      return { data, mime: "model/gltf-binary", extension: "glb" };
    }
    const image = sharp(data, {
      limitInputPixels: 4_194_304,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      !["png", "jpeg", "webp"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) !== 1 ||
      !metadata.width ||
      !metadata.height
    )
      throw new ApiError(400, "একটি স্থির ছবি দিন।");
    return {
      data: await image
        .rotate()
        .resize(768, 768, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 88 })
        .toBuffer(),
      mime: "image/webp",
      extension: "webp",
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      kind === "model"
        ? "ত্রিমাত্রিক ফাইলটি যাচাই করা যায়নি।"
        : "ছবি পড়া যায়নি বা আকার খুব বড়।",
    );
  }
}
