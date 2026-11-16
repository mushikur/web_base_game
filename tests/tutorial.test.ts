import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceTutorial,
  newTutorialProgress,
  parseTutorialPreference,
  shouldShowTutorial,
  skipTutorial,
  tutorialFinished,
  tutorialPreference,
  tutorialPreferenceKey,
  tutorialSteps,
  type TutorialEvent,
} from "../packages/shared/src/tutorial.ts";

const actions: TutorialEvent[] = [
  { type: "movement", distance: 1.2, running: false },
  { type: "camera", radians: 0.2 },
  { type: "movement", distance: 1, running: true },
  { type: "map-opened" },
  { type: "picked-up", quantity: 3 },
  { type: "item-selected", changed: false, owned: true },
  { type: "item-used", consumed: true },
  { type: "vehicle-interacted" },
  { type: "vehicle-entered" },
  { type: "vehicle-exited" },
  { type: "mission-viewed" },
];
test("tutorial advances ten Bengali lessons only from ordered actual observations", () => {
  assert.equal(tutorialSteps.length, 10);
  for (const step of tutorialSteps) {
    assert.match(step.title, /[\u0980-\u09ff]/u);
    assert.match(step.desktop, /[\u0980-\u09ff]/u);
    assert.match(step.mobile, /[\u0980-\u09ff]/u);
    assert.ok(step.icon);
  }
  let progress = newTutorialProgress();
  assert.equal(advanceTutorial(progress, { type: "mission-viewed" }), progress);
  for (const [index, action] of actions.entries()) {
    progress = advanceTutorial(progress, action);
    assert.equal(
      progress.stepIndex,
      index < 8 ? index + 1 : index === 8 ? 8 : index,
    );
  }
  assert.equal(progress.status, "completed");
  assert.ok(tutorialFinished(progress));
  assert.equal(advanceTutorial(progress, actions[0]), progress);
});
test("blocked, invalid and non-running motion cannot falsely pass movement lessons", () => {
  let progress = newTutorialProgress();
  for (const distance of [0, -1, Infinity, NaN])
    assert.equal(
      advanceTutorial(progress, { type: "movement", distance, running: true }),
      progress,
    );
  progress = advanceTutorial(progress, {
    type: "movement",
    distance: 0.6,
    running: false,
  });
  assert.equal(progress.stepIndex, 0);
  progress = advanceTutorial(progress, {
    type: "movement",
    distance: 0.6,
    running: false,
  });
  assert.equal(progress.stepIndex, 1);
  assert.equal(
    advanceTutorial(progress, { type: "camera", radians: NaN }),
    progress,
  );
  progress = advanceTutorial(progress, { type: "camera", radians: -0.1 });
  assert.equal(progress.stepIndex, 1);
  progress = advanceTutorial(progress, { type: "camera", radians: 0.1 });
  assert.equal(progress.stepIndex, 2);
  assert.equal(
    advanceTutorial(progress, {
      type: "movement",
      distance: 100,
      running: false,
    }),
    progress,
  );
  progress = advanceTutorial(progress, {
    type: "movement",
    distance: 0.4,
    running: true,
  });
  assert.equal(progress.stepIndex, 2);
  progress = advanceTutorial(progress, {
    type: "movement",
    distance: 0.5,
    running: true,
  });
  assert.equal(progress.stepIndex, 3);
});
test("empty pickup, unavailable selection, empty use and exit without entry do not advance", () => {
  let progress = actions
    .slice(0, 4)
    .reduce(advanceTutorial, newTutorialProgress());
  assert.equal(
    advanceTutorial(progress, { type: "picked-up", quantity: 0 }),
    progress,
  );
  assert.equal(
    advanceTutorial(progress, { type: "picked-up", quantity: 0.2 }),
    progress,
  );
  progress = advanceTutorial(progress, actions[4]);
  assert.equal(
    advanceTutorial(progress, {
      type: "item-selected",
      changed: true,
      owned: false,
    }),
    progress,
  );
  progress = advanceTutorial(progress, actions[5]);
  assert.equal(
    progress.stepIndex,
    6,
    "explicit selection of an owned auto-selected item works",
  );
  assert.equal(
    advanceTutorial(progress, { type: "item-used", consumed: false }),
    progress,
  );
  progress = advanceTutorial(advanceTutorial(progress, actions[6]), actions[7]);
  assert.equal(advanceTutorial(progress, { type: "vehicle-exited" }), progress);
  progress = advanceTutorial(progress, { type: "vehicle-entered" });
  assert.equal(progress.stepIndex, 8);
  assert.equal(progress.vehicleEntered, true);
  progress = advanceTutorial(progress, { type: "vehicle-exited" });
  assert.equal(progress.stepIndex, 9);
});
test("Skip, completed preference, version repair and replay stay separate from audio data", () => {
  const fresh = parseTutorialPreference(null);
  assert.ok(shouldShowTutorial(fresh));
  const skipped = skipTutorial(newTutorialProgress());
  assert.equal(skipped.status, "skipped");
  assert.ok(tutorialFinished(skipped));
  assert.ok(
    shouldShowTutorial(tutorialPreference(skipped, false)),
    "Skip does not award completion",
  );
  assert.equal(
    shouldShowTutorial(
      parseTutorialPreference(
        JSON.stringify(tutorialPreference(skipped, true)),
      ),
    ),
    false,
  );
  const completed = actions.reduce(advanceTutorial, newTutorialProgress());
  assert.equal(shouldShowTutorial(tutorialPreference(completed, false)), false);
  assert.equal(
    newTutorialProgress().stepIndex,
    0,
    "Settings replay explicitly starts a fresh practice tutorial",
  );
  for (const bad of [
    "broken",
    { version: 0, dontShowAgain: true, completed: true },
    { version: 1, dontShowAgain: "yes", completed: true },
    { master: { muted: true } },
  ])
    assert.deepEqual(parseTutorialPreference(bad), fresh);
  assert.ok(!tutorialPreferenceKey.includes("audio"));
});

test("replaying then skipping does not erase an earlier tutorial completion", () => {
  const finished = actions.reduce(advanceTutorial, newTutorialProgress());
  const saved = tutorialPreference(finished, false);
  const replaySkipped = skipTutorial(newTutorialProgress());
  const afterReplay = tutorialPreference(replaySkipped, false, saved);
  assert.equal(afterReplay.completed, true);
  assert.equal(shouldShowTutorial(afterReplay), false);
  assert.equal(tutorialPreference(replaySkipped, false).completed, false);
});
