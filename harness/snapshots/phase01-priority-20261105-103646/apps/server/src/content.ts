import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  audioCategories,
  musicContexts,
  defaultAudioContent,
  type AudioContent,
} from "../../../packages/shared/src/audio.ts";
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function bengali(value: unknown, label: string, max = 160) {
  if (
    typeof value !== "string" ||
    !/[\u0980-\u09FF]/.test(value) ||
    /[\u0900-\u0963\u0966-\u097f<>]/.test(value) ||
    [...value].some((c) => c.charCodeAt(0) < 9) ||
    value.trim().length > max
  )
    throw new ApiError(400, `${label} বাংলায় সঠিকভাবে লিখুন।`);
  return value.trim();
}
function finite(v: unknown, min: number, max: number) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new ApiError(400, "শব্দের মান নির্ধারিত সীমার মধ্যে রাখুন।");
  return v;
}
export function validateContent(
  value: unknown,
  knownAssets: AudioContent["assets"],
): AudioContent {
  if (!value || typeof value !== "object")
    throw new ApiError(400, "শব্দের তালিকা সঠিক নয়।");
  const c = value as AudioContent;
  if (
    c.schemaVersion !== 1 ||
    !Array.isArray(c.tracks) ||
    !Array.isArray(c.cues) ||
    c.tracks.length > 100 ||
    c.cues.length > 500
  )
    throw new ApiError(400, "শব্দের তালিকার সীমা মানুন।");
  const ids = new Set<string>(),
    assetIds = new Set(knownAssets.map((a) => a.id));
  for (const entry of [...c.tracks, ...c.cues]) {
    if (
      typeof entry.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) ||
      ids.has(entry.id)
    )
      throw new ApiError(400, "প্রতিটি শব্দের আলাদা পরিচয় প্রয়োজন।");
    ids.add(entry.id);
    bengali(entry.name, "নাম");
    if (!assetIds.has(entry.assetId))
      throw new ApiError(400, "অনুমোদিত অডিও ফাইল বাছুন।");
    finite(entry.volume, 0, 1);
    if (typeof entry.enabled !== "boolean")
      throw new ApiError(400, "চালু বা বন্ধের অবস্থা ঠিক করুন।");
  }
  for (const t of c.tracks) {
    if (
      !Array.isArray(t.contexts) ||
      !t.contexts.length ||
      t.contexts.some((x) => !musicContexts.includes(x)) ||
      typeof t.loop !== "boolean" ||
      typeof t.random !== "boolean"
    )
      throw new ApiError(400, "সংগীত কোথায় বাজবে তা বাছুন।");
    finite(t.order, 0, 1000);
    finite(t.fadeIn, 0, 15);
    finite(t.fadeOut, 0, 15);
  }
  for (const cue of c.cues) {
    if (
      !audioCategories.includes(cue.category) ||
      ["master", "music"].includes(cue.category) ||
      typeof cue.trigger !== "string" ||
      !/^[-a-zA-Z0-9_]{1,64}$/.test(cue.trigger)
    )
      throw new ApiError(400, "শব্দের বিভাগ ও ঘটনার পরিচয় সঠিক নয়।");
    if (
      typeof cue.character !== "string" ||
      cue.character.length > 100 ||
      typeof cue.subtitle !== "string" ||
      cue.subtitle.length > 300 ||
      typeof cue.spatial !== "boolean"
    )
      throw new ApiError(400, "চরিত্র বা সংলাপ সঠিক নয়।");
    if (["voices", "crowd"].includes(cue.category))
      bengali(cue.subtitle, "কণ্ঠের বাংলা সংলাপ", 300);
    if (cue.subtitle) bengali(cue.subtitle, "বাংলা সংলাপ", 300);
    if (cue.character !== "*") bengali(cue.character, "চরিত্রের নাম", 100);
    finite(cue.weight, 0.01, 100);
    finite(cue.cooldown, 0, 300);
    finite(cue.delay, 0, 10);
    finite(cue.maxRepetitions, 0, 1000);
    finite(cue.priority, 0, 10);
    finite(cue.maxDistance, 1, 200);
  }
  return structuredClone({ ...c, assets: knownAssets });
}
export type ContentState = {
  draft: AudioContent;
  published: AudioContent;
  history: { id: string; at: string; content: AudioContent }[];
  draftSnapshots: {
    id: string;
    at: string;
    reason: string;
    content: AudioContent;
  }[];
  audit: { at: string; action: string }[];
};
export class ContentStore {
  state!: ContentState;
  private queue: Promise<unknown> = Promise.resolve();
  readonly directory: string;
  readonly root: string;
  constructor(directory: string, root: string) {
    this.directory = directory;
    this.root = root;
  }
  async init() {
    await mkdir(join(this.directory, "uploads"), { recursive: true });
    try {
      this.state = JSON.parse(
        await readFile(join(this.directory, "content.json"), "utf8"),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      let content = defaultAudioContent();
      try {
        content = JSON.parse(
          await readFile(
            join(this.root, "public/assets/audio/catalog.json"),
            "utf8",
          ),
        );
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      this.state = {
        draft: content,
        published: structuredClone(content),
        history: [],
        draftSnapshots: [],
        audit: [],
      };
      await this.persist();
    }
    // Existing installations predate draft snapshots; preserve their content as-is.
    this.state.draftSnapshots ??= [];
    // Only an untouched, unconfigured factory store can adopt newly shipped defaults.
    let unconfigured = false;
    try {
      await readFile(join(this.directory, "admin.json"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") unconfigured = true;
      else throw e;
    }
    const seed = defaultAudioContent();
    if (
      unconfigured &&
      this.state.audit.length === 0 &&
      this.state.history.length === 0 &&
      this.state.draft.revision === 1 &&
      this.state.published.revision === 1 &&
      JSON.stringify(this.state.draft.tracks) === JSON.stringify(seed.tracks) &&
      JSON.stringify(this.state.draft.cues) === JSON.stringify(seed.cues) &&
      this.state.draft.assets.length === seed.assets.length
    ) {
      const bundle = await this.bundle();
      if (
        bundle.assets.some(
          (a) => !this.state.draft.assets.some((known) => known.id === a.id),
        )
      ) {
        try {
          await writeFile(
            join(this.directory, "factory-before-audio-upgrade.json"),
            JSON.stringify(this.state, null, 2),
            { flag: "wx", mode: 0o600 },
          );
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        }
        this.addBundled(bundle);
        this.state.published = structuredClone(this.state.draft);
        this.state.audit.push({
          at: new Date().toISOString(),
          action: "প্রাথমিক শব্দের প্যাক সম্পূর্ণ",
        });
        await this.persist();
      }
    }
  }
  private async bundle(): Promise<AudioContent> {
    return JSON.parse(
      await readFile(
        join(this.root, "public/assets/audio/catalog.json"),
        "utf8",
      ),
    );
  }
  private addBundled(bundle: AudioContent) {
    for (const asset of bundle.assets)
      if (!this.state.draft.assets.some((a) => a.id === asset.id))
        this.state.draft.assets.push(asset);
    for (const cue of bundle.cues)
      if (!this.state.draft.cues.some((c) => c.id === cue.id))
        this.state.draft.cues.push(cue);
    for (const track of bundle.tracks)
      if (!this.state.draft.tracks.some((t) => t.id === track.id))
        this.state.draft.tracks.push(track);
  }
  private nextRevision() {
    return (
      Math.max(
        this.state.draft.revision,
        this.state.published.revision,
        ...this.state.history.map((entry) => entry.content.revision),
        ...this.state.draftSnapshots.map((entry) => entry.content.revision),
      ) + 1
    );
  }
  private snapshotDraft(reason: string) {
    this.state.draftSnapshots.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      reason,
      content: structuredClone(this.state.draft),
    });
  }
  private knownAssets() {
    const assets = new Map<string, AudioContent["assets"][number]>();
    for (const content of [
      this.state.draft,
      this.state.published,
      ...this.state.history.map((entry) => entry.content),
      ...this.state.draftSnapshots.map((entry) => entry.content),
    ])
      for (const asset of content.assets)
        if (!assets.has(asset.id)) assets.set(asset.id, structuredClone(asset));
    return [...assets.values()];
  }
  async importBundle() {
    const bundle = await this.bundle();
    return this.mutate(() => {
      this.addBundled(bundle);
      this.state.draft.revision = this.nextRevision();
      this.state.audit.push({
        at: new Date().toISOString(),
        action: "প্রকল্পের নতুন শব্দ খসড়ায় যোগ",
      });
      return this.state.draft;
    });
  }
  private async persist() {
    const temp = join(this.directory, `content-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    await rename(temp, join(this.directory, "content.json"));
  }
  mutate<T>(fn: () => T | Promise<T>): Promise<T> {
    const work = this.queue.then(async () => {
      const old = structuredClone(this.state);
      try {
        const result = await fn();
        await this.persist();
        return result;
      } catch (e) {
        this.state = old;
        throw e;
      }
    });
    this.queue = work.catch(() => {});
    return work;
  }
  save(input: unknown, revision: number) {
    return this.mutate(() => {
      if (revision !== this.state.draft.revision)
        throw new ApiError(
          409,
          "অন্য পরিবর্তন এসেছে। তালিকা হালনাগাদ করে আবার চেষ্টা করুন।",
        );
      const nextRevision = this.nextRevision();
      this.state.draft = validateContent(input, this.state.draft.assets);
      this.state.draft.revision = nextRevision;
      this.state.audit.push({
        at: new Date().toISOString(),
        action: "খসড়া সংরক্ষণ",
      });
      return this.state.draft;
    });
  }
  publish(revision: number) {
    return this.mutate(() => {
      if (revision !== this.state.draft.revision)
        throw new ApiError(409, "প্রকাশের আগে সর্বশেষ খসড়া সংরক্ষণ করুন।");
      validateContent(this.state.draft, this.state.draft.assets);
      const nextRevision = this.nextRevision();
      this.state.history.push({
        id: randomUUID(),
        at: new Date().toISOString(),
        content: structuredClone(this.state.published),
      });
      this.state.published = structuredClone(this.state.draft);
      this.state.published.revision = nextRevision;
      this.state.draft.revision = this.state.published.revision;
      this.state.audit.push({
        at: new Date().toISOString(),
        action: "শব্দ প্রকাশ",
      });
      return this.state.published;
    });
  }
  rollback(id: string, expectedRevision?: number) {
    return this.mutate(() => {
      if (
        expectedRevision !== undefined &&
        expectedRevision !== this.state.draft.revision
      )
        throw new ApiError(
          409,
          "অন্য পরিবর্তন এসেছে। তালিকা হালনাগাদ করে আবার চেষ্টা করুন।",
        );
      const entry = this.state.history.find((h) => h.id === id);
      if (!entry) throw new ApiError(404, "আগের প্রকাশ পাওয়া যায়নি।");
      const revision = this.nextRevision(),
        assets = this.knownAssets();
      this.snapshotDraft("আগের প্রকাশ ফিরিয়ে আনার আগে");
      this.state.history.push({
        id: randomUUID(),
        at: new Date().toISOString(),
        content: structuredClone(this.state.published),
      });
      this.state.published = structuredClone(entry.content);
      this.state.published.revision = revision;
      this.state.draft = structuredClone(this.state.published);
      // Keep every uploaded asset selectable in the draft. Published content remains
      // the exact restored publication and never inherits unpublished uploads here.
      this.state.draft.assets = assets;
      this.state.audit.push({
        at: new Date().toISOString(),
        action: "আগের প্রকাশ ফিরিয়ে আনা",
      });
      return this.state.published;
    });
  }
  restoreDraft(id: string, expectedRevision: number) {
    return this.mutate(() => {
      if (expectedRevision !== this.state.draft.revision)
        throw new ApiError(
          409,
          "অন্য পরিবর্তন এসেছে। তালিকা হালনাগাদ করে আবার চেষ্টা করুন।",
        );
      const entry = this.state.draftSnapshots.find(
        (snapshot) => snapshot.id === id,
      );
      if (!entry) throw new ApiError(404, "সংরক্ষিত খসড়া পাওয়া যায়নি।");
      const revision = this.nextRevision(),
        assets = this.knownAssets();
      this.snapshotDraft("সংরক্ষিত খসড়া ফিরিয়ে আনার আগে");
      this.state.draft = structuredClone(entry.content);
      this.state.draft.assets = assets;
      this.state.draft.revision = revision;
      this.state.audit.push({
        at: new Date().toISOString(),
        action: "সংরক্ষিত খসড়া ফিরিয়ে আনা",
      });
      return this.state.draft;
    });
  }
}
