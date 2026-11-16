/** Original, deterministic composition and Foley synthesis. No sampled recordings. */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  defaultAudioContent,
  surfaces,
  musicContexts,
} from "../../packages/shared/src/audio.ts";
const rate = 24000,
  out = "public/assets/audio";
mkdirSync(out, { recursive: true });
let seed = 173;
const noise = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};
const sine = (f, t) => Math.sin(2 * Math.PI * f * t);
function wav(samples) {
  const peak = Math.max(
    0.001,
    ...samples.filter((_, i) => i % 30 === 0).map(Math.abs),
  );
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++)
    b.writeInt16LE(
      Math.round(
        Math.max(-1, Math.min(1, (samples[i] / Math.max(1, peak)) * 0.78)) *
          32767,
      ),
      44 + i * 2,
    );
  return b;
}
function effect(id, duration) {
  const a = new Float32Array(Math.round(rate * duration));
  let low = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / rate,
      n = noise(),
      fade = Math.min(1, t / 0.015) * Math.min(1, (duration - t) / 0.04),
      decay = Math.exp(-t * 8);
    low = low * 0.91 + n * 0.09;
    let v;
    if (id.startsWith("step-")) {
      const surface = id.split("-")[1],
        tail = Math.exp(
          -t * (surface === "water" ? 13 : surface === "metal" ? 18 : 30),
        );
      v = (low * 2.5 + sine(70, t) * 0.25) * Math.exp(-t * 28);
      if (["asphalt", "brick", "dirt"].includes(surface))
        v += n * 0.4 * tail * (0.4 + 0.6 * Math.sin(t * 320) ** 2);
      if (surface === "concrete" || surface === "shop")
        v += sine(surface === "shop" ? 210 : 160, t) * 0.22 * Math.exp(-t * 50);
      if (surface === "metal")
        v +=
          (sine(460, t) + sine(718, t) * 0.5 + sine(1230, t) * 0.25) *
          0.35 *
          tail;
      if (surface === "mud")
        v =
          low * 2.8 * Math.exp(-t * 17) +
          sine(90 - 30 * t, t) * 0.16 * Math.exp(-t * 15);
      if (surface === "water")
        v = n * 0.5 * tail + sine(700 - 1200 * t, t) * 0.15 * Math.exp(-t * 18);
    } else if (["horn", "bus"].includes(id))
      v =
        (sine(id === "bus" ? 185 : 310, t) +
          0.45 * sine(id === "bus" ? 233 : 388, t)) *
        0.3 *
        Math.min(1, (duration - t) / 0.2);
    else if (id === "bell")
      v =
        (sine(1450, t) + sine(2130, t) * 0.35 + sine(3000, t) * 0.1) *
        Math.exp(-t * 6) *
        0.5;
    else if (
      ["traffic", "cng", "engineIdle", "acceleration", "engineStart"].includes(
        id,
      )
    ) {
      const f =
        id === "cng"
          ? 83
          : id === "acceleration"
            ? 50 + (70 * t) / duration
            : 52;
      v =
        low * 0.5 +
        (sine(f, t) + sine(f * 2.02, t) * 0.3) *
          0.15 *
          (0.75 + 0.25 * sine(12, t));
    } else if (id === "rain") v = n * 0.18 + low * 0.35;
    else if (id === "insects")
      v = sine(3600, t) * Math.max(0, sine(11, t)) * 0.05;
    else if (id === "crow")
      v =
        (sine(540 - 130 * t, t) + sine(810 - 170 * t, t) * 0.3) *
        Math.exp(-t * 6) *
        Math.min(1, t * 40) *
        0.3;
    else if (id === "tea")
      v = sine(2400, t) * decay * 0.3 + n * 0.15 * Math.exp(-t * 22);
    else if (id === "construction")
      v = (low * 0.9 + sine(140, t) * 0.1) * Math.exp(-(t % 0.18) * 35) * 0.6;
    else if (id === "microphone")
      v = sine(640 + 30 * sine(3, t), t) * 0.035 * Math.exp(-t * 2);
    else if (id === "siren")
      v =
        (sine(700 + 250 * sine(0.9, t), t) +
          0.2 * sine(1400 + 500 * sine(0.9, t), t)) *
        0.25;
    else if (
      [
        "egg",
        "rubberStone",
        "sandal",
        "baton",
        "hand",
        "collision",
        "landing",
        "door",
      ].includes(id)
    ) {
      v =
        low * 2 * Math.exp(-t * 22) +
        sine(id === "egg" ? 90 : 145, t) * 0.38 * Math.exp(-t * 30);
      if (id === "egg") v += n * 0.4 * Math.exp(-t * 12);
      if (id === "baton")
        v += sine(220 - 130 * t, t) * 0.25 * Math.exp(-t * 10);
    } else if (id === "brake")
      v =
        sine(1800 - 500 * t, t) * 0.12 * Math.exp(-t * 3) +
        n * 0.15 * Math.exp(-t * 5);
    else if (id === "spark")
      v = (n * 0.18 + sine(980, t) * 0.2) * Math.exp(-t * 12);
    else if (id === "newspaper" || id === "throw")
      v = n * 0.22 * Math.sin((Math.PI * t) / duration) ** 2;
    else if (id === "hit")
      v =
        (sine(180 - 80 * t, t) + 0.3 * sine(280, t)) * 0.15 * Math.exp(-t * 12); // comic non-vocal reaction
    else {
      v =
        sine(420 + (420 * t) / duration, t) * 0.25 * decay +
        sine(840, t) * 0.08 * decay;
      if (id === "complete")
        v += (sine(660, t) + sine(880, t)) * 0.12 * Math.exp(-t * 2);
    }
    a[i] = v * fade;
  }
  return a;
}
function music(context) {
  const bpm = context === "chase" ? 124 : context === "mission" ? 104 : 88,
    beat = 60 / bpm,
    duration = beat * 32,
    a = new Float32Array(Math.round(duration * rate));
  const scale = [0, 2, 5, 7, 9],
    melody = [0, 2, 3, 2, 1, 0, 4, 3, 2, 1, 0, 1, 2, 3, 1, 0],
    base = context === "newspaper" ? 57 : context === "chase" ? 50 : 53;
  const mix = (start, length, fn) => {
    for (let i = 0; i < Math.min(length * rate, a.length - start * rate); i++) {
      const j = Math.floor(start * rate) + i;
      if (j >= 0 && j < a.length) a[j] += fn(i / rate, i);
    }
  };
  for (let step = 0; step < 32; step++) {
    const note = base + scale[melody[step % 16]],
      f = 440 * 2 ** ((note - 69) / 12);
    mix(
      step * beat,
      beat * 1.8,
      (t) =>
        (sine(f, t) + 0.25 * sine(f * 2, t) + 0.08 * sine(f * 3, t)) *
        0.13 *
        (1 - Math.exp(-t * 35)) *
        Math.exp(-t * 2.5),
    );
    mix(
      step * beat,
      beat * 0.7,
      (t) =>
        sine(step % 4 === 0 ? 75 : 115, t) * 0.17 * Math.exp(-t * 30) +
        noise() * 0.03 * Math.exp(-t * 70),
    );
    if (step % 4 === 0)
      mix(
        step * beat,
        beat * 3.7,
        (t) =>
          (sine(f / 2, t) + sine(f * 0.75, t)) *
          0.025 *
          Math.sin((Math.PI * t) / (beat * 3.7)),
      );
  }
  return a;
}
const catalog = defaultAudioContent();
for (const asset of catalog.assets) {
  const id = asset.id,
    duration = id.startsWith("step-")
      ? 0.32
      : ["traffic", "rain", "insects", "engineIdle", "cng"].includes(id)
        ? 4
        : id === "siren"
          ? 4
          : ["bus", "horn", "construction"].includes(id)
            ? 1.1
            : id === "complete"
              ? 1.5
              : 0.42;
  const samples = id.startsWith("music-")
      ? music(id.slice(6))
      : effect(id, duration),
    bytes = wav(samples);
  writeFileSync(`${out}/${id}.wav`, bytes);
  asset.bytes = bytes.length;
  asset.sha256 = createHash("sha256").update(bytes).digest("hex");
}
if (existsSync(`${out}/voices/catalog.json`)) {
  const voices = JSON.parse(readFileSync(`${out}/voices/catalog.json`, "utf8"));
  catalog.assets.push(...voices.assets);
  catalog.cues.push(...voices.cues);
}
writeFileSync(`${out}/catalog.json`, JSON.stringify(catalog, null, 2));
writeFileSync(
  `${out}/LICENSE.txt`,
  "নেতা উঠছে! — Original project audio.\nAll WAV files in this generated bank are original mathematical synthesis and original compositions, not third-party samples or commercial songs.\nEditable source: assets/source/generate-audio.mjs. Supplied with the project for the user's use and editing. Character speech is not included in this synthesized Foley/music bank.\n",
);
console.log(
  `Catalog has ${catalog.assets.length} assets: 65 original Foley/music files plus separately licensed speech (${surfaces.length} surfaces, ${musicContexts.length} music contexts).`,
);
