import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test, type TestContext } from "node:test";
import { StreetAudio } from "../apps/game/src/audio.ts";
import {
  defaultAudioContent,
  type AudioContent,
} from "../packages/shared/src/audio.ts";

// Import the real runtime through the workspace's @neta/shared source export.
// This graph models transport and automation, not audible quality or a browser.
class GraphNode {
  outputs: GraphNode[] = [];
  connect(node: GraphNode) {
    this.outputs.push(node);
    return node;
  }
  disconnect() {
    this.outputs = [];
  }
}
type Automation = { kind: "set" | "ramp"; value: number; at: number };
class Parameter {
  context: AudioClock;
  base = 1;
  baseAt: number;
  events: Automation[] = [];
  constructor(context: AudioClock) {
    this.context = context;
    this.baseAt = context.currentTime;
  }
  get value() {
    let value = this.base,
      at = this.baseAt;
    for (const event of this.events) {
      if (event.at > this.context.currentTime) {
        if (event.kind === "ramp")
          value +=
            ((event.value - value) * (this.context.currentTime - at)) /
            (event.at - at);
        break;
      }
      value = event.value;
      at = event.at;
    }
    return value;
  }
  set value(value: number) {
    this.base = value;
    this.baseAt = this.context.currentTime;
  }
  setValueAtTime(value: number, at: number) {
    this.events.push({ kind: "set", value, at });
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.events.push({ kind: "ramp", value, at });
  }
  setTargetAtTime(value: number, at: number) {
    this.setValueAtTime(value, at);
  }
  cancelScheduledValues(at: number) {
    this.events = this.events.filter((event) => event.at < at);
  }
  cancelAndHoldAtTime(at: number) {
    const value = this.value;
    this.cancelScheduledValues(at);
    this.setValueAtTime(value, at);
  }
}
class Gain extends GraphNode {
  gain: Parameter;
  constructor(context: AudioClock) {
    super();
    this.gain = new Parameter(context);
  }
}
type DecodedBuffer = { duration: number; url: string };
class Source extends GraphNode {
  context: AudioClock;
  playbackRate: Parameter;
  buffer?: DecodedBuffer;
  loop = false;
  startedAt?: number;
  stopAt = Infinity;
  active = false;
  onended?: (event: Event) => void;
  constructor(context: AudioClock) {
    super();
    this.context = context;
    this.playbackRate = new Parameter(context);
  }
  start() {
    assert.equal(this.context.state, "running", "resume must precede playback");
    this.startedAt = this.context.currentTime;
    this.active = true;
  }
  stop(at = this.context.currentTime) {
    this.stopAt = at;
    if (at <= this.context.currentTime) setImmediate(() => this.finish());
  }
  finish() {
    if (!this.active) return;
    this.active = false;
    this.onended?.(new Event("ended"));
  }
}
class AudioClock {
  currentTime = 1;
  state: AudioContextState = "suspended";
  destination = new GraphNode();
  sources: Source[] = [];
  listener: Record<string, Parameter>;
  constructor() {
    this.listener = Object.fromEntries(
      [
        "positionX",
        "positionY",
        "positionZ",
        "forwardX",
        "forwardY",
        "forwardZ",
        "upY",
      ].map((key) => [key, new Parameter(this)]),
    );
  }
  async resume() {
    await new Promise<void>((resolve) => setImmediate(resolve));
    this.state = "running";
  }
  async suspend() {
    this.state = "suspended";
  }
  async close() {
    this.state = "closed";
  }
  advance(seconds: number) {
    if (this.state !== "running") return;
    this.currentTime += seconds;
    for (const source of this.sources) {
      if (source.startedAt === undefined || !source.buffer) continue;
      const naturalEnd = source.loop
        ? Infinity
        : source.startedAt + source.buffer.duration / source.playbackRate.value;
      if (Math.min(naturalEnd, source.stopAt) <= this.currentTime)
        source.finish();
    }
  }
  createGain() {
    return new Gain(this);
  }
  createDynamicsCompressor() {
    return Object.assign(new GraphNode(), {
      threshold: new Parameter(this),
      knee: new Parameter(this),
      ratio: new Parameter(this),
    });
  }
  createAnalyser() {
    return Object.assign(new GraphNode(), {
      getFloatTimeDomainData(data: Float32Array) {
        data.fill(0);
      },
    });
  }
  createBiquadFilter() {
    return Object.assign(new GraphNode(), { frequency: new Parameter(this) });
  }
  createPanner() {
    return Object.assign(new GraphNode(), {
      positionX: new Parameter(this),
      positionY: new Parameter(this),
      positionZ: new Parameter(this),
    });
  }
  createBufferSource() {
    const source = new Source(this);
    this.sources.push(source);
    return source;
  }
  async decodeAudioData(bytes: ArrayBuffer): Promise<DecodedBuffer> {
    await new Promise<void>((resolve) => setImmediate(resolve));
    return { duration: 2, url: new TextDecoder().decode(bytes) };
  }
}
async function flush() {
  for (let turn = 0; turn < 12; turn++)
    await new Promise<void>((resolve) => setImmediate(resolve));
}
async function until(predicate: () => boolean) {
  for (let turn = 0; turn < 60 && !predicate(); turn++) await flush();
  assert.ok(predicate(), "asynchronous audio state did not settle");
}
function path(source: Source) {
  const nodes: GraphNode[] = [];
  let node: GraphNode | undefined = source;
  while (node) {
    nodes.push(node);
    node = node.outputs[0];
  }
  return nodes;
}
function fixture(t: TestContext) {
  const content = defaultAudioContent(),
    clocks: AudioClock[] = [],
    instances: StreetAudio[] = [],
    requests = new Set<string>(),
    held = new Map<string, Promise<void>>(),
    storage = new Map<string, string>(),
    originals = new Map<string, PropertyDescriptor | undefined>();
  const replace = (key: string, value: unknown) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  };
  replace(
    "AudioContext",
    class extends AudioClock {
      constructor() {
        super();
        clocks.push(this);
      }
    },
  );
  replace("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  replace("document", { visibilityState: "hidden" });
  replace("window", {
    setInterval: (callback: () => void, ms: number) =>
      setInterval(callback, ms).unref(),
    setTimeout,
  });
  replace("fetch", async (url: string) => {
    if (url === "/api/content") return new Response(JSON.stringify(content));
    requests.add(url);
    await held.get(url);
    return new Response(new TextEncoder().encode(url));
  });
  t.after(async () => {
    instances.forEach((audio) => audio.dispose());
    await flush();
    for (const [key, descriptor] of originals)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
  });
  return {
    content,
    requests,
    get clock() {
      assert.ok(clocks[0]);
      return clocks[0];
    },
    audio() {
      const audio = new StreetAudio();
      instances.push(audio);
      return audio;
    },
    url(id: string) {
      const asset = content.assets.find((a) => a.id === id);
      assert.ok(asset);
      return asset.url;
    },
    hold(id: string) {
      const asset = content.assets.find((a) => a.id === id);
      assert.ok(asset);
      let release!: () => void;
      held.set(
        asset.url,
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      );
      return release;
    },
  };
}

test("pause during pending bootstrap cannot start stale audio, and resume restores cached layers", async (t) => {
  const f = fixture(t),
    releasePickup = f.hold("pickup"),
    releaseTraffic = f.hold("traffic"),
    releaseCng = f.hold("cng"),
    audio = f.audio();
  const starting = audio.start("exploration");
  await until(
    () => f.requests.has(f.url("pickup")) && f.requests.has(f.url("cng")),
  );
  audio.pause(true);
  const started = f.clock.sources.length;
  releasePickup();
  releaseTraffic();
  releaseCng();
  await starting;
  await flush();
  assert.equal(f.clock.sources.length, started);
  assert.equal(audio.diagnostics().loops.length, 0);
  audio.pause(false);
  await until(() => audio.diagnostics().loops.length === 2);
  assert.equal(f.clock.state, "running");
  assert.ok(audio.diagnostics().music);
});

test("first brick and mud contacts use bootstrap-decoded buffers even when their initial download was slow", async (t) => {
  const f = fixture(t),
    audio = f.audio(),
    surfaces = ["brick", "mud"] as const,
    ids = surfaces.flatMap((surface) =>
      [0, 1, 2].map((variant) => `step-${surface}-${variant}`),
    ),
    releases = ids.map((id) => f.hold(id));
  let booted = false;
  const starting = audio.start("exploration").then(() => {
    booted = true;
  });
  try {
    await until(() => ids.every((id) => f.requests.has(f.url(id))));
    assert.equal(booted, false, "bootstrap must wait for the surface bank");
    // These slow first downloads exceed the runtime's 100 ms stale-contact limit.
    // They must finish before a first contact, rather than drop that contact later.
    f.clock.advance(0.25);
    releases.forEach((release) => release());
    await starting;
    await flush();
    // A cold/repeated fetch would now remain pending. Contacts must use the decoded cache.
    releases.push(...ids.map((id) => f.hold(id)));
    const before = f.clock.sources.length,
      dropped = audio.diagnostics().dropped;
    for (const surface of surfaces)
      audio.footstep(surface, { x: 0, y: 0.05, z: 0 }, false, 15, "সজল:R");
    await flush();
    const contacts = f.clock.sources.slice(before);
    assert.equal(contacts.length, 2);
    for (const surface of surfaces) {
      assert.ok(
        contacts.some((source) =>
          source.buffer?.url.startsWith(`/assets/audio/step-${surface}-`),
        ),
        `first ${surface} contact must start without another download`,
      );
      assert.ok(
        audio.diagnostics().recent.some((event) => event.surface === surface),
      );
    }
    assert.equal(audio.diagnostics().dropped, dropped);
  } finally {
    releases.forEach((release) => release());
    await starting;
    await flush();
  }
});

test("published enabled, file and volume changes reconcile active traffic, CNG and rain layers", async (t) => {
  const f = fixture(t),
    audio = f.audio(),
    releaseRain = f.hold("rain");
  await audio.start("exploration");
  await flush();
  audio.setRain(true);
  await until(() => f.requests.has(f.url("rain")));
  audio.setRain(false);
  releaseRain();
  await flush();
  assert.ok(!audio.diagnostics().loops.some((loop) => loop.id === "rain"));
  audio.setRain(true);
  await flush();
  f.clock.advance(0.2);
  const before = audio
    .diagnostics()
    .loops.find((loop) => loop.id === "cng")!.gain;
  const traffic = f.content.cues.find((cue) => cue.trigger === "traffic")!,
    cng = f.content.cues.find((cue) => cue.trigger === "cng")!,
    rain = f.content.cues.find((cue) => cue.trigger === "rain")!;
  traffic.enabled = false;
  cng.assetId = "bell";
  cng.volume /= 2;
  rain.enabled = false;
  f.content.revision++;
  await audio.refreshPublished();
  await flush();
  f.clock.advance(0.2);
  const loops = audio.diagnostics().loops;
  assert.deepEqual(
    loops.map((loop) => loop.id),
    ["cng"],
  );
  assert.equal(loops[0].assetId, "bell");
  assert.ok(Math.abs(loops[0].gain - before / 2) < 1e-8);
  assert.ok(
    !f.clock.sources.some(
      (source) => source.active && source.buffer?.url === f.url("traffic"),
    ),
  );
  rain.enabled = true;
  f.content.revision++;
  await audio.refreshPublished();
  await flush();
  assert.ok(audio.diagnostics().loops.some((loop) => loop.id === "rain"));
  audio.setRain(false);
  assert.ok(!audio.diagnostics().loops.some((loop) => loop.id === "rain"));
});

test("music edits published while paused apply on resume after the context unlocks", async (t) => {
  const f = fixture(t),
    audio = f.audio();
  await audio.start("exploration");
  await flush();
  const track = f.content.tracks.find((entry) =>
    entry.contexts.includes("exploration"),
  )!;
  f.clock.advance(track.fadeIn + 0.1);
  const previous = f.clock.sources.find(
    (source) => source.active && source.buffer?.url === f.url(track.assetId),
  )!;
  audio.pause(true);
  track.assetId = "music-menu";
  track.volume = 0.12;
  f.content.revision++;
  const started = f.clock.sources.length;
  await audio.refreshPublished();
  await flush();
  assert.equal(f.clock.sources.length, started);
  audio.pause(false);
  await until(() => audio.diagnostics().music?.assetId === "music-menu");
  f.clock.advance(0.1);
  assert.ok(previous.active);
  assert.ok((path(previous)[1] as Gain).gain.value > 0);
  assert.ok(audio.diagnostics().music!.gain > 0);
  f.clock.advance(track.fadeIn + 0.1);
  assert.equal(audio.diagnostics().music?.configuredVolume, 0.12);
  assert.ok(Math.abs(audio.diagnostics().music!.gain - 0.12) < 1e-8);
});

test("non-loop playlist fades naturally, advances once and remains finished after its final track", async (t) => {
  const f = fixture(t),
    template = f.content.tracks[0];
  f.content.tracks = [0, 1].map((order) => ({
    ...template,
    id: `sequential-${order}`,
    contexts: ["exploration"],
    order,
    random: false,
    loop: false,
    volume: 0.6,
    fadeIn: 0.1,
    fadeOut: 0.5,
  }));
  const audio = f.audio();
  await audio.start("exploration");
  await flush();
  assert.equal(audio.diagnostics().music?.trackId, "sequential-0");
  f.clock.advance(1.75);
  assert.ok(Math.abs(audio.diagnostics().music!.gain - 0.3) < 1e-8);
  f.clock.advance(0.25);
  await flush();
  assert.equal(audio.diagnostics().music?.trackId, "sequential-1");
  f.clock.advance(2);
  await flush();
  assert.equal(audio.diagnostics().music, null);
  const started = f.clock.sources.filter(
    (source) => source.buffer?.url === f.url(template.assetId),
  ).length;
  f.clock.advance(5);
  audio.tick();
  await flush();
  assert.equal(audio.diagnostics().music, null);
  assert.equal(
    f.clock.sources.filter(
      (source) => source.buffer?.url === f.url(template.assetId),
    ).length,
    started,
  );
});

test("overlapping and replaced previews preserve paused world gates and only the latest audition", async (t) => {
  const f = fixture(t),
    audio = f.audio();
  await audio.start("exploration");
  await flush();
  audio.pause(true);
  const world = f.clock.sources.filter((source) => source.active);
  await Promise.all([audio.preview("vehicles"), audio.preview("music")]);
  await flush();
  assert.equal(f.clock.state, "running");
  assert.ok(
    world.every(
      (source) =>
        path(source).filter((node) => node instanceof Gain)[1].gain.value === 0,
    ),
  );
  assert.equal(
    f.clock.sources.filter((source) => source.active && !world.includes(source))
      .length,
    1,
  );
  await audio.preview("vehicles");
  await flush();
  const previews = f.clock.sources.filter(
    (source) => source.active && !world.includes(source),
  );
  assert.equal(previews.length, 1);
  assert.equal(
    previews[0].buffer?.url,
    f.url(
      f.content.cues.find((cue) => cue.enabled && cue.category === "vehicles")!
        .assetId,
    ),
  );
  assert.equal(
    f.clock.state,
    "running",
    "old preview end must not suspend its replacement",
  );
  previews[0].finish();
  await flush();
  assert.equal(f.clock.state, "suspended");
});

test("a suppressed voice does not consume its repetition limit before a source actually starts", async (t) => {
  const f = fixture(t),
    template = f.content.cues[0];
  f.content.cues.push(
    ...[10, 1].map((priority) => ({
      ...template,
      id: `priority-${priority}`,
      trigger: `priority-${priority}`,
      assetId: "menu",
      category: "voices" as const,
      character: "*",
      enabled: true,
      priority,
      maxRepetitions: 1,
      cooldown: 0,
      delay: 0,
    })),
  );
  const audio = f.audio();
  await audio.start("exploration");
  await flush();
  audio.event("priority-10", undefined, "test-actor");
  await flush();
  audio.event("priority-1", undefined, "test-actor");
  await flush();
  assert.equal(audio.diagnostics().repetitions["priority-1"], undefined);
  f.clock.advance(2);
  await flush();
  audio.event("priority-1", undefined, "test-actor");
  await flush();
  assert.equal(audio.diagnostics().repetitions["priority-1"], 1);
  f.clock.advance(2);
  await flush();
  audio.event("priority-1", undefined, "test-actor");
  await flush();
  assert.equal(audio.diagnostics().repetitions["priority-1"], 1);
});

test("WebAudio listener and source coordinates convert Dhaka world Z consistently", async (t) => {
  const f = fixture(t),
    audio = f.audio();
  await audio.start("exploration");
  await flush();
  audio.listener(1, 7, 0);
  assert.equal(f.clock.listener.positionZ.value, -7);
  assert.equal(f.clock.listener.forwardZ.value, -1);
  const cng = f.clock.sources.find(
    (source) => source.active && source.buffer?.url === f.url("cng"),
  )!;
  const panner = path(cng).find((node) => "positionZ" in node) as GraphNode & {
    positionZ: Parameter;
  };
  assert.equal(panner.positionZ.value, -2);
  audio.listener(1, 7, Math.PI / 2);
  assert.ok(Math.abs(f.clock.listener.forwardX.value - 1) < 1e-8);
  assert.ok(Math.abs(f.clock.listener.forwardZ.value) < 1e-8);
});

test("category auditions play enabled published speech and effects at configured gains without booting the world", async (t) => {
  const f = fixture(t),
    categories = ["voices", "crowd", "combat", "interface"] as const;
  f.content.cues = f.content.cues.filter(
    (cue) => !categories.some((category) => category === cue.category),
  );
  for (const [index, category] of categories.entries()) {
    const id = `audition-${category}`;
    f.content.assets.push({
      ...f.content.assets[0],
      id,
      url: `/published/${id}.wav`,
    });
    f.content.cues.push({
      ...defaultAudioContent().cues[0],
      id,
      assetId: id,
      category,
      volume: 0.4 + index * 0.1,
      enabled: true,
    });
  }
  const audio = f.audio();
  audio.pause(true);
  for (const [index, category] of categories.entries()) {
    await audio.preview(category);
    await flush();
    const active = f.clock.sources.filter((source) => source.active);
    assert.equal(active.length, 1);
    assert.equal(active[0].buffer?.url, `/published/audition-${category}.wav`);
    assert.ok(
      Math.abs((path(active[0])[1] as Gain).gain.value - (0.4 + index * 0.1)) <
        1e-8,
    );
    assert.equal(audio.diagnostics().loops.length, 0);
    assert.equal(audio.diagnostics().music, null);
  }
});

test("missing enabled category audition reports Bengali and never substitutes the menu beep", async (t) => {
  const f = fixture(t),
    audio = f.audio();
  audio.pause(true);
  await audio.preview("voices");
  await flush();
  assert.equal(f.clock.sources.length, 0);
  assert.match(audio.lastError, /চরিত্রের কণ্ঠ.*চালু শব্দ পাওয়া যায়নি/);
  assert.equal(f.clock.state, "suspended");
});

test("replacement speech waits for decoding and equal-priority speech preserves the current sentence", async (t) => {
  const f = fixture(t),
    template = f.content.cues[0];
  f.content.assets.push({
    ...f.content.assets[0],
    id: "replacement",
    url: "/published/replacement.wav",
  });
  for (const [trigger, priority, assetId] of [
    ["low", 1, "menu"],
    ["high", 5, "replacement"],
    ["equal", 5, "replacement"],
  ] as const)
    f.content.cues.push({
      ...template,
      id: trigger,
      trigger,
      assetId,
      category: "voices",
      character: "*",
      priority,
      cooldown: 0,
    });
  const release = f.hold("replacement"),
    audio = f.audio();
  await audio.start("exploration");
  await flush();
  audio.event("low", undefined, "speaker");
  await flush();
  const low = f.clock.sources.find(
    (source) => source.active && source.buffer?.url === f.url("menu"),
  )!;
  audio.event("high", undefined, "speaker");
  await until(() => f.requests.has(f.url("replacement")));
  assert.equal(
    low.stopAt,
    Infinity,
    "decoding must not silence the previous voice",
  );
  assert.ok((path(low)[1] as Gain).gain.value > 0);
  release();
  await flush();
  const high = f.clock.sources.find(
    (source) => source.active && source.buffer?.url === f.url("replacement"),
  )!;
  assert.ok(Number.isFinite(low.stopAt));
  audio.event("equal", undefined, "speaker");
  await flush();
  assert.equal(high.stopAt, Infinity);
  assert.equal(audio.diagnostics().eventCounts.equal, undefined);
  f.clock.advance(2);
  await flush();
  audio.event("equal", undefined, "speaker");
  await flush();
  assert.equal(audio.diagnostics().eventCounts.equal, 1);
});

test("one impact keeps combat FX but selects one prioritized mouth-positioned voice and preserves wall occlusion", async (t) => {
  const f = fixture(t),
    template = f.content.cues[0];
  for (const [trigger, priority] of [
    ["egg", 4],
    ["firstHit", 4],
    ["defeated", 6],
  ] as const) {
    const id = `spoken-${trigger}`;
    f.content.assets.push({
      ...f.content.assets[0],
      id,
      url: `/published/${id}.wav`,
    });
    f.content.cues.push({
      ...template,
      id,
      assetId: id,
      category: "voices",
      trigger,
      priority,
      spatial: true,
    });
  }
  const audio = f.audio();
  await audio.start("exploration");
  await flush();
  audio.setObstacles([{ x: 2, z: 0, w: 1, d: 5, h: 8 }]);
  audio.listener(0, 0, 0);
  const before = f.clock.sources.length;
  audio.event("egg", { x: 4, y: 0.8, z: 0 }, "speaker", "combat");
  audio.event("hit", { x: 4, y: 0.8, z: 0 }, "speaker", "combat");
  audio.event(
    ["egg", "firstHit", "defeated"],
    { x: 4, y: 1.606, z: 0 },
    "speaker",
    "voices",
  );
  await flush();
  const started = f.clock.sources.slice(before);
  assert.equal(started.length, 3);
  assert.deepEqual(
    started.map((source) => source.buffer?.url).sort(),
    [f.url("egg"), f.url("hit"), f.url("spoken-defeated")].sort(),
  );
  const voice = started.find(
    (source) => source.buffer?.url === f.url("spoken-defeated"),
  )!;
  const panner = path(voice).find(
    (node) => "positionY" in node,
  ) as GraphNode & { positionY: Parameter };
  const filter = path(voice).find(
    (node) => "frequency" in node,
  ) as GraphNode & { frequency: Parameter };
  assert.equal(panner.positionY.value, 1.606);
  assert.equal(filter.frequency.value, 1300);
  audio.setObstacles([]);
  audio.listener(0, 0, 0);
  assert.equal(filter.frequency.value, 20000);
});

test("ambient conversation, stage slogans and microphone originate at authored speech heights", async (t) => {
  const f = fixture(t),
    template = f.content.cues[0];
  for (const trigger of ["conversation", "slogan"] as const) {
    const id = `ambient-${trigger}`;
    f.content.assets.push({
      ...f.content.assets[0],
      id,
      url: `/published/${id}.wav`,
    });
    f.content.cues.push({
      ...template,
      id,
      assetId: id,
      category: "crowd",
      trigger,
      spatial: true,
    });
  }
  const audio = f.audio();
  await audio.start("mission");
  await flush();
  f.clock.advance(11);
  audio.tick();
  await flush();
  for (const [id, x, y, z] of [
    ["ambient-conversation", -6, 1.606, 0.6],
    ["ambient-slogan", 1.8, 2.066, 10.6],
    ["microphone", 1.8, 2.05, 9.35],
  ] as const) {
    const source = f.clock.sources.find(
      (entry) => entry.active && entry.buffer?.url === f.url(id),
    )!;
    assert.ok(source, id);
    const panner = path(source).find(
      (node) => "positionY" in node,
    ) as GraphNode & {
      positionX: Parameter;
      positionY: Parameter;
      positionZ: Parameter;
    };
    assert.equal(panner.positionX.value, x);
    assert.equal(panner.positionY.value, y);
    assert.equal(panner.positionZ.value, -z);
  }
});

test("shipped escape and completion cues start their real voice and effect graph from mission events", async (t) => {
  const f = fixture(t),
    shipped = JSON.parse(
      await readFile(
        new URL("../public/assets/audio/catalog.json", import.meta.url),
        "utf8",
      ),
    ) as AudioContent;
  // Use the shipped cue identifiers and files rather than inventing matching
  // test-only aliases. Existing published catalogs use these same triggers.
  Object.assign(f.content, shipped);
  const escape = shipped.cues.find(
      (cue) =>
        cue.enabled && cue.trigger === "escape" && cue.category === "voices",
    ),
    completion = shipped.cues.filter(
      (cue) => cue.enabled && cue.trigger === "complete",
    ),
    subtitles: string[] = [],
    audio = f.audio();
  assert.ok(escape);
  assert.deepEqual(completion.map((cue) => cue.category).sort(), [
    "interface",
    "voices",
  ]);
  audio.setSubtitleHandler((text) => subtitles.push(text));
  await audio.start("mission");
  await flush();
  const beforeEscape = f.clock.sources.length;
  audio.event("escape", { x: 3, y: 1.606, z: 14 }, "বজলু প্রতিশ্রুতি");
  await flush();
  const escaped = f.clock.sources.slice(beforeEscape);
  assert.equal(escaped.length, 1);
  assert.equal(escaped[0].buffer?.url, f.url(escape.assetId));
  assert.equal(escaped[0].active, true);
  assert.equal(escaped[0].startedAt, f.clock.currentTime);
  assert.equal(audio.diagnostics().eventCounts.escape, 1);
  assert.equal(subtitles.at(-1), escape.subtitle);
  const escapePanner = path(escaped[0]).find(
    (node) => "positionY" in node,
  ) as GraphNode & { positionY: Parameter };
  assert.equal(escapePanner.positionY.value, 1.606);

  // The ambulance journey outlasts this utterance. Let it finish naturally so
  // the existing equal-priority speech protection is preserved at completion.
  f.clock.advance(3);
  await flush();
  const beforeCompletion = f.clock.sources.length;
  audio.event("complete", { x: -2.6, y: 1.606, z: 34 }, "বজলু প্রতিশ্রুতি");
  await flush();
  const completed = f.clock.sources.slice(beforeCompletion);
  assert.equal(completed.length, 2);
  assert.deepEqual(
    completed.map((source) => source.buffer?.url).sort(),
    completion.map((cue) => f.url(cue.assetId)).sort(),
  );
  assert.ok(completed.every((source) => source.active));
  assert.equal(audio.diagnostics().eventCounts.complete, 2);
  assert.equal(
    subtitles.at(-1),
    completion.find((cue) => cue.category === "voices")!.subtitle,
  );
});
