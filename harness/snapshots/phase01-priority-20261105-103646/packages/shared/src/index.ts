export * from "./quality.ts";
export * from "./audio.ts";
export * from "./street-surfaces.ts";
export * from "./tutorial.ts";
export * from "./spawns.ts";
export type Item = "egg" | "sandal";
export type Role = "leader" | "worker" | "civilian";
export const bn = (value: number) =>
  new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 0 }).format(value);
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
  items: { egg: "ডিম", sandal: "রাবারের স্যান্ডেল" },
  shapingSample:
    "স্বাধীনতা • প্রতিশ্রুতি • ক্ষুদ্র • শ্রদ্ধা • দৃষ্টি • কর্মী • র‍্যাফেল • কৌতুক!",
} as const;
export const points: Record<Item, number> = { egg: 5, sandal: 8 };
export function rewardForHit(role: Role, item: Item) {
  return role === "civilian" ? 0 : points[item];
}
export function launchVelocity(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  flight = 0.65,
) {
  return {
    x: (to.x - from.x) / flight,
    y: (to.y - from.y + 4.905 * flight * flight) / flight,
    z: (to.z - from.z) / flight,
  };
}
export const playerCollisionRadius = 0.32;
export function canWalk(
  x: number,
  z: number,
  obstacles: readonly { x: number; z: number; w: number; d: number }[],
  radius = playerCollisionRadius,
) {
  return (
    Math.abs(x) < 21.4 &&
    z > -18.8 &&
    z < 22.5 &&
    !obstacles.some(
      (o) =>
        Math.abs(x - o.x) < o.w / 2 + radius &&
        Math.abs(z - o.z) < o.d / 2 + radius,
    )
  );
}
