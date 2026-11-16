export type Quality = "desktop" | "desktop-medium" | "mobile" | "mobile-low";

export type QualityProfile = {
  label: string;
  /** Babylon hardware scaling: a larger value renders fewer pixels. */
  scale: number;
  shadow: 256 | 512 | 1024 | 2048;
  particles: number;
  view: number;
  ao: boolean;
  bloom: boolean;
  activeDistance: number;
  prefetchDistance: number;
  shadowDistance: number;
};

export const qualityOrder: readonly Quality[] = [
  "desktop",
  "desktop-medium",
  "mobile",
  "mobile-low",
];

/** Presets describe renderer/streaming budgets, not measured hardware FPS.
 * Existing desktop/mobile IDs and their original numerical budgets are kept. */
export const qualitySettings = {
  desktop: {
    label: "ডেস্কটপ • উচ্চ",
    scale: 1,
    shadow: 2048,
    particles: 35,
    view: 120,
    ao: true,
    bloom: true,
    activeDistance: 34,
    prefetchDistance: 65,
    shadowDistance: 34,
  },
  "desktop-medium": {
    label: "ডেস্কটপ • মাঝারি",
    scale: 1.2,
    shadow: 1024,
    particles: 24,
    view: 100,
    ao: false,
    bloom: true,
    activeDistance: 30,
    prefetchDistance: 60,
    shadowDistance: 30,
  },
  mobile: {
    label: "মোবাইল • মাঝারি",
    scale: 1.55,
    shadow: 512,
    particles: 8,
    view: 70,
    ao: false,
    bloom: false,
    activeDistance: 26,
    prefetchDistance: 55,
    shadowDistance: 24,
  },
  "mobile-low": {
    label: "মোবাইল • কম",
    scale: 1.9,
    shadow: 256,
    particles: 4,
    view: 55,
    ao: false,
    bloom: false,
    activeDistance: 22,
    prefetchDistance: 45,
    shadowDistance: 20,
  },
} as const satisfies Record<Quality, QualityProfile>;

export function isQuality(value: unknown): value is Quality {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(qualitySettings, value)
  );
}

export const qualityPreferenceKey = "neta-graphics-v1";
export type QualityPreference = { version: 1; profile: Quality };

/** Invalid or unsupported device preferences fall back through the caller's
 * viewport choice. This parser never resets a game, audio or tutorial record. */
export function parseQualityPreference(raw: unknown): QualityPreference | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  if (
    entry.version !== 1 ||
    !isQuality(entry.profile) ||
    Object.keys(entry).length !== 2 ||
    Object.keys(entry).some((key) => key !== "version" && key !== "profile")
  )
    return null;
  return { version: 1, profile: entry.profile };
}
