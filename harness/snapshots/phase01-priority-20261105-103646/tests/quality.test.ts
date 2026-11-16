import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isQuality,
  parseQualityPreference,
  qualityOrder,
  qualityPreferenceKey,
  qualitySettings,
} from "../packages/shared/src/quality.ts";
import { qualitySettings as sharedSettings } from "../packages/shared/src/index.ts";

test("four Bengali profiles retain the accepted desktop/mobile budgets", () => {
  assert.equal(sharedSettings, qualitySettings);
  assert.equal(qualityOrder.length, 4);
  assert.equal(new Set(qualityOrder).size, 4);
  const legacy = (id: "desktop" | "mobile") => {
    const { scale, shadow, particles, view } = qualitySettings[id];
    return { scale, shadow, particles, view };
  };
  assert.deepEqual(legacy("desktop"), {
    scale: 1,
    shadow: 2048,
    particles: 35,
    view: 120,
  });
  assert.deepEqual(legacy("mobile"), {
    scale: 1.55,
    shadow: 512,
    particles: 8,
    view: 70,
  });
  for (const id of qualityOrder) {
    const profile = qualitySettings[id];
    assert.ok(/\p{Script=Bengali}/u.test(profile.label));
    assert.ok(!/[A-Za-z\uFFFD]|\p{Script=Devanagari}/u.test(profile.label));
    assert.ok(profile.scale >= 1 && profile.scale <= 2);
    assert.ok(Number.isInteger(profile.particles) && profile.particles >= 0);
    assert.ok([256, 512, 1024, 2048].includes(profile.shadow));
    assert.ok(profile.shadowDistance <= profile.activeDistance);
    assert.ok(profile.activeDistance < profile.prefetchDistance);
    assert.ok(profile.prefetchDistance <= profile.view);
  }
});

test("lower presets reduce pixel, shadow, effect and streaming work monotonically", () => {
  for (let i = 1; i < qualityOrder.length; i++) {
    const high = qualitySettings[qualityOrder[i - 1]],
      low = qualitySettings[qualityOrder[i]];
    assert.ok(
      low.scale > high.scale,
      "fewer rendered pixels at the same viewport",
    );
    assert.ok(low.shadow < high.shadow);
    assert.ok(low.particles < high.particles);
    assert.ok(low.view < high.view);
    assert.ok(low.activeDistance < high.activeDistance);
    assert.ok(low.prefetchDistance < high.prefetchDistance);
  }
  assert.equal(qualitySettings["desktop-medium"].ao, false);
  assert.equal(qualitySettings["mobile-low"].bloom, false);
});

test("profile preferences validate the version and cannot select inherited or unknown IDs", () => {
  for (const id of qualityOrder) {
    assert.equal(isQuality(id), true);
    assert.deepEqual(
      parseQualityPreference(JSON.stringify({ version: 1, profile: id })),
      { version: 1, profile: id },
    );
  }
  for (const value of [
    "__proto__",
    "constructor",
    "toString",
    "high",
    "Desktop",
    null,
    {},
    1,
  ])
    assert.equal(isQuality(value), false);
  for (const value of [
    null,
    "{",
    "[]",
    "desktop",
    {},
    [],
    { version: 2, profile: "mobile" },
    { version: 1, profile: "constructor" },
    { version: 1, profile: "mobile", master: { muted: true } },
    Object.create({ version: 1, profile: "mobile" }),
  ])
    assert.equal(parseQualityPreference(value), null);
  const record = { version: 1, profile: "desktop-medium" };
  assert.notEqual(
    parseQualityPreference(record),
    record,
    "return a fresh small record",
  );
  assert.ok(
    !["neta-tutorial-v1", "neta-audio-v1", "neta-solo-missions-c1"].includes(
      qualityPreferenceKey,
    ),
  );
});
