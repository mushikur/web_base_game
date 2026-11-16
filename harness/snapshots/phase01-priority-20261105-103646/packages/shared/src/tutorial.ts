/** Device-only tutorial data. Keep this key separate from audio and server content. */
export const tutorialPreferenceKey = "neta-tutorial-v1";
export const tutorialVersion = 1 as const;
export const tutorialSteps = [
  {
    id: "move",
    icon: "move",
    title: "একটু সামনে হাঁটুন",
    desktop: "WASD বা তীরচিহ্নের বোতাম দিয়ে এগিয়ে যান।",
    mobile: "বাঁয়ের জয়স্টিক টেনে এগিয়ে যান।",
  },
  {
    id: "camera",
    icon: "camera",
    title: "চারপাশ দেখতে ক্যামেরা ঘোরান",
    desktop: "দৃশ্যের ওপর মাউস চেপে টানুন।",
    mobile: "দৃশ্যের ওপর আঙুল বুলিয়ে চারপাশ দেখুন।",
  },
  {
    id: "run",
    icon: "run",
    title: "দৌড়ে এগিয়ে যান",
    desktop: "হাঁটার সঙ্গে Shift চেপে রাখুন।",
    mobile: "দৌড় চালু করে জয়স্টিক টানুন। থামাতে আবার দৌড় ছুঁয়ে দিন।",
  },
  {
    id: "map",
    icon: "map",
    title: "ছোট মানচিত্র খুলুন",
    desktop: "M চাপুন বা মানচিত্র বোতাম বেছে নিন।",
    mobile: "মানচিত্র বোতাম ছুঁয়ে বড় মানচিত্র খুলুন।",
  },
  {
    id: "pickup",
    icon: "pickup",
    title: "কাছের জিনিস কুড়িয়ে নিন",
    desktop: "ডিম বা স্যান্ডেলের কাছে গিয়ে E চাপুন।",
    mobile: "ডিম বা স্যান্ডেলের কাছে গিয়ে কুড়ান বোতাম ছুঁয়ে দিন।",
  },
  {
    id: "select",
    icon: "select",
    title: "সঙ্গে থাকা জিনিস বেছে নিন",
    desktop: "সঙ্গে থাকা জিনিসের 1 বা 2 চাপুন, অথবা মাউসের চাকা ঘোরান।",
    mobile: "সঙ্গে থাকা জিনিসের ঘরটি ছুঁয়ে বেছে নিন।",
  },
  {
    id: "use",
    icon: "use",
    title: "বেছে নেওয়া জিনিস ব্যবহার করুন",
    desktop: "দৃশ্যে একবার ক্লিক করুন বা Enter চাপুন।",
    mobile: "ব্যবহার বোতাম ছুঁয়ে বেছে নেওয়া জিনিস ছুড়ুন।",
  },
  {
    id: "vehicle",
    icon: "vehicle",
    title: "সবুজ সিএনজির কাছে যান",
    desktop: "সিএনজির পাশে গিয়ে Tab বা E চাপুন।",
    mobile: "সিএনজির পাশে গিয়ে গাড়ির বোতাম ছুঁয়ে দিন।",
  },
  {
    id: "board",
    icon: "board",
    title: "সিটে উঠুন, আবার নেমে আসুন",
    desktop: "Tab বা E দিয়ে উঠুন। বসার পরে আবার Tab বা E দিয়ে নামুন।",
    mobile: "গাড়ির বোতাম দিয়ে উঠুন। বসার পরে আবার একই বোতাম দিয়ে নামুন।",
  },
  {
    id: "mission",
    icon: "mission",
    title: "প্রথম অভিযানের চিহ্ন দেখুন",
    desktop: "M দিয়ে মানচিত্র খুলে অভিযানের চিহ্ন বেছে নিন।",
    mobile: "মানচিত্র খুলে অভিযানের চিহ্ন ছুঁয়ে লক্ষ্য দেখুন।",
  },
] as const;

export type TutorialProgress = {
  version: typeof tutorialVersion;
  stepIndex: number;
  status: "active" | "completed" | "skipped";
  vehicleEntered: boolean;
  stepDistance: number;
  cameraRadians: number;
};
/** Events describe completed observations, never held keys or requested actions. */
export type TutorialEvent =
  | { type: "movement"; distance: number; running: boolean }
  | { type: "camera"; radians: number }
  | { type: "map-opened" }
  | { type: "picked-up"; quantity: number }
  | { type: "item-selected"; changed: boolean; owned: boolean }
  | { type: "item-used"; consumed: boolean }
  | { type: "vehicle-interacted" }
  | { type: "vehicle-entered" }
  | { type: "vehicle-exited" }
  | { type: "mission-viewed" };
export type TutorialPreference = {
  version: typeof tutorialVersion;
  dontShowAgain: boolean;
  completed: boolean;
};
export function newTutorialProgress(): TutorialProgress {
  return {
    version: tutorialVersion,
    stepIndex: 0,
    status: "active",
    vehicleEntered: false,
    stepDistance: 0,
    cameraRadians: 0,
  };
}
export function tutorialFinished(progress: TutorialProgress) {
  return progress.status !== "active";
}
export function skipTutorial(progress: TutorialProgress): TutorialProgress {
  return progress.status === "active"
    ? { ...progress, status: "skipped" }
    : progress;
}
const positive = (value: number) => Number.isFinite(value) && value > 0;
export function advanceTutorial(
  progress: TutorialProgress,
  event: TutorialEvent,
): TutorialProgress {
  if (progress.status !== "active") return progress;
  let next = progress,
    done = false;
  switch (progress.stepIndex) {
    case 0:
    case 2:
      if (
        event.type === "movement" &&
        positive(event.distance) &&
        (progress.stepIndex === 0 || event.running)
      ) {
        const threshold = progress.stepIndex === 0 ? 1.1 : 0.85;
        next = {
          ...progress,
          stepDistance: Math.min(
            threshold,
            progress.stepDistance + event.distance,
          ),
        };
        done = next.stepDistance >= threshold;
      }
      break;
    case 1:
      if (
        event.type === "camera" &&
        Number.isFinite(event.radians) &&
        event.radians !== 0
      ) {
        next = {
          ...progress,
          cameraRadians: Math.min(
            0.18,
            progress.cameraRadians + Math.abs(event.radians),
          ),
        };
        done = next.cameraRadians >= 0.18;
      }
      break;
    case 3:
      done = event.type === "map-opened";
      break;
    case 4:
      done =
        event.type === "picked-up" &&
        Number.isSafeInteger(event.quantity) &&
        event.quantity > 0;
      break;
    // Picking up may auto-select an item. An explicit owned selection still counts.
    case 5:
      done = event.type === "item-selected" && event.owned;
      break;
    case 6:
      done = event.type === "item-used" && event.consumed;
      break;
    case 7:
      done = event.type === "vehicle-interacted";
      break;
    case 8:
      if (event.type === "vehicle-entered")
        next = { ...progress, vehicleEntered: true };
      done = event.type === "vehicle-exited" && progress.vehicleEntered;
      break;
    case 9:
      done = event.type === "mission-viewed";
      break;
  }
  if (!done) return next;
  const stepIndex = progress.stepIndex + 1;
  return {
    ...next,
    stepIndex,
    status: stepIndex === tutorialSteps.length ? "completed" : "active",
    vehicleEntered: false,
    stepDistance: 0,
    cameraRadians: 0,
  };
}
export function parseTutorialPreference(input: unknown): TutorialPreference {
  const empty: TutorialPreference = {
    version: tutorialVersion,
    dontShowAgain: false,
    completed: false,
  };
  let value = input;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return empty;
    }
  }
  if (!value || typeof value !== "object") return empty;
  const record = value as Record<string, unknown>;
  if (
    record.version !== tutorialVersion ||
    typeof record.dontShowAgain !== "boolean" ||
    typeof record.completed !== "boolean"
  )
    return empty;
  return {
    version: tutorialVersion,
    dontShowAgain: record.dontShowAgain,
    completed: record.completed,
  };
}
export function shouldShowTutorial(preference: TutorialPreference) {
  return !preference.dontShowAgain && !preference.completed;
}
/** Skip does not award completion. Replay calls newTutorialProgress explicitly. */
export function tutorialPreference(
  progress: TutorialProgress,
  dontShowAgain: boolean,
  previous?: TutorialPreference,
): TutorialPreference {
  return {
    version: tutorialVersion,
    dontShowAgain,
    completed: progress.status === "completed" || previous?.completed === true,
  };
}
