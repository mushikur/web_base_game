/** Original fictional Bengali lines, synthesized offline with the attributed Piper bn_BD model. */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const root = process.cwd(),
  binary = resolve(root, ".tools/piper-python/Scripts/python.exe"),
  model = resolve(root, ".tools/piper/bn_BD-google-medium.onnx"),
  out = resolve(root, "public/assets/audio/voices");
if (!existsSync(binary) || !existsSync(model))
  throw new Error(
    "Piper's official authoring tool and bn_BD model must be downloaded into .tools/piper first. Runtime uses only shipped WAV files.",
  );
mkdirSync(out, { recursive: true });
const lines = [
  ["spawn", "ভাইসব, প্রতিশ্রুতি শুনে যান!", 0, "voices", 2],
  ["idle", "আগে কমিটি ডাকো!", 0, "voices", 1],
  ["detected", "চা দাও, আলোচনা হবে!", 0, "voices", 2],
  ["firstHit", "ওরে বাবা!", 0, "voices", 4],
  ["repeatHit", "আমার লোক কই?", 0, "voices", 3],
  ["egg", "এটা আবার কী কাণ্ড!", 0, "voices", 4],
  ["sandal", "স্যান্ডেলটা কার?", 0, "voices", 4],
  ["rubberStone", "ওইটা তো রাবার!", 0, "voices", 4],
  ["baton", "এইটা কি বালিশ নাকি!", 0, "voices", 4],
  ["spark", "আরে, আলোটা বন্ধ করো!", 0, "voices", 4],
  ["lowResolve", "আমি তো এখানে ছিলাম না!", 0, "voices", 5],
  ["escape", "আগে চা খেয়ে আসি!", 0, "voices", 4],
  ["chased", "এই গলি আমার চেনা!", 0, "voices", 3],
  ["defeated", "আচ্ছা আচ্ছা, রাস্তা ছেড়ে দিচ্ছি!", 0, "voices", 6],
  ["ambulance", "চলুন, একটু বিশ্রাম নিই!", 0, "voices", 5],
  ["complete", "চায়ের দাওয়াত রইল!", 0, "voices", 4],
  ["slogan", "জয় ক্ষমতা!", 4, "crowd", 2],
  ["slogan", "নেতা এগিয়ে চলো!", 8, "crowd", 2],
  ["slogan", "কমিটি জিন্দাবাদ!", 11, "crowd", 2],
  ["slogan", "মাইক চলবে!", 4, "crowd", 2],
  ["conversation", "চা খাইয়া যান, প্রতিশ্রুতি ফ্রি!", 8, "crowd", 1],
  ["conversation", "চিনি কম, আলাপ বেশি!", 11, "crowd", 1],
  ["conversation", "ভাই, একটু রাস্তা ছাড়েন।", 4, "crowd", 1],
];
await new Promise((done, reject) => {
  const child = spawn(
    binary,
    [resolve(root, "assets/source/synthesize-voices.py"), model],
    {
      cwd: root,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONUTF8: "1" },
    },
  );
  let error = "";
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => {
    error += chunk.toString();
  });
  child.on("error", reject);
  child.on("close", (code) =>
    code === 0 ? done() : reject(new Error(error || "Piper failed: " + code)),
  );
  child.stdin.end(
    JSON.stringify(
      lines.map(([trigger, text, speaker], i) => ({
        text,
        speaker,
        file: resolve(out, "voice-" + trigger + "-" + i + ".wav"),
      })),
    ),
    "utf8",
  );
});
const assets = [],
  cues = [];
for (const [i, [trigger, text, , category, priority]] of lines.entries()) {
  const id = "voice-" + trigger + "-" + i,
    file = resolve(out, id + ".wav");
  const bytes = readFileSync(file);
  assets.push({
    id,
    name: text,
    url: "/assets/audio/voices/" + id + ".wav",
    mime: "audio/wav",
    bytes: bytes.length,
    license: "বাংলা কণ্ঠ — সিসি বাই-এসএ ৪.০ ও সংরক্ষিত সিএমইউ নোটিশ",
    attribution:
      "পাইপার বাংলা মডেল; গুগল ওপেনএসএলআর ৩৭ ও সিএমইউ তথ্যসূত্র। কাল্পনিক সংলাপ এই প্রকল্পে রচিত।",
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  cues.push({
    id: "voice-cue-" + i,
    name: text,
    assetId: id,
    trigger,
    category,
    character: "*",
    subtitle: text,
    volume: 0.7,
    weight: 1,
    cooldown: category === "crowd" ? 12 : 3,
    delay: 0,
    maxRepetitions: 0,
    priority,
    enabled: true,
    spatial: true,
    maxDistance: category === "crowd" ? 25 : 35,
  });
  console.log("বাংলা কণ্ঠ " + (i + 1) + "/" + lines.length + ": " + text);
}
writeFileSync(
  resolve(out, "catalog.json"),
  JSON.stringify({ assets, cues }, null, 2),
);
const catalogFile = resolve(root, "public/assets/audio/catalog.json"),
  catalog = JSON.parse(readFileSync(catalogFile, "utf8"));
catalog.assets = catalog.assets
  .filter((a) => !a.id.startsWith("voice-"))
  .concat(assets);
catalog.cues = catalog.cues
  .filter((c) => !c.id.startsWith("voice-cue-"))
  .concat(cues);
writeFileSync(catalogFile, JSON.stringify(catalog, null, 2));
writeFileSync(
  resolve(out, "LICENSE.txt"),
  "Fictional Bengali voice clips. Original fictional text and synthesized speech adaptation for Neta Uthche. No politician or party recording, logo or impersonation.\nThese speech clips are distributed under Creative Commons Attribution-ShareAlike 4.0 International (https://creativecommons.org/licenses/by-sa/4.0/), retaining the source model card and CMU notice in /assets/licenses/Bengali-Piper-model-card.txt.\nModel: rhasspy/piper-voices bn/bn_BD/google/medium, 16 speakers; authoring uses anonymous speaker IDs 0,4,8,11, not named public figures.\nSource: https://huggingface.co/rhasspy/piper-voices/tree/main/bn/bn_BD/google/medium ; data: https://www.openslr.org/37/ and http://festvox.org/cmu_indic/index.html .\nChanges: new fictional Bengali scripts, offline synthesis, separated per-event clips. No commercial music or copied game dialogue.\nEditable source: assets/source/generate-voices.mjs.\n",
);
mkdirSync(resolve(root, "assets/source/generated"), { recursive: true });
writeFileSync(
  resolve(root, "assets/source/generated/voices-provenance.json"),
  JSON.stringify(
    {
      model:
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/bn/bn_BD/google/medium/bn_BD-google-medium.onnx",
      modelSHA256: createHash("sha256")
        .update(readFileSync(model))
        .digest("hex"),
      tool: "https://github.com/OHF-Voice/piper1-gpl",
      toolVersion: "1.8.0",
      lines: lines.map(([trigger, text, speaker, category]) => ({
        trigger,
        text,
        speaker,
        category,
      })),
      license: "CC BY-SA 4.0 with retained CMU source notice",
    },
    null,
    2,
  ),
);
