import {
  combatItems,
  itemNames,
  itemOrder,
  type Item,
  type Role,
} from "./combat.ts";
import { areaById, worldAreas, type AreaId } from "./world-layout.ts";

export const content = {
  title: "নেতা উঠছে!",
  slogan: "প্রতিশ্রুতি অনেক। রাস্তাটা ছাড়েন!",
  location: "প্রতিশ্রুতি মোড়",
  teaShop: "কেটলি কেবিনেট",
  mission:
    "রাস্তা আটকে সভা? আগে ডিম আর স্যান্ডেল কুড়িয়ে নিন। তারপর সামনে গিয়ে লক্ষ্য করে ছুড়ুন।",
  civilianWarning: "পথচারীকে নয়! রাস্তা ছাড়াতে এসেছেন, ঝামেলা বাড়াতে নয়।",
  leader: "বজলু প্রতিশ্রুতি",
  workers: ["পল্টু পোস্টার", "মন্টু মাইক", "কমল কমিটি"],
  civilians: ["রহিম চাচা", "আসমা আপা", "জয়নাল ভাই", "নীলা", "চা-মামা কুদ্দুস"],
  items: itemNames,
  shapingSample:
    "স্বাধীনতা • প্রতিশ্রুতি • ক্ষুদ্র • শ্রদ্ধা • দৃষ্টি • কর্মী • র‍্যাফেল • কৌতুক!",
} as const;

export const themes = {
  original: "গলির সবুজ",
  indigo: "নীলচে ঢাকা",
  terracotta: "পোড়ামাটির পাড়া",
} as const;
export const templates = {
  original: "মূল পোশাক",
  shirt: "সুতির জামা",
  panjabi: "পাঞ্জাবি",
  dupatta: "ওড়না ও কামিজ",
} as const;
export const hairStyles = {
  original: "মূল সাজ",
  short: "ছোট চুল",
  long: "লম্বা চুল",
} as const;
export const beardStyles = {
  original: "মূল সাজ",
  clean: "গোঁফ ছাড়া",
  moustache: "গোঁফ",
} as const;
export const rideNames = {
  cng: "সবুজ সিএনজি",
  rickshaw: "ফুলেল রিকশা",
  auto: "ব্যাটারির অটোরিকশা",
  bicycle: "সাইকেল",
} as const;
export type CatalogRide = keyof typeof rideNames;
export type CatalogAssetKind = "image" | "model";
export type CatalogAsset = {
  id: string;
  kind: CatalogAssetKind;
  name: string;
  attribution: string;
  url: string;
  mime: string;
  bytes: number;
};
export type CharacterContent = {
  name: string;
  color: string;
  height: number;
  build?: number;
  hair?: keyof typeof hairStyles;
  beard?: keyof typeof beardStyles;
  template: keyof typeof templates;
  portrait: string;
  model: string;
};
export type GameCatalog = {
  schemaVersion: 1;
  revision: number;
  branding: {
    title: string;
    slogan: string;
    logo: string;
    theme: keyof typeof themes;
  };
  characters: Record<string, CharacterContent>;
  areas: Record<
    AreaId,
    { name: string; target: string; objective: string; tea: string }
  >;
  items: Record<Item, { name: string; score: number; quantity: number }>;
  vehicles: Record<CatalogRide, { name: string; speed: number }>;
  behavior: Record<Role, number>;
  newspaper: {
    name: string;
    calm: string;
    disputed: string;
    photo: string;
    quote: string;
  };
  assets: CatalogAsset[];
};

export const characterDefaults = [
  ["player", "সজল পথিক", "#4b657f"],
  ["leader", content.leader, "#e5d9ae"],
  ...content.workers.map((name, i) => [
    `worker-${i}`,
    name,
    i === 1 ? "#6f433a" : "#47776d",
  ]),
  ...content.civilians.map((name, i) => [
    `civilian-${i}`,
    name,
    ["#c9a471", "#c57568", "#a3b4a4", "#6491a0", "#cdbfa0"][i],
  ]),
] as const;

export function defaultGameCatalog(): GameCatalog {
  return {
    schemaVersion: 1,
    revision: 1,
    branding: {
      title: content.title,
      slogan: content.slogan,
      logo: "",
      theme: "original",
    },
    characters: Object.fromEntries(
      characterDefaults.map(([id, name, color]) => [
        id,
        {
          name,
          color,
          height: 1,
          build: 1,
          hair: "original",
          beard: "original",
          template: "original",
          portrait: "",
          model: "",
        },
      ]),
    ),
    areas: Object.fromEntries(
      worldAreas.map((area) => [
        area.id,
        {
          name: area.name,
          target: area.leaderName,
          objective: area.objective,
          tea: content.teaShop,
        },
      ]),
    ) as GameCatalog["areas"],
    items: Object.fromEntries(
      itemOrder.map((id) => [
        id,
        {
          name: combatItems[id].label,
          score: combatItems[id].score,
          quantity: combatItems[id].quantity,
        },
      ]),
    ) as GameCatalog["items"],
    vehicles: Object.fromEntries(
      Object.entries(rideNames).map(([id, name]) => [id, { name, speed: 1 }]),
    ) as GameCatalog["vehicles"],
    behavior: { leader: 1, worker: 1, civilian: 1 },
    newspaper: {
      name: "দৈনিক গলির খবর",
      calm: "রাস্তা খুলতেই কেটলি কেবিনেটে দ্বিতীয় দফা চা",
      disputed: "পথ খুলেছে, তবু পাড়ায় প্রশ্নের শেষ নেই",
      photo: "পথ খুলেছে, ছবিতেই মিলল পাড়ার খবর",
      quote: "চিনি কম দিছি, খবরটা কিন্তু মিষ্টি!",
    },
    assets: [],
  };
}

export const catalogAssetUrl = (catalog: GameCatalog, id: string) =>
  catalog.assets.find((asset) => asset.id === id)?.url;

export function catalogArea(catalog: GameCatalog, id: AreaId) {
  const display = catalog.areas[id];
  return {
    ...areaById(id),
    name: display.name,
    leaderName:
      id === "promise-junction"
        ? catalog.characters.leader.name
        : display.target,
    objective: display.objective,
  };
}
