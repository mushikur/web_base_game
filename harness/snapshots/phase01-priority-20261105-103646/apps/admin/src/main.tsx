import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/noto-sans-bengali/400.css";
import "@fontsource/noto-sans-bengali/600.css";
import "@fontsource/noto-sans-bengali/700.css";
import {
  audioCategories,
  audioLabels,
  actionEvents,
  musicContexts,
  musicContextLabels,
  bn,
  type AudioContent,
  type AudioCue,
  type MusicTrack,
} from "@neta/shared";
import "./style.css";
type AdminData = {
  draft: AudioContent;
  publishedRevision: number;
  history: { id: string; at: string; revision: number }[];
  draftSnapshots: {
    id: string;
    at: string;
    revision: number;
    reason: string;
  }[];
  audit: { at: string; action: string }[];
};
async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch("/api/admin/" + path, {
    method,
    credentials: "same-origin",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "পরিবর্তন করা যায়নি।");
  return result;
}
const triggers: Record<string, string> = {
  ...actionEvents,
  spawn: "চরিত্রের আগমন",
  idle: "অপেক্ষা",
  detected: "খেলোয়াড়কে দেখা",
  firstHit: "প্রথম আঘাত",
  repeatHit: "বারবার আঘাত",
  lowResolve: "মনোবল কমা",
  escape: "পালানো শুরু",
  chased: "পিছু ধাওয়া",
  defeated: "হার মেনে নেওয়া",
  ambulance: "অ্যাম্বুলেন্স আসা",
  conversation: "রাস্তার আলাপ",
  slogan: "কাল্পনিক জনতার স্লোগান",
};
const date = (value: string) =>
  new Intl.DateTimeFormat("bn-BD", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(new Date(value));
const bengaliError = (error: unknown) =>
  error instanceof Error && /[\u0980-\u09ff]/u.test(error.message)
    ? error.message
    : "সার্ভারের সঙ্গে সংযোগ করা যায়নি। সংযোগ দেখে আবার চেষ্টা করুন।";
// Older factory catalogs remain durable; translate their original labels for display.
const assetName = (name: string) =>
  name.replace(/ — ([123])$/u, (_, digit: string) => " — " + bn(Number(digit)));
const attributionText = (text: string) =>
  text
    .replace("নিজস্ব composition ও synthesis", "নিজস্ব সুর ও শব্দ নির্মাণ")
    .replace("নিজস্ব synthesis", "নিজস্ব শব্দ নির্মাণ");
function App() {
  const [session, setSession] = useState<{
      setupRequired: boolean;
      authenticated: boolean;
      testMode: boolean;
    } | null>(null),
    [data, setData] = useState<AdminData | null>(null),
    [dirty, setDirty] = useState(false),
    [tab, setTab] = useState("music"),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<{
      url: string;
      name: string;
      volume: number;
    } | null>(null),
    [password, setPassword] = useState(""),
    [file, setFile] = useState<File | null>(null);
  async function refresh() {
    const result = await api<AdminData>("content");
    setData(result);
    setDirty(false);
  }
  useEffect(() => {
    void api<{
      setupRequired: boolean;
      authenticated: boolean;
      testMode: boolean;
    }>("session")
      .then((result) => {
        setSession(result);
        if (result.authenticated) void refresh();
      })
      .catch((e) => setNotice(bengaliError(e)));
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(bengaliError(e));
    } finally {
      setBusy(false);
    }
  }
  function track(id: string, patch: Partial<MusicTrack>) {
    setData((d) =>
      d
        ? {
            ...d,
            draft: {
              ...d.draft,
              tracks: d.draft.tracks.map((t) =>
                t.id === id ? { ...t, ...patch } : t,
              ),
            },
          }
        : d,
    );
    setDirty(true);
  }
  function cue(id: string, patch: Partial<AudioCue>) {
    setData((d) =>
      d
        ? {
            ...d,
            draft: {
              ...d.draft,
              cues: d.draft.cues.map((t) =>
                t.id === id ? { ...t, ...patch } : t,
              ),
            },
          }
        : d,
    );
    setDirty(true);
  }
  async function save() {
    if (!data) throw new Error("তালিকা পাওয়া যায়নি।");
    if (!dirty) return data.draft;
    const draft = await api<AudioContent>("content", "PUT", {
      content: data.draft,
      revision: data.draft.revision,
    });
    setData({ ...data, draft });
    setDirty(false);
    return draft;
  }
  const asset = (id: string) => data?.draft.assets.find((a) => a.id === id);
  function listen(id: string, volume: number) {
    const entry = asset(id);
    if (entry)
      setPreview({ url: entry.url, name: assetName(entry.name), volume });
  }
  if (!session)
    return (
      <main className="entry">
        <h1>শব্দের ঘর খুলছে…</h1>
        <p role="status">{notice}</p>
      </main>
    );
  if (!session.authenticated)
    return (
      <main className="entry">
        <a href="/">← গেমে ফিরুন</a>
        <p className="eyebrow">নেতা উঠছে! • সম্পাদনার ঘর</p>
        <h1>
          {session.setupRequired
            ? "প্রথম প্রশাসক তৈরি করুন"
            : "শব্দের ঘরে প্রবেশ"}
        </h1>
        <p>নিজের দীর্ঘ পাসওয়ার্ড দিয়ে শব্দ ও সংগীতের নিয়ন্ত্রণ রাখুন।</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api(session.setupRequired ? "setup" : "login", "POST", {
                password,
              });
              setPassword("");
              setSession({
                ...session,
                setupRequired: false,
                authenticated: true,
              });
              await refresh();
            });
          }}
        >
          <label>
            পাসওয়ার্ড
            <input
              type="password"
              autoComplete={
                session.setupRequired ? "new-password" : "current-password"
              }
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <small>
            কমপক্ষে ১২ অক্ষর। অন্য কোথাও ব্যবহার করা পাসওয়ার্ড দেবেন না।
          </small>
          <button className="primary" disabled={busy}>
            {busy
              ? "খুলছে…"
              : session.setupRequired
                ? "প্রশাসক তৈরি করুন"
                : "প্রবেশ করুন"}
          </button>
        </form>
        <p role="status">{notice}</p>
      </main>
    );
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          নেতা উঠছে!<small>শব্দ ও সংগীতের ঘর</small>
        </a>
        <nav aria-label="সম্পাদনার বিভাগ">
          {[
            ["music", "সংগীতের তালিকা"],
            ["cues", "ঘটনার শব্দ ও কণ্ঠ"],
            ["assets", "অডিও ফাইল"],
            ["history", "প্রকাশের ইতিহাস"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={tab === key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <a href="/" target="_blank" rel="noreferrer">
          গেমে দেখুন ↗
        </a>
        <button
          onClick={() =>
            void run(async () => {
              await api("logout", "POST");
              setSession({ ...session, authenticated: false });
              setData(null);
            })
          }
        >
          বেরিয়ে যান
        </button>
      </aside>
      <main className="workspace">
        <header>
          <div>
            <p className="eyebrow">কেটলি কেবিনেট থেকে শহরের শব্দ</p>
            <h1>
              {tab === "music"
                ? "ঢাকার সুর সাজান"
                : tab === "cues"
                  ? "প্রতিটি ঘটনার নিজস্ব শব্দ"
                  : tab === "assets"
                    ? "অনুমোদিত অডিওর ভান্ডার"
                    : "প্রকাশ ও ফিরে দেখা"}
            </h1>
            <p>
              {session.testMode ? "পরীক্ষার পরিবেশ • " : ""}প্রকাশিত সংস্করণ{" "}
              {bn(data?.publishedRevision ?? 0)}
              {dirty ? " • খসড়ায় পরিবর্তন আছে" : " • সংরক্ষিত"}
            </p>
          </div>
          <div className="header-actions">
            <button
              disabled={busy || !dirty}
              onClick={() =>
                void run(async () => {
                  await save();
                  setNotice("খসড়া সংরক্ষিত হয়েছে।");
                })
              }
            >
              খসড়া সংরক্ষণ
            </button>
            <button
              className="primary"
              disabled={busy || !data}
              onClick={() =>
                void run(async () => {
                  const draft = await save();
                  await api("publish", "POST", { revision: draft.revision });
                  await refresh();
                  setNotice(
                    "প্রকাশিত হয়েছে। খোলা গেম কয়েক সেকেন্ডের মধ্যে নতুন তালিকা নেবে।",
                  );
                })
              }
            >
              প্রকাশ করুন
            </button>
          </div>
        </header>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (dirty) await save();
              await api("assets/import-bundled", "POST");
              await refresh();
              setNotice(
                "নতুন মৌলিক শব্দ খসড়ায় এসেছে। বর্তমান সম্পাদনা বজায় আছে; প্রকাশ করে গেমে দিন।",
              );
            })
          }
        >
          প্রকল্পের নতুন শব্দ খসড়ায় যোগ করুন
        </button>
        <p role="status" className={notice ? "notice" : ""}>
          {notice}
        </p>
        {!data ? (
          <p>তালিকা আসছে…</p>
        ) : (
          <>
            {tab === "music" && (
              <>
                <div className="section-intro">
                  <p>
                    খসড়া শুনে দেখুন। প্রকাশ করলেই একই তালিকা বাস্তব গেমে বাজবে।
                  </p>
                  <button
                    onClick={() => {
                      const id = "track-" + crypto.randomUUID();
                      setData({
                        ...data,
                        draft: {
                          ...data.draft,
                          tracks: [
                            ...data.draft.tracks,
                            {
                              id,
                              name: "নতুন সংগীত",
                              assetId:
                                data.draft.assets.find((a) =>
                                  a.id.startsWith("music-"),
                                )?.id ?? data.draft.assets[0].id,
                              contexts: ["exploration"],
                              volume: 0.5,
                              loop: true,
                              order: data.draft.tracks.length,
                              random: false,
                              fadeIn: 2,
                              fadeOut: 2,
                              enabled: true,
                            },
                          ],
                        },
                      });
                      setDirty(true);
                    }}
                  >
                    নতুন সংগীত যোগ করুন
                  </button>
                </div>
                {data.draft.tracks.map((t) => (
                  <section className="editor-card" key={t.id}>
                    <div className="card-heading">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={t.enabled}
                          onChange={(e) =>
                            track(t.id, { enabled: e.target.checked })
                          }
                        />
                        চালু
                      </label>
                      <button onClick={() => listen(t.assetId, t.volume)}>
                        খসড়া শুনুন
                      </button>
                    </div>
                    <div className="fields">
                      <label>
                        সংগীতের বাংলা নাম
                        <input
                          value={t.name}
                          onChange={(e) =>
                            track(t.id, { name: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        অডিও ফাইল
                        <select
                          value={t.assetId}
                          onChange={(e) =>
                            track(t.id, { assetId: e.target.value })
                          }
                        >
                          {data.draft.assets.map((a) => (
                            <option key={a.id} value={a.id}>
                              {assetName(a.name)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        শব্দের মাত্রা
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={t.volume}
                          onChange={(e) =>
                            track(t.id, { volume: Number(e.target.value) })
                          }
                        />
                        <small>{bn(t.volume * 100)}%</small>
                      </label>
                      <label>
                        ক্রম
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          value={t.order}
                          onChange={(e) =>
                            track(t.id, { order: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        ধীরে শুরু, সেকেন্ড
                        <input
                          type="number"
                          min="0"
                          max="15"
                          step="0.25"
                          value={t.fadeIn}
                          onChange={(e) =>
                            track(t.id, { fadeIn: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        ধীরে শেষ, সেকেন্ড
                        <input
                          type="number"
                          min="0"
                          max="15"
                          step="0.25"
                          value={t.fadeOut}
                          onChange={(e) =>
                            track(t.id, { fadeOut: Number(e.target.value) })
                          }
                        />
                      </label>
                    </div>
                    <fieldset>
                      <legend>কখন বাজবে</legend>
                      {musicContexts.map((c) => (
                        <label className="check" key={c}>
                          <input
                            type="checkbox"
                            checked={t.contexts.includes(c)}
                            onChange={(e) =>
                              track(t.id, {
                                contexts: e.target.checked
                                  ? [...t.contexts, c]
                                  : t.contexts.filter((x) => x !== c),
                              })
                            }
                          />
                          {musicContextLabels[c]}
                        </label>
                      ))}
                    </fieldset>
                    <div className="options">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={t.loop}
                          onChange={(e) =>
                            track(t.id, { loop: e.target.checked })
                          }
                        />
                        বারবার বাজুক
                      </label>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={t.random}
                          onChange={(e) =>
                            track(t.id, { random: e.target.checked })
                          }
                        />
                        এলোমেলোভাবে বাছুন
                      </label>
                    </div>
                  </section>
                ))}
              </>
            )}
            {tab === "cues" && (
              <>
                <div className="section-intro">
                  <p>
                    কণ্ঠের সঙ্গে বাংলা সংলাপ দিন। ফাইলের প্রকৃত কণ্ঠ ও ব্যবহারের
                    অনুমতি যাচাই করে প্রকাশ করুন।
                  </p>
                  <button
                    onClick={() => {
                      setData({
                        ...data,
                        draft: {
                          ...data.draft,
                          cues: [
                            {
                              id: "cue-" + crypto.randomUUID(),
                              name: "নতুন কণ্ঠ",
                              assetId: data.draft.assets[0].id,
                              trigger: "egg",
                              category: "voices",
                              character: "*",
                              subtitle: "ওরে বাবা!",
                              volume: 0.7,
                              weight: 1,
                              cooldown: 4,
                              delay: 0,
                              maxRepetitions: 0,
                              priority: 3,
                              enabled: true,
                              spatial: true,
                              maxDistance: 35,
                            },
                            ...data.draft.cues,
                          ],
                        },
                      });
                      setDirty(true);
                    }}
                  >
                    নতুন শব্দ বা কণ্ঠ
                  </button>
                </div>
                {data.draft.cues.map((c) => (
                  <details className="editor-card" key={c.id}>
                    <summary>
                      {c.name}
                      <span>
                        {audioLabels[c.category]} •{" "}
                        {c.enabled ? "চালু" : "বন্ধ"}
                      </span>
                    </summary>
                    <div className="fields">
                      <label>
                        বাংলা নাম
                        <input
                          value={c.name}
                          onChange={(e) => cue(c.id, { name: e.target.value })}
                        />
                      </label>
                      <label>
                        অডিও ফাইল
                        <select
                          value={c.assetId}
                          onChange={(e) =>
                            cue(c.id, { assetId: e.target.value })
                          }
                        >
                          {data.draft.assets.map((a) => (
                            <option key={a.id} value={a.id}>
                              {assetName(a.name)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        ঘটনা
                        <select
                          value={c.trigger}
                          onChange={(e) =>
                            cue(c.id, { trigger: e.target.value })
                          }
                        >
                          {Object.entries(triggers).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        বিভাগ
                        <select
                          value={c.category}
                          onChange={(e) =>
                            cue(c.id, {
                              category: e.target.value as AudioCue["category"],
                            })
                          }
                        >
                          {audioCategories
                            .filter((x) => x !== "master" && x !== "music")
                            .map((key) => (
                              <option key={key} value={key}>
                                {audioLabels[key]}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        চরিত্রের বাংলা নাম
                        <input
                          value={c.character === "*" ? "" : c.character}
                          placeholder="ফাঁকা রাখলে সবার জন্য"
                          onChange={(e) =>
                            cue(c.id, { character: e.target.value || "*" })
                          }
                        />
                      </label>
                      <label>
                        বাংলা সংলাপ
                        <textarea
                          value={c.subtitle}
                          onChange={(e) =>
                            cue(c.id, { subtitle: e.target.value })
                          }
                        />
                      </label>
                      {(
                        [
                          ["volume", "শব্দের মাত্রা", 0, 1, 0.01],
                          ["weight", "বাছাইয়ের ওজন", 0.01, 100, 0.25],
                          ["cooldown", "আবার বাজতে বিরতি", 0, 300, 0.25],
                          ["delay", "বাজতে দেরি", 0, 10, 0.1],
                          [
                            "maxRepetitions",
                            "সর্বোচ্চ বার, শূন্যে সীমা নেই",
                            0,
                            1000,
                            1,
                          ],
                          ["priority", "অগ্রাধিকার", 0, 10, 1],
                          ["maxDistance", "দূরত্ব, মিটার", 1, 200, 1],
                        ] as const
                      ).map(([key, label, min, max, step]) => (
                        <label key={key}>
                          {label}
                          <input
                            type="number"
                            min={min}
                            max={max}
                            step={step}
                            value={c[key]}
                            onChange={(e) =>
                              cue(c.id, { [key]: Number(e.target.value) })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="options">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={c.enabled}
                          onChange={(e) =>
                            cue(c.id, { enabled: e.target.checked })
                          }
                        />
                        চালু
                      </label>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={c.spatial}
                          onChange={(e) =>
                            cue(c.id, { spatial: e.target.checked })
                          }
                        />
                        অবস্থান ও দূরত্ব অনুযায়ী বাজুক
                      </label>
                      <button onClick={() => listen(c.assetId, c.volume)}>
                        শুনে দেখুন
                      </button>
                    </div>
                  </details>
                ))}
              </>
            )}
            {tab === "assets" && (
              <>
                <section className="editor-card">
                  <h2>অনুমোদিত অডিও যোগ করুন</h2>
                  <p>
                    WAV, MP3 বা OGG • সর্বোচ্চ ১৬ মেগাবাইট। নিজের বা বৈধ
                    অনুমতিপ্রাপ্ত শব্দ দিন।
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      void run(async () => {
                        if (!file) throw new Error("একটি অডিও ফাইল বাছুন।");
                        if (dirty) await save();
                        const query = new URLSearchParams({
                          name: String(form.get("name")),
                          license: String(form.get("license")),
                          attribution: String(form.get("attribution")),
                          filename: file.name,
                        });
                        const response = await fetch(
                          "/api/admin/assets?" + query,
                          {
                            method: "POST",
                            headers: {
                              "Content-Type":
                                file.type || "application/octet-stream",
                              "X-Audio-Rights": "confirmed",
                            },
                            body: file,
                          },
                        );
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.error);
                        await refresh();
                        setFile(null);
                        setNotice(
                          "ফাইল খসড়ায় যোগ হয়েছে। সংগীত বা ঘটনার শব্দে বেছে প্রকাশ করুন।",
                        );
                      });
                    }}
                  >
                    <div className="fields">
                      <label>
                        অডিওর বাংলা নাম
                        <input name="name" required maxLength={160} />
                      </label>
                      <label>
                        অডিও ফাইল
                        <input
                          type="file"
                          accept=".wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg"
                          required
                          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      <label>
                        ব্যবহারের অনুমতি
                        <input
                          name="license"
                          required
                          placeholder="নিজস্ব রেকর্ডিং বা লাইসেন্সের নাম"
                          maxLength={300}
                        />
                      </label>
                      <label>
                        উৎস ও স্বীকৃতি
                        <input
                          name="attribution"
                          required
                          placeholder="রচয়িতা ও অনুমতির বিবরণ"
                          maxLength={300}
                        />
                      </label>
                    </div>
                    <label className="check">
                      <input type="checkbox" required />
                      এই ফাইল গেমে ব্যবহারের অনুমতি আছে
                    </label>
                    <button className="primary" disabled={busy}>
                      খসড়ায় ফাইল যোগ করুন
                    </button>
                  </form>
                </section>
                <div className="asset-grid">
                  {data.draft.assets.map((a) => (
                    <section key={a.id} className="asset-card">
                      <strong>{assetName(a.name)}</strong>
                      <small>{a.license}</small>
                      <small>{attributionText(a.attribution)}</small>
                      <small>{bn(a.bytes / 1024)} কিলোবাইট</small>
                      <button onClick={() => listen(a.id, 0.65)}>
                        শুনে দেখুন
                      </button>
                    </section>
                  ))}
                </div>
              </>
            )}
            {tab === "history" && (
              <>
                <section className="editor-card">
                  <h2>আগের প্রকাশ</h2>
                  {data.history.length ? (
                    data.history
                      .slice()
                      .reverse()
                      .map((h) => (
                        <div className="history-row" key={h.id}>
                          <span>
                            সংস্করণ {bn(h.revision)}
                            <small>{date(h.at)}</small>
                          </span>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const draft = await save();
                                await api("rollback", "POST", {
                                  id: h.id,
                                  revision: draft.revision,
                                });
                                await refresh();
                                setNotice(
                                  "আগের তালিকা নতুন সংস্করণ হিসেবে প্রকাশিত হয়েছে।",
                                );
                              })
                            }
                          >
                            এই প্রকাশ ফিরিয়ে আনুন
                          </button>
                        </div>
                      ))
                  ) : (
                    <p>প্রথম প্রকাশের পরে আগের তালিকা এখানে থাকবে।</p>
                  )}
                </section>
                <section className="editor-card">
                  <h2>সংরক্ষিত খসড়া</h2>
                  <p>
                    আগের প্রকাশ ফেরানোর সময়ের খসড়া এখানে থাকে। ফেরালে শুধু খসড়া
                    বদলাবে; গেমে দিতে আলাদা করে প্রকাশ করুন।
                  </p>
                  {data.draftSnapshots.length ? (
                    data.draftSnapshots
                      .slice()
                      .reverse()
                      .map((snapshot) => (
                        <div className="history-row" key={snapshot.id}>
                          <span>
                            খসড়া {bn(snapshot.revision)}
                            <small>
                              {snapshot.reason} • {date(snapshot.at)}
                            </small>
                          </span>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const draft = await save();
                                await api("restore-draft", "POST", {
                                  id: snapshot.id,
                                  revision: draft.revision,
                                });
                                await refresh();
                                setNotice(
                                  "সংরক্ষিত খসড়া ফিরেছে। প্রকাশিত গেমের তালিকা বদলায়নি।",
                                );
                              })
                            }
                          >
                            এই খসড়া ফিরিয়ে আনুন
                          </button>
                        </div>
                      ))
                  ) : (
                    <p>আগের প্রকাশ ফেরালে সংরক্ষিত খসড়া এখানে পাবেন।</p>
                  )}
                </section>
                <section className="editor-card">
                  <h2>পরিবর্তনের খাতা</h2>
                  {data.audit
                    .slice()
                    .reverse()
                    .map((entry, i) => (
                      <p key={i}>
                        {entry.action}
                        <small>{date(entry.at)}</small>
                      </p>
                    ))}
                </section>
              </>
            )}
          </>
        )}
      </main>
      {preview && (
        <section className="preview-player" aria-label="অডিও শুনে দেখা">
          <strong>{preview.name}</strong>
          <audio
            key={preview.url}
            controls
            autoPlay
            src={preview.url}
            ref={(node) => {
              if (node) node.volume = preview.volume;
            }}
          />
          <button onClick={() => setPreview(null)}>শোনা বন্ধ করুন</button>
        </section>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
