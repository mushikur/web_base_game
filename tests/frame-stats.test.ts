import { test } from "node:test";
import assert from "node:assert/strict";
import { FrameWindow } from "../apps/game/src/frameStats.ts";

test("FPS uses elapsed time, excludes hidden/resume gaps and bounds its view", () => {
  const frames = new FrameWindow();
  frames.record(2000, true); // scene startup, not a rendered frame interval
  frames.record(1000 / 60, true);
  frames.record(1000 / 30, true);
  assert.equal(frames.summary().fpsAverage, 40); // averaging 60 and 30 would incorrectly give 45
  frames.record(1000, false);
  frames.record(5000, true); // tab resume gap
  assert.equal(frames.summary().fpsSampleCount, 0);
  for (let i = 0; i < 650; i++) frames.record(20, true);
  assert.equal(frames.summary().fpsSampleCount, 600);
  assert.equal(frames.summary().fpsAverage, 50);
  frames.reset();
  assert.equal(frames.summary().fpsSampleCount, 0);
});
