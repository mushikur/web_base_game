import {
  itemOrder,
  type CombatRecord,
} from "../../../packages/shared/src/combat.ts";
import {
  isAreaId,
  type AreaId,
} from "../../../packages/shared/src/world-layout.ts";
import { defaultGameCatalog, type GameCatalog } from "../../../packages/shared/src/catalog.ts";

export type NewspaperEdition = ReturnType<typeof createNewspaper>;
const number = new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("bn-BD", {
  dateStyle: "long",
  timeZone: "Asia/Dhaka",
});

export function createNewspaper(
  completed: readonly AreaId[],
  record: CombatRecord,
  image: string,
  today = new Date(),
  catalog: GameCatalog = defaultGameCatalog(),
) {
  const areas = completed.map((id) => catalog.areas[id].name);
  const used = itemOrder
    .filter((item) => record.used[item] > 0)
    .map((item) => ({ label: catalog.items[item].name, count: record.used[item] }));
  const evidence = record.evidence
    .filter(isAreaId)
    .map((id) => catalog.areas[id].name);
  const unsettled = record.civilianHits > 0 || record.outrage > 0;
  const headline = unsettled
    ? catalog.newspaper.disputed
    : evidence.length >= 3
      ? catalog.newspaper.photo
      : catalog.newspaper.calm;
  const article = [
    `আজ ${catalog.characters.player.name}ের অভিযানে ${number.format(areas.length)}টি এলাকার পথ খুলেছে। ${areas.join(", ")} থেকে সহায়তার গাড়ি নিরাপদে বেরিয়েছে।`,
    unsettled
      ? `পথচারীর গায়ে লেগেছে ${number.format(record.civilianHits)} বার। পাড়ার লোকজন নিরাপদে চলার নিশ্চয়তা চাইছেন।`
      : "পথচারীর গায়ে লাগার কোনো ঘটনা নথিভুক্ত হয়নি। চায়ের দোকানে এখন অভিযান নিয়েই আলাপ।",
    evidence.length > 0
      ? `অভিযানের ${number.format(evidence.length)}টি এলাকার ছবি জমা হয়েছে।`
      : "এই অভিযানে আলাদা কোনো প্রমাণের ছবি জমা পড়েনি।",
  ].join(" ");
  return {
    name: catalog.newspaper.name,
    date: date.format(today),
    headline,
    article,
    quote: unsettled
      ? "রাস্তা পাইছি, এখন একটু সাবধানে চলেন।"
      : catalog.newspaper.quote,
    title: unsettled
      ? "পাড়ার বিতর্কিত পথিক"
      : evidence.length >= 3
        ? "গলির আলোকচিত্রী"
        : "পথ খোলার ওস্তাদ",
    areas,
    used,
    evidence,
    image,
    score: record.score,
    outrage: record.outrage,
    bestCombo: record.bestCombo,
    elapsed: Math.floor(record.elapsed),
  };
}
