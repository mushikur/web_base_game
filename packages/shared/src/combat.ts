import { isAreaId } from "./world-layout.ts";

export const combatItems = {
  egg: {
    label: "ডিম",
    score: 5,
    resolve: 25,
    range: 14,
    aim: 0.93,
    quantity: 6,
    cooldown: 0.8,
    motion: "Throw",
    contact: 0,
  },
  sandal: {
    label: "রাবারের স্যান্ডেল",
    score: 8,
    resolve: 40,
    range: 14,
    aim: 0.93,
    quantity: 6,
    cooldown: 0.8,
    motion: "Throw",
    contact: 0,
  },
  baton: {
    label: "ফোলানো লাঠি",
    score: 12,
    resolve: 30,
    range: 2.7,
    aim: 0.69,
    quantity: 4,
    cooldown: 0.85,
    motion: "BatonSwing",
    contact: 0.32,
  },
  sound: {
    label: "মাইকের আওয়াজ",
    score: 15,
    resolve: 24,
    range: 8.5,
    aim: 0.84,
    quantity: 3,
    cooldown: 1.05,
    motion: "SoundBurst",
    contact: 0.34,
  },
  spark: {
    label: "রঙিন ঝিলিক",
    score: 20,
    resolve: 32,
    range: 5.5,
    aim: 0.87,
    quantity: 3,
    cooldown: 0.95,
    motion: "SparkPop",
    contact: 0.31,
  },
  hand: {
    label: "খালি হাত",
    score: 2,
    resolve: 12,
    range: 1.85,
    aim: 0.68,
    quantity: 0,
    cooldown: 0.58,
    motion: "PalmTap",
    contact: 0.23,
  },
} as const;

export type Item = keyof typeof combatItems;
export type PickupItem = Exclude<Item, "hand">;
export type Role = "leader" | "worker" | "civilian";
export const itemOrder = [
  "egg",
  "sandal",
  "baton",
  "sound",
  "spark",
  "hand",
] as const satisfies readonly Item[];
export const isItem = (item: unknown): item is Item =>
  typeof item === "string" && Object.hasOwn(combatItems, item);
export const itemNames = Object.fromEntries(
  itemOrder.map((item) => [item, combatItems[item].label]),
) as Record<Item, string>;
export const points = Object.fromEntries(
  itemOrder.map((item) => [item, combatItems[item].score]),
) as Record<Item, number>;
export function rewardForHit(role: Role, item: Item) {
  return role === "civilian" ? 0 : combatItems[item].score;
}

export type CombatRecord = {
  score: number;
  hits: number;
  civilianHits: number;
  outrage: number;
  bestCombo: number;
  evidence: string[];
  used: Record<Item, number>;
  elapsed: number;
};

export function newCombatRecord(): CombatRecord {
  return {
    score: 0,
    hits: 0,
    civilianHits: 0,
    outrage: 0,
    bestCombo: 0,
    evidence: [],
    elapsed: 0,
    used: { egg: 0, sandal: 0, baton: 0, sound: 0, spark: 0, hand: 0 },
  };
}

export function parseCombatRecord(value: unknown): CombatRecord {
  const result = newCombatRecord();
  if (!value || typeof value !== "object") return result;
  const source = value as Partial<CombatRecord>;
  const count = (n: unknown, max = 1_000_000) =>
    typeof n === "number" && Number.isFinite(n)
      ? Math.min(max, Math.max(0, Math.floor(n)))
      : 0;
  result.score = count(source.score);
  result.hits = count(source.hits);
  result.civilianHits = count(source.civilianHits);
  result.outrage = count(source.outrage, 100);
  result.bestCombo = count(source.bestCombo);
  result.elapsed = count(source.elapsed);
  for (const item of itemOrder) result.used[item] = count(source.used?.[item]);
  if (Array.isArray(source.evidence)) {
    result.evidence = [...new Set(source.evidence.filter(isAreaId))];
  }
  return result;
}

export const comboWindowSeconds = 3;
export function recordCombatHit(
  record: CombatRecord,
  item: Item,
  role: Role,
  combo: number,
  configuredScore: number = combatItems[item].score,
) {
  const reward = role === "civilian" ? 0 : configuredScore;
  if (role === "civilian") {
    record.civilianHits++;
    record.outrage = Math.min(100, record.outrage + 14);
    return { reward, combo: 0 };
  }
  record.score += reward;
  record.hits++;
  const nextCombo = combo + 1;
  record.bestCombo = Math.max(record.bestCombo, nextCombo);
  return { reward, combo: nextCombo };
}
