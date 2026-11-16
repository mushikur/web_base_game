export const weatherOptions = [
  { id: "day", label: "দিনের আলো" },
  { id: "evening", label: "বিকেলের আলো" },
  { id: "night", label: "রাত" },
  { id: "rain", label: "বৃষ্টি" },
] as const;
export type Weather = (typeof weatherOptions)[number]["id"];
