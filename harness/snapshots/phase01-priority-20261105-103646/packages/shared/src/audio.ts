export const audioCategories = [
  "master",
  "music",
  "environment",
  "footsteps",
  "vehicles",
  "combat",
  "voices",
  "crowd",
  "interface",
] as const;
export type AudioCategory = (typeof audioCategories)[number];
export const audioLabels: Record<AudioCategory, string> = {
  master: "সব শব্দ",
  music: "সংগীত",
  environment: "পরিবেশ",
  footsteps: "পায়ের শব্দ",
  vehicles: "যানবাহন",
  combat: "অ্যাকশনের শব্দ",
  voices: "চরিত্রের কণ্ঠ",
  crowd: "জনতার কণ্ঠ",
  interface: "বোতাম ও মেনু",
};
export const surfaces = [
  "asphalt",
  "concrete",
  "brick",
  "dirt",
  "mud",
  "water",
  "metal",
  "shop",
] as const;
export type Surface = (typeof surfaces)[number];
export const surfaceLabels: Record<Surface, string> = {
  asphalt: "পিচঢালা রাস্তা",
  concrete: "কংক্রিট",
  brick: "ইটের পথ",
  dirt: "মাটি",
  mud: "কাদা",
  water: "পানি",
  metal: "ধাতব পাটাতন",
  shop: "দোকানের মেঝে",
};
export const musicContexts = [
  "menu",
  "exploration",
  "mission",
  "chase",
  "newspaper",
] as const;
export type MusicContext = (typeof musicContexts)[number];
export const musicContextLabels: Record<MusicContext, string> = {
  menu: "প্রচ্ছদ",
  exploration: "ঘোরাঘুরি",
  mission: "অভিযান",
  chase: "ধাওয়া",
  newspaper: "খবরের কাগজ",
};
export const actionEvents = {
  jump: "লাফ",
  landing: "মাটিতে নামা",
  pickup: "জিনিস কুড়ানো",
  equip: "জিনিস বাছা",
  throw: "ছোড়া",
  hand: "হাতের আঘাত",
  sandal: "স্যান্ডেলের আঘাত",
  egg: "ডিমের আঘাত",
  rubberStone: "রাবারের পাথর",
  baton: "ফোলানো লাঠি",
  spark: "কাল্পনিক ঝিলিক",
  hit: "চরিত্রের প্রতিক্রিয়া",
  marker: "অভিযানের চিহ্ন",
  complete: "অভিযান সম্পন্ন",
  enter: "গাড়িতে ওঠা",
  exit: "গাড়ি থেকে নামা",
  door: "দরজা",
  horn: "হর্ন",
  engineStart: "ইঞ্জিন চালু",
  engineIdle: "ইঞ্জিনের গুঞ্জন",
  acceleration: "গতি বাড়ানো",
  brake: "ব্রেক",
  collision: "ধাক্কা",
  siren: "অ্যাম্বুলেন্সের সাইরেন",
  newspaper: "খবরের কাগজ খোলা",
  menu: "বোতাম চাপা",
  traffic: "দূরের যানবাহন",
  bell: "রিকশার ঘণ্টি",
  cng: "সিএনজির ইঞ্জিন",
  bus: "বাসের হর্ন",
  tea: "চায়ের দোকান",
  crow: "কাকের ডাক",
  construction: "দূরের নির্মাণ",
  rain: "বৃষ্টি",
  insects: "রাতের পোকা",
  microphone: "দূরের মাইক",
} as const;
export type AudioEvent = keyof typeof actionEvents;
export type AudioSettings = Record<
  AudioCategory,
  { volume: number; muted: boolean }
>;
export function defaultAudioSettings(): AudioSettings {
  return Object.fromEntries(
    audioCategories.map((key) => [
      key,
      {
        volume: key === "master" ? 0.75 : key === "music" ? 0.35 : 0.75,
        muted: false,
      },
    ]),
  ) as AudioSettings;
}
export function parseAudioSettings(value: unknown): AudioSettings {
  const result = defaultAudioSettings();
  if (!value || typeof value !== "object") return result;
  for (const key of audioCategories) {
    const row = (value as Record<string, unknown>)[key];
    if (row && typeof row === "object") {
      const { volume, muted } = row as { volume?: unknown; muted?: unknown };
      if (typeof volume === "number" && Number.isFinite(volume))
        result[key].volume = Math.max(0, Math.min(1, volume));
      if (typeof muted === "boolean") result[key].muted = muted;
    }
  }
  return result;
}
export type AudioAsset = {
  id: string;
  name: string;
  url: string;
  mime: string;
  bytes: number;
  license: string;
  attribution: string;
  originalName?: string;
};
export type MusicTrack = {
  id: string;
  name: string;
  assetId: string;
  contexts: MusicContext[];
  volume: number;
  loop: boolean;
  order: number;
  random: boolean;
  fadeIn: number;
  fadeOut: number;
  enabled: boolean;
};
export type AudioCue = {
  id: string;
  name: string;
  assetId: string;
  trigger: string;
  category: Exclude<AudioCategory, "master" | "music">;
  character: string;
  subtitle: string;
  volume: number;
  weight: number;
  cooldown: number;
  delay: number;
  maxRepetitions: number;
  priority: number;
  enabled: boolean;
  spatial: boolean;
  maxDistance: number;
};
export type AudioContent = {
  schemaVersion: 1;
  revision: number;
  assets: AudioAsset[];
  tracks: MusicTrack[];
  cues: AudioCue[];
};
export const builtinEvents = Object.entries(actionEvents).map(([id, name]) => ({
  id,
  name,
}));
export function defaultAudioContent(): AudioContent {
  const assets: AudioAsset[] = [];
  for (const { id, name } of builtinEvents)
    assets.push({
      id,
      name,
      url: `/assets/audio/${id}.wav`,
      mime: "audio/wav",
      bytes: 0,
      license: "প্রকল্পের মৌলিক শব্দ",
      attribution: "নেতা উঠছে! — নিজস্ব শব্দ নির্মাণ",
    });
  for (const surface of surfaces)
    for (let variant = 0; variant < 3; variant++)
      assets.push({
        id: `step-${surface}-${variant}`,
        name: `${surfaceLabels[surface]} — ${["১", "২", "৩"][variant]}`,
        url: `/assets/audio/step-${surface}-${variant}.wav`,
        mime: "audio/wav",
        bytes: 0,
        license: "প্রকল্পের মৌলিক শব্দ",
        attribution: "নেতা উঠছে! — নিজস্ব শব্দ নির্মাণ",
      });
  for (const context of musicContexts)
    assets.push({
      id: `music-${context}`,
      name: `${musicContextLabels[context]} — ঢাকার সুর`,
      url: `/assets/audio/music-${context}.wav`,
      mime: "audio/wav",
      bytes: 0,
      license: "প্রকল্পের মৌলিক সুর",
      attribution: "নেতা উঠছে! — নিজস্ব সুর ও শব্দ নির্মাণ",
    });
  return {
    schemaVersion: 1,
    revision: 1,
    assets,
    tracks: musicContexts.map((context, i) => ({
      id: `track-${context}`,
      name: `${musicContextLabels[context]} — ঢাকার সুর`,
      assetId: `music-${context}`,
      contexts: [context],
      volume: 0.55,
      loop: true,
      order: i,
      random: false,
      fadeIn: 2,
      fadeOut: 2,
      enabled: true,
    })),
    cues: builtinEvents.map(({ id, name }) => ({
      id: `cue-${id}`,
      name,
      assetId: id,
      trigger: id,
      category: [
        "enter",
        "exit",
        "door",
        "horn",
        "engineStart",
        "engineIdle",
        "acceleration",
        "brake",
        "collision",
        "siren",
        "cng",
        "bus",
      ].includes(id)
        ? "vehicles"
        : [
              "menu",
              "marker",
              "complete",
              "newspaper",
              "equip",
              "pickup",
            ].includes(id)
          ? "interface"
          : [
                "traffic",
                "bell",
                "tea",
                "crow",
                "construction",
                "rain",
                "insects",
                "microphone",
              ].includes(id)
            ? "environment"
            : "combat",
      character: "*",
      subtitle: "",
      volume: 0.65,
      weight: 1,
      cooldown: 0.12,
      delay: 0,
      maxRepetitions: 0,
      priority: 1,
      enabled: true,
      spatial: !["menu", "complete", "newspaper", "equip", "pickup"].includes(
        id,
      ),
      maxDistance: 45,
    })),
  };
}
export type AudioPoint = { x: number; y?: number; z: number };
export function audioOccluded(
  from: AudioPoint,
  to: AudioPoint,
  obstacles: readonly {
    x: number;
    z: number;
    w: number;
    d: number;
    h?: number;
  }[],
) {
  for (const o of obstacles) {
    if ((o.h ?? 0) < 1.9) continue;
    let near = 0,
      far = 1;
    for (const [start, delta, min, max] of [
      [from.x, to.x - from.x, o.x - o.w / 2, o.x + o.w / 2],
      [from.z, to.z - from.z, o.z - o.d / 2, o.z + o.d / 2],
    ]) {
      if (Math.abs(delta) < 1e-8) {
        if (start < min || start > max) {
          near = 2;
          break;
        }
      } else {
        let a = (min - start) / delta,
          b = (max - start) / delta;
        if (a > b) [a, b] = [b, a];
        near = Math.max(near, a);
        far = Math.min(far, b);
      }
    }
    if (near <= far && near < 0.99 && far > 0.01) return true;
  }
  return false;
}
