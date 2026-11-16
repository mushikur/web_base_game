import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  audioCategories,
  parseAudioSettings,
  audioOccluded,
  type AudioContent,
} from "../packages/shared/src/audio.ts";
import { streetSurfaceAt } from "../packages/shared/src/street-surfaces.ts";
import { FootContacts } from "../apps/game/src/footsteps.ts";

test("audio settings recover malformed storage and keep every bus independently bounded", () => {
  const settings = parseAudioSettings({
    master: { volume: 5, muted: true },
    music: { volume: NaN, muted: "yes" },
    voices: { volume: -1, muted: false },
  });
  assert.deepEqual(Object.keys(settings), audioCategories);
  assert.equal(settings.master.volume, 1);
  assert.equal(settings.master.muted, true);
  assert.equal(settings.music.volume, 0.35);
  assert.equal(settings.voices.volume, 0);
  assert.equal(settings.environment.volume, 0.75);
});
test("actual gait-phase crossings produce alternating contacts without timers or idle steps", () => {
  const contacts = JSON.parse(
    readFileSync(
      new URL("../public/assets/models/foot-contacts.json", import.meta.url),
      "utf8",
    ),
  ).contacts;
  const tracker = new FootContacts(),
    feet: string[] = [];
  for (const phase of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0])
    feet.push(
      ...tracker.update("Walk", phase, true, contacts.Walk).map((c) => c.foot),
    );
  assert.deepEqual(feet, ["R", "L"]);
  assert.deepEqual(tracker.update("Idle", 0.5, false, contacts.Walk), []);
  assert.deepEqual(tracker.update("Run", 0.8, true, contacts.Run), []);
  assert.deepEqual(tracker.update("Run", 0.2, true, contacts.Run), []);
  assert.deepEqual(
    tracker.update("Run", 0.3, true, contacts.Run).map((c) => c.foot),
    ["R"],
  );
});
test("surface audio follows the street's actual surface patches and wall occlusion", () => {
  for (const [x, z, expected] of [
    [0, 0, "asphalt"],
    [6.7, 4, "concrete"],
    [6.8, -5.4, "brick"],
    [4.75, -15.5, "dirt"],
    [-4.75, 15.4, "mud"],
    [-3, -6, "water"],
    [5.2, -16, "metal"],
    [-5.65, 0, "shop"],
  ] as const)
    assert.equal(streetSurfaceAt(x, z), expected);
  const wall = { x: 5, z: 0, w: 1, d: 5, h: 8 };
  assert.equal(audioOccluded({ x: 0, z: 0 }, { x: 10, z: 0 }, [wall]), true);
  assert.equal(audioOccluded({ x: 0, z: 5 }, { x: 10, z: 5 }, [wall]), false);
  assert.equal(
    audioOccluded({ x: 0, z: 0 }, { x: 10, z: 0 }, [{ ...wall, h: 1 }]),
    false,
  );
});
test("all original audio bank entries are audible local PCM with bounded download size", () => {
  const root = new URL("../public/assets/audio/", import.meta.url),
    catalog = JSON.parse(
      readFileSync(new URL("catalog.json", root), "utf8"),
    ) as AudioContent;
  let total = 0;
  assert.equal(
    catalog.assets.filter((a) => !a.id.startsWith("voice-")).length,
    65,
  );
  assert.equal(catalog.tracks.length, 5);
  for (const asset of catalog.assets) {
    const bytes = readFileSync(
      new URL("../public" + asset.url, import.meta.url),
    );
    total += bytes.length;
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
    assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
    assert.equal(asset.bytes, bytes.length);
    let energy = 0;
    for (let i = 44; i < bytes.length; i += 2)
      energy += Math.abs(bytes.readInt16LE(i));
    assert.ok(energy > 1000, asset.id + " must contain actual signal");
  }
  assert.ok(
    total < 9_000_000,
    "bank must stay within a practical local download budget",
  );
});
