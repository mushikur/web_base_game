import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import {
  beardStyles,
  characterDefaults,
  defaultGameCatalog,
  hairStyles,
  rideNames,
  templates,
  themes,
  type CatalogAsset,
  type CatalogAssetKind,
  type GameCatalog,
} from "../../../packages/shared/src/catalog.ts";
import { itemOrder } from "../../../packages/shared/src/combat.ts";
import { worldAreas } from "../../../packages/shared/src/world-layout.ts";
import { ApiError, bengali } from "./content.ts";
import { prepareGameAsset } from "./gameCatalogAssets.ts";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "গেমের তথ্য অসম্পূর্ণ।");
  return value as Record<string, unknown>;
}
function number(
  value: unknown,
  min: number,
  max: number,
  label: string,
  integer = false,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new ApiError(400, `${label} অনুমোদিত সীমায় রাখুন।`);
  return value;
}
function choice<T extends object>(value: unknown, choices: T, label: string) {
  if (typeof value !== "string" || !Object.hasOwn(choices, value))
    throw new ApiError(400, `${label} তালিকা থেকে বাছুন।`);
  return value as keyof T;
}
const text = (value: unknown, label: string, max?: number) => {
  const result = bengali(value, label, max).normalize("NFC");
  if (
    /[\p{Cc}\p{Bidi_Control}]/u.test(result) ||
    !/\p{Script=Bengali}/u.test(result) ||
    [...result].some(
      (character) =>
        /[\p{L}\p{Nd}]/u.test(character) &&
        !/\p{Script=Bengali}/u.test(character),
    )
  )
    throw new ApiError(400, `${label} বাংলায় লিখুন।`);
  return result;
};
export function validateGameCatalog(
  input: unknown,
  assets: CatalogAsset[],
): GameCatalog {
  const root = record(input),
    result = defaultGameCatalog();
  const asset = (value: unknown, kind: CatalogAssetKind) => {
    if (value === "") return "";
    if (
      typeof value !== "string" ||
      !assets.some((entry) => entry.id === value && entry.kind === kind)
    )
      throw new ApiError(400, "তালিকা থেকে সঠিক ধরনের যাচাই করা ফাইল বাছুন।");
    return value;
  };
  if (root.schemaVersion !== 1)
    throw new ApiError(400, "গেমের তথ্যের সংস্করণ সঠিক নয়।");
  const branding = record(root.branding);
  result.branding = {
    title: text(branding.title, "গেমের নাম", 44),
    slogan: text(branding.slogan, "স্লোগান", 100),
    logo: asset(branding.logo, "image"),
    theme: choice(branding.theme, themes, "দৃশ্যের রং"),
  };
  const characters = record(root.characters),
    usedNames = new Set<string>();
  for (const [id] of characterDefaults) {
    const item = record(characters[id]),
      name = text(item.name, "চরিত্রের নাম", 44);
    if (usedNames.has(name))
      throw new ApiError(400, "চরিত্রের নামগুলো আলাদা রাখুন।");
    usedNames.add(name);
    if (typeof item.color !== "string" || !/^#[0-9a-f]{6}$/i.test(item.color))
      throw new ApiError(400, "পোশাকের রং সঠিক নয়।");
    result.characters[id] = {
      name,
      color: item.color,
      height: number(item.height, 0.92, 1.08, "উচ্চতা"),
      build: number(item.build ?? 1, 0.92, 1.08, "গড়ন"),
      hair: choice(item.hair ?? "original", hairStyles, "চুলের ধরন"),
      beard: choice(item.beard ?? "original", beardStyles, "গোঁফের ধরন"),
      template: choice(item.template, templates, "পোশাক"),
      portrait: asset(item.portrait, "image"),
      model: asset(item.model, "model"),
    };
  }
  if (
    new Set(
      Object.values(result.characters)
        .map((c) => c.model)
        .filter(Boolean),
    ).size > 4
  )
    throw new ApiError(
      400,
      "এক সংস্করণে সর্বোচ্চ চারটি আলাদা ত্রিমাত্রিক মডেল বাছুন।",
    );
  const areas = record(root.areas);
  for (const { id } of worldAreas) {
    const entry = record(areas[id]);
    const target =
      id === "promise-junction"
        ? result.characters.leader.name
        : text(entry.target, "অভিযানের লক্ষ্য", 44);
    if (id !== "promise-junction") {
      if (usedNames.has(target))
        throw new ApiError(400, "অভিযানের লক্ষ্যগুলোর নাম আলাদা রাখুন।");
      usedNames.add(target);
    }
    result.areas[id] = {
      name: text(entry.name, "এলাকার নাম", 32),
      target,
      objective: text(entry.objective, "অভিযানের নির্দেশনা", 160),
      tea: text(entry.tea, "চায়ের দোকানের নাম", 28),
    };
  }
  const items = record(root.items);
  for (const id of itemOrder) {
    const entry = record(items[id]);
    result.items[id] = {
      name: text(entry.name, "জিনিসের নাম", 28),
      score: number(entry.score, 0, 100, "পয়েন্ট", true),
      quantity:
        id === "hand"
          ? 0
          : number(entry.quantity, 1, 20, "কুড়ানোর পরিমাণ", true),
    };
  }
  const vehicles = record(root.vehicles);
  for (const id of Object.keys(
    rideNames,
  ) as (keyof GameCatalog["vehicles"])[]) {
    const entry = record(vehicles[id]);
    result.vehicles[id] = {
      name: text(entry.name, "যানের নাম", 34),
      speed: number(entry.speed, 0.55, 1.2, "গতির গুণক"),
    };
  }
  const behavior = record(root.behavior);
  for (const role of ["leader", "worker", "civilian"] as const)
    result.behavior[role] = number(behavior[role], 0.65, 1.15, "চলাফেরার গতি");
  const paper = record(root.newspaper);
  for (const field of ["name", "calm", "disputed", "photo", "quote"] as const)
    result.newspaper[field] = text(
      paper[field],
      field === "name" ? "পত্রিকার নাম" : "পত্রিকার লেখা",
      field === "name" ? 42 : 120,
    );
  return result;
}

export function visibleGameCatalog(
  catalog: GameCatalog,
  assets: CatalogAsset[],
) {
  const selected = new Set([
    catalog.branding.logo,
    ...Object.values(catalog.characters).flatMap((entry) => [
      entry.portrait,
      entry.model,
    ]),
  ]);
  return {
    ...catalog,
    assets: assets.filter((entry) => selected.has(entry.id)),
  };
}

type State = {
  sequence: number;
  draft: GameCatalog;
  published: GameCatalog;
  assets: (CatalogAsset & { digest: string })[];
  history: { id: string; at: string; content: GameCatalog }[];
  audit: { at: string; action: string; revision: number }[];
};
type Storage = {
  kind: "local" | "mongo";
  load(): Promise<State | null>;
  write(state: State, previous: number): Promise<void>;
  put(id: string, data: Buffer): Promise<void>;
  get(id: string): Promise<Buffer>;
  close(): Promise<void>;
};

async function localStorage(directory: string): Promise<Storage> {
  const objects = join(directory, "catalog-objects"),
    document = join(directory, "game-catalog.json");
  await mkdir(objects, { recursive: true });
  return {
    kind: "local",
    async load() {
      try {
        return JSON.parse(await readFile(document, "utf8")) as State;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        return null;
      }
    },
    async write(state) {
      const staging = join(directory, `catalog-${randomUUID()}.tmp`);
      await writeFile(staging, JSON.stringify(state, null, 2), {
        flag: "wx",
        mode: 0o600,
      });
      await rename(staging, document);
    },
    async put(id, data) {
      await writeFile(join(objects, id), data, { flag: "wx", mode: 0o600 });
    },
    get: (id) => readFile(join(objects, id)),
    async close() {
      /* Local storage has no connection. */
    },
  };
}

async function mongoStorage(uri: string): Promise<Storage> {
  const match = /^mongodb:\/\/127\.0\.0\.1:(\d{4,5})\/neta_uthche$/.exec(uri);
  if (!match || Number(match[1]) === 27017 || Number(match[1]) > 65535)
    throw new Error("গেমের জন্য আলাদা লোকাল MongoDB ঠিকানা প্রয়োজন।");
  const { createConnection, mongo } = await import("mongoose");
  const connection = createConnection(uri, { serverSelectionTimeoutMS: 3000 });
  try {
    await connection.asPromise();
  } catch (error) {
    await connection.close();
    throw error;
  }
  const db = connection.db!;
  const collection = db.collection<State & { _id: string }>("game_catalog");
  const bucket = new mongo.GridFSBucket(db, { bucketName: "game_objects" });
  const key = "primary";
  return {
    kind: "mongo",
    load: () =>
      collection.findOne<State>({ _id: key }, { projection: { _id: 0 } }),
    async write(state, previous) {
      const changed = await collection
        .updateOne(
          { _id: key, sequence: previous },
          { $set: state },
          { upsert: previous === 0 },
        )
        .catch((error: { code?: number }) => {
          if (error.code === 11000)
            throw new ApiError(
              409,
              "অন্য পরিবর্তন এসেছে। তালিকা হালনাগাদ করুন।",
            );
          throw error;
        });
      if (!changed.matchedCount && !changed.upsertedCount)
        throw new ApiError(409, "অন্য পরিবর্তন এসেছে। তালিকা হালনাগাদ করুন।");
    },
    async put(id, data) {
      await pipeline(Readable.from([data]), bucket.openUploadStream(id));
    },
    async get(id) {
      const chunks: Buffer[] = [];
      for await (const chunk of bucket.openDownloadStreamByName(id))
        chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks);
    },
    close: () => connection.close(),
  };
}

export class GameCatalogStore {
  private queue: Promise<unknown> = Promise.resolve();
  private storage!: Storage;
  private state: State = {
    sequence: 1,
    draft: defaultGameCatalog(),
    published: defaultGameCatalog(),
    assets: [],
    history: [],
    audit: [],
  };
  async init(directory: string, mongoUri?: string) {
    this.storage = await (mongoUri
      ? mongoStorage(mongoUri)
      : localStorage(directory));
    this.state = (await this.storage.load()) ?? this.state;
  }
  close() {
    return this.storage.close();
  }
  async read() {
    if (this.storage.kind === "mongo")
      this.state = (await this.storage.load()) ?? this.state;
    return this.state;
  }
  async public(preview = false) {
    const state = await this.read();
    return visibleGameCatalog(
      preview ? state.draft : state.published,
      state.assets,
    );
  }
  async admin() {
    const state = await this.read();
    return {
      draft: { ...state.draft, assets: state.assets },
      publishedRevision: state.published.revision,
      history: state.history.map(({ id, at, content }) => ({
        id,
        at,
        revision: content.revision,
        name: content.branding.title,
      })),
      audit: state.audit,
      storage: this.storage.kind,
    };
  }
  private mutate<T>(
    action: string,
    revision: number,
    change: (state: State) => T | Promise<T>,
  ) {
    const task = this.queue.then(async () => {
      const current = await this.read();
      if (revision !== current.draft.revision)
        throw new ApiError(409, "নতুন পরিবর্তন এসেছে। তালিকা হালনাগাদ করুন।");
      const next = structuredClone(current);
      next.sequence++;
      next.draft.revision = next.sequence;
      const result = await change(next);
      next.audit = [
        ...next.audit.slice(-199),
        { at: new Date().toISOString(), action, revision: next.sequence },
      ];
      await this.storage.write(
        next,
        current.sequence === 1 ? 0 : current.sequence,
      );
      this.state = next;
      return result;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  save(input: unknown, revision: number) {
    return this.mutate("গেমের খসড়া সংরক্ষণ", revision, (state) => {
      state.draft = {
        ...validateGameCatalog(input, state.assets),
        revision: state.sequence,
      };
    });
  }
  publish(revision: number, rollback?: string) {
    return this.mutate(
      rollback ? "আগের গেম প্রকাশ ফিরিয়ে আনা" : "গেম প্রকাশ",
      revision,
      async (state) => {
        const candidate = rollback
          ? state.history.find(({ id }) => id === rollback)?.content
          : state.draft;
        if (!candidate) throw new ApiError(404, "আগের সংস্করণ পাওয়া যায়নি।");
        const parsed = validateGameCatalog(candidate, state.assets);
        const selected = new Set(
          visibleGameCatalog(parsed, state.assets).assets.map(
            (asset) => asset.id,
          ),
        );
        for (const asset of state.assets.filter((asset) =>
          selected.has(asset.id),
        )) {
          const data = await this.storage.get(asset.id).catch(() => undefined);
          if (
            !data ||
            data.length !== asset.bytes ||
            createHash("sha256").update(data).digest("hex") !== asset.digest
          )
            throw new ApiError(400, "প্রয়োজনীয় ফাইল পাওয়া যায়নি।");
        }
        state.history = [
          ...state.history.slice(-39),
          {
            id: randomUUID(),
            at: new Date().toISOString(),
            content: state.published,
          },
        ];
        state.published = { ...parsed, revision: state.sequence };
      },
    );
  }
  async upload(
    revision: number,
    kind: CatalogAssetKind,
    name: unknown,
    attribution: unknown,
    data: Buffer,
    root: string,
  ) {
    const safeName = text(name, "ফাইলের বাংলা নাম", 60),
      source = bengali(attribution, "উৎস ও ব্যবহারের অনুমতি", 180);
    const file = await prepareGameAsset(kind, data, root);
    return this.mutate(`ফাইল যোগ • ${safeName}`, revision, async (state) => {
      if (state.assets.length >= 80)
        throw new ApiError(400, "ফাইলের তালিকা পূর্ণ হয়েছে।");
      const id = randomUUID();
      await this.storage.put(id, file.data);
      state.assets.push({
        id,
        name: safeName,
        attribution: source,
        kind,
        url: `/game-objects/${id}.${file.extension}`,
        mime: file.mime,
        bytes: file.data.length,
        digest: createHash("sha256").update(file.data).digest("hex"),
      });
    });
  }
  async object(path: string, privateAccess: boolean) {
    const state = await this.read();
    const asset = (
      privateAccess
        ? state.assets
        : visibleGameCatalog(state.published, state.assets).assets
    ).find((entry) => entry.url === path);
    if (!asset) throw new ApiError(404, "ফাইল পাওয়া যায়নি।");
    return { asset, data: await this.storage.get(asset.id) };
  }
}
