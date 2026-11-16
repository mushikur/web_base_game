import {
  audioCategories,
  audioLabels,
  audioOccluded,
  defaultAudioContent,
  parseAudioSettings,
  surfaces,
  type AudioCategory,
  type AudioContent,
  type AudioCue,
  type AudioPoint,
  type AudioSettings,
  type MusicContext,
  type Surface,
} from "@neta/shared";
type Playing = {
  assetId: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
  gate: GainNode;
  filter: BiquadFilterNode;
  point?: AudioPoint;
  category: AudioCategory;
  priority: number;
  character: string;
  preview: boolean;
  nodes: AudioNode[];
};
const settingsKey = "neta.audio.settings.v1";
/** One gesture-unlocked graph; category buses, spatial occlusion and bounded voices. */
export class StreetAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private analyser?: AnalyserNode;
  private buses = new Map<AudioCategory, GainNode>();
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private playing = new Set<Playing>();
  private observers = new Set<() => void>();
  private cooldowns = new Map<string, number>();
  private repetitions = new Map<string, number>();
  private pendingRepetitions = new Map<string, number>();
  private cueVersion = 0;
  private disposed = false;
  private paused = false;
  private starting?: Promise<void>;
  private resumeVersion = 0;
  private previewRequest = 0;
  private poll?: number;
  private music?: Playing;
  private musicRequest = 0;
  private musicDirty = false;
  private trackCursor = new Map<MusicContext, number>();
  private musicContext: MusicContext = "menu";
  private listenerPoint: AudioPoint = { x: 0, y: 1.6, z: -9 };
  private obstacles: readonly {
    x: number;
    z: number;
    w: number;
    d: number;
    h?: number;
  }[] = [];
  private ambience: {
    event: string;
    point: AudioPoint;
    next: number;
    min: number;
    max: number;
    night?: boolean;
    character?: string;
  }[] = [];
  private night = false;
  private raining = false;
  private loops = new Map<string, { handle: Playing; signature: string }>();
  private loopRequests = new Map<
    string,
    { token: number; signature: string }
  >();
  private loopVersion = 0;
  private loopRetryAt = new Map<string, number>();
  private lastVariant = new Map<string, number>();
  private scheduled = new Set<number>();
  private subtitleHandler?: (text: string) => void;
  private eventCounts: Record<string, number> = {};
  private recent: {
    event: string;
    at: number;
    surface?: Surface;
    frame?: number;
    foot?: string;
  }[] = [];
  settings: AudioSettings;
  content: AudioContent = defaultAudioContent();
  catalogSource: "builtin" | "published" = "builtin";
  lastError = "";
  dropped = 0;
  constructor() {
    try {
      this.settings = parseAudioSettings(
        JSON.parse(localStorage.getItem(settingsKey) ?? "null"),
      );
    } catch {
      this.settings = parseAudioSettings(null);
    }
  }
  subscribe(fn: () => void) {
    this.observers.add(fn);
    return () => {
      this.observers.delete(fn);
    };
  }
  private notify() {
    this.observers.forEach((fn) => fn());
  }
  get unlocked() {
    return !!this.context;
  }
  get status() {
    return this.context?.state ?? "not-started";
  }
  setSubtitleHandler(fn: (text: string) => void) {
    this.subtitleHandler = fn;
  }
  setObstacles(obstacles: typeof this.obstacles) {
    this.obstacles = obstacles;
  }
  setVolume(category: AudioCategory, volume: number) {
    this.settings[category].volume = Math.max(0, Math.min(1, volume));
    this.applySettings();
  }
  setCategoryMuted(category: AudioCategory, muted: boolean) {
    this.settings[category].muted = muted;
    this.applySettings();
  }
  setMuted(muted: boolean) {
    this.setCategoryMuted("master", muted);
  }
  private applySettings() {
    for (const category of audioCategories) {
      const node =
          category === "master" ? this.master : this.buses.get(category),
        setting = this.settings[category];
      node?.gain.setTargetAtTime(
        setting.muted ? 0 : setting.volume,
        this.context!.currentTime,
        0.035,
      );
    }
    try {
      localStorage.setItem(settingsKey, JSON.stringify(this.settings));
    } catch {
      this.lastError = "এই ব্রাউজারে শব্দের পছন্দ সংরক্ষণ করা যায়নি।";
    }
    this.notify();
  }
  private ensureContext() {
    if (!this.context) {
      const c = (this.context = new AudioContext());
      this.master = c.createGain();
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 12;
      limiter.ratio.value = 5;
      this.analyser = c.createAnalyser();
      this.analyser.fftSize = 512;
      this.master.connect(this.analyser);
      this.analyser.connect(limiter);
      limiter.connect(c.destination);
      for (const category of audioCategories.filter((x) => x !== "master")) {
        const bus = c.createGain();
        bus.connect(this.master);
        this.buses.set(category, bus);
      }
      this.applySettings();
    }
    return this.context;
  }
  async start(context: MusicContext = this.musicContext) {
    if (this.musicContext !== context) this.trackCursor.set(context, 0);
    this.musicContext = context;
    if (this.disposed) return;
    this.previewRequest++;
    const audioContext = this.ensureContext(),
      version = ++this.resumeVersion;
    this.paused = false;
    await audioContext.resume();
    if (this.disposed || this.paused || version !== this.resumeVersion) return;
    for (const handle of this.playing) {
      if (handle.preview) {
        this.stop(handle);
        continue;
      }
      handle.gate.gain.setValueAtTime(1, audioContext.currentTime);
    }
    if (this.starting) return this.starting;
    if (this.poll) {
      this.reconcileAmbientLoops();
      void this.switchMusic();
      return;
    }
    this.starting = (async () => {
      await this.refreshPublished();
      await Promise.allSettled(
        [
          "pickup",
          "equip",
          "throw",
          "egg",
          "sandal",
          "menu",
          ...surfaces.flatMap((s) =>
            [0, 1, 2].map((i) => "step-" + s + "-" + i),
          ),
        ].map((id) => this.buffer(id)),
      );
      if (this.disposed) return;
      this.bootAmbience();
      void this.switchMusic();
      this.poll = window.setInterval(() => {
        if (document.visibilityState === "visible")
          void this.refreshPublished();
      }, 7000);
    })().finally(() => {
      this.starting = undefined;
    });
    return this.starting;
  }
  async refreshPublished(reconcilePlayback = true) {
    try {
      const response = await fetch("/api/content", {
        cache: "no-store",
        signal: AbortSignal.timeout(1800),
      });
      if (!response.ok) throw new Error("unavailable");
      const content = (await response.json()) as AudioContent;
      if (
        content.schemaVersion !== 1 ||
        !Array.isArray(content.assets) ||
        !Array.isArray(content.tracks) ||
        !Array.isArray(content.cues)
      )
        throw new Error("invalid");
      const changed =
        this.catalogSource !== "published" ||
        this.content.revision !== content.revision;
      this.content = content;
      this.catalogSource = "published";
      this.lastError = "";
      if (changed) {
        this.musicDirty = true;
        this.trackCursor.set(this.musicContext, 0);
        this.cancelPendingCues();
        this.cooldowns.clear();
        this.repetitions.clear();
        this.loopRequests.clear();
        this.loopRetryAt.clear();
        if (reconcilePlayback) {
          this.reconcileAmbientLoops();
          if (this.context) void this.switchMusic(true);
        }
        this.notify();
      }
    } catch {
      if (this.catalogSource !== "published") {
        this.lastError = "স্থানীয় সংরক্ষিত শব্দের তালিকা চলছে।";
        this.notify();
      }
    }
  }
  private buffer(id: string): Promise<AudioBuffer> {
    const asset = this.content.assets.find((a) => a.id === id);
    if (!asset || !this.context)
      return Promise.reject(new Error("অডিও ফাইল পাওয়া যায়নি।"));
    const key = id + ":" + asset.url;
    let pending = this.buffers.get(key);
    if (!pending) {
      pending = fetch(asset.url)
        .then((r) => {
          if (!r.ok) throw new Error("শব্দের ফাইল খোলা যায়নি।");
          return r.arrayBuffer();
        })
        .then((data) => this.context!.decodeAudioData(data))
        .catch((e) => {
          this.buffers.delete(key);
          this.lastError = "কিছু শব্দের ফাইল চালানো যায়নি।";
          this.notify();
          throw e;
        });
      this.buffers.set(key, pending);
    }
    return pending;
  }
  private async playAsset(
    id: string,
    options: {
      category: AudioCategory;
      volume?: number;
      point?: AudioPoint;
      priority?: number;
      character?: string;
      preview?: boolean;
      loop?: boolean;
      rate?: number;
      maxDistance?: number;
      fadeIn?: number;
      fadeOut?: number;
      maxWait?: number;
      valid?: () => boolean;
    },
  ): Promise<Playing | undefined> {
    const c = this.context;
    if (
      !c ||
      this.disposed ||
      c.state !== "running" ||
      (this.paused && !options.preview)
    )
      return;
    const requestedAt = c.currentTime;
    let buffer: AudioBuffer;
    try {
      buffer = await this.buffer(id);
    } catch {
      return;
    }
    if (
      this.disposed ||
      c.state !== "running" ||
      (this.paused && !options.preview)
    )
      return;
    if (options.valid && !options.valid()) return;
    if (options.maxWait && c.currentTime - requestedAt > options.maxWait) {
      this.dropped++;
      return;
    }
    if (["voices", "crowd"].includes(options.category)) {
      const previous = [...this.playing].filter(
        (old) =>
          old.category === options.category &&
          old.character === (options.character ?? "*"),
      );
      if (previous.some((old) => old.priority >= (options.priority ?? 1)))
        return;
      previous.forEach((old) => this.stop(old, 0.04));
    }
    if (this.playing.size >= 40) {
      const old = [...this.playing].find(
        (p) => p.category !== "music" && p.priority < (options.priority ?? 1),
      );
      if (old) this.stop(old);
      else {
        this.dropped++;
        return;
      }
    }
    const source = c.createBufferSource(),
      gain = c.createGain(),
      gate = c.createGain(),
      filter = c.createBiquadFilter();
    source.buffer = buffer;
    source.loop = !!options.loop;
    source.playbackRate.value = options.rate ?? 1;
    filter.type = "lowpass";
    filter.frequency.value =
      options.point &&
      audioOccluded(this.listenerPoint, options.point, this.obstacles)
        ? 1300
        : 20000;
    const volume = options.volume ?? 0.65,
      duration = buffer.duration / source.playbackRate.value,
      fadeIn = Math.min(options.fadeIn ?? 0, duration / 2),
      fadeOut = options.loop
        ? 0
        : Math.min(options.fadeOut ?? 0, Math.max(0, duration - fadeIn));
    gain.gain.value = fadeIn ? 0 : volume;
    if (fadeIn)
      gain.gain.linearRampToValueAtTime(volume, c.currentTime + fadeIn);
    if (fadeOut) {
      gain.gain.setValueAtTime(volume, c.currentTime + duration - fadeOut);
      gain.gain.linearRampToValueAtTime(0, c.currentTime + duration);
    }
    gate.gain.value = this.paused && !options.preview ? 0 : 1;
    source.connect(gain);
    gain.connect(filter);
    const nodes: AudioNode[] = [source, gain, gate, filter];
    if (options.point) {
      const pan = c.createPanner();
      pan.panningModel = "HRTF";
      pan.distanceModel = "inverse";
      pan.refDistance = 2.5;
      pan.maxDistance = options.maxDistance ?? 45;
      pan.rolloffFactor = 1.35;
      pan.positionX.value = options.point.x;
      pan.positionY.value = options.point.y ?? 1;
      pan.positionZ.value = -options.point.z;
      filter.connect(pan);
      pan.connect(gate);
      nodes.push(pan);
    } else filter.connect(gate);
    gate.connect(this.buses.get(options.category) ?? this.master!);
    const playing: Playing = {
      assetId: id,
      source,
      gain,
      gate,
      filter,
      point: options.point,
      category: options.category,
      priority: options.priority ?? 1,
      character: options.character ?? "*",
      preview: !!options.preview,
      nodes,
    };
    this.playing.add(playing);
    source.onended = () => {
      const active = this.playing.delete(playing);
      for (const node of nodes) node.disconnect();
      if (
        active &&
        playing.preview &&
        this.paused &&
        ![...this.playing].some((p) => p.preview)
      )
        void c.suspend();
    };
    source.start();
    return playing;
  }
  private stop(handle: Playing, fade = 0) {
    if (!this.playing.has(handle)) return;
    if (fade && this.context) {
      const t = this.context.currentTime;
      const param = handle.gain.gain,
        current = param.value;
      if (typeof param.cancelAndHoldAtTime === "function")
        param.cancelAndHoldAtTime(t);
      else {
        param.cancelScheduledValues(t);
        param.setValueAtTime(current, t);
      }
      handle.gain.gain.linearRampToValueAtTime(0, t + fade);
      try {
        handle.source.stop(t + fade + 0.02);
      } catch {
        /* ended */
      }
    } else {
      this.playing.delete(handle);
      try {
        handle.source.stop();
      } catch {
        /* ended */
      }
    }
  }
  setMusicContext(context: MusicContext) {
    if (context === this.musicContext) return;
    this.trackCursor.set(context, 0);
    this.musicContext = context;
    if (this.context) void this.switchMusic();
  }
  private async switchMusic(force = false) {
    if (!this.context || this.paused) return;
    force = force || this.musicDirty;
    const request = ++this.musicRequest,
      context = this.musicContext;
    const tracks = this.content.tracks
      .filter((t) => t.enabled && t.contexts.includes(context))
      .sort((a, b) => a.order - b.order);
    if (!tracks.length) {
      if (this.music) this.stop(this.music, 1);
      this.music = undefined;
      this.musicDirty = false;
      return;
    }
    const cursor = this.trackCursor.get(context) ?? 0,
      random = tracks.some((t) => t.random),
      track = random
        ? tracks[Math.floor(Math.random() * tracks.length)]
        : tracks[cursor];
    if (!track) {
      if (this.music) this.stop(this.music, 0.15);
      this.music = undefined;
      this.musicDirty = false;
      return;
    }
    if (!force && this.music?.character === track.id) return;
    try {
      await this.buffer(track.assetId);
    } catch {
      return;
    }
    if (request !== this.musicRequest || this.paused || this.disposed) return;
    const previous = this.music,
      previousTrack = this.content.tracks.find(
        (t) => t.id === previous?.character,
      ),
      playing = await this.playAsset(track.assetId, {
        category: "music",
        volume: track.volume,
        loop: track.loop,
        priority: 10,
        character: track.id,
        fadeIn: Math.max(0.05, track.fadeIn),
        fadeOut: track.fadeOut,
      });
    if (!playing) return;
    if (request !== this.musicRequest) {
      this.stop(playing);
      return;
    }
    this.music = playing;
    this.musicDirty = false;
    if (previous)
      this.stop(
        previous,
        Math.max(0.05, previousTrack?.fadeOut ?? track.fadeOut),
      );
    this.record("music-" + context);
    const ended = playing.source.onended;
    playing.source.onended = (event) => {
      ended?.call(playing.source, event);
      if (this.music === playing && !track.loop && !this.disposed) {
        this.music = undefined;
        this.trackCursor.set(context, cursor + 1);
        void this.switchMusic();
      }
    };
  }
  event(
    trigger: string | readonly string[],
    point?: AudioPoint,
    character = "*",
    category?: AudioCategory,
  ) {
    const c = this.context;
    if (!c || c.state !== "running" || this.paused) return;
    const triggers = typeof trigger === "string" ? [trigger] : trigger;
    const candidates = this.content.cues.filter(
      (cue) =>
        cue.enabled &&
        triggers.includes(cue.trigger) &&
        (!category || cue.category === category) &&
        (cue.character === "*" || cue.character === character) &&
        c.currentTime - (this.cooldowns.get(cue.id) ?? -Infinity) >=
          cue.cooldown &&
        (!cue.maxRepetitions ||
          (this.repetitions.get(cue.id) ?? 0) +
            (this.pendingRepetitions.get(cue.id) ?? 0) <
            cue.maxRepetitions),
    );
    for (const category of new Set(candidates.map((cue) => cue.category))) {
      let list = candidates.filter((cue) => cue.category === category);
      if (typeof trigger !== "string") {
        const priority = Math.max(...list.map((cue) => cue.priority));
        list = list.filter((cue) => cue.priority === priority);
      }
      const total = list.reduce((sum, cue) => sum + cue.weight, 0);
      let pick = Math.random() * total;
      const cue =
        list.find((cue) => (pick -= cue.weight) <= 0) ?? list[list.length - 1];
      this.playCue(cue, point, character);
    }
  }
  private playCue(cue: AudioCue, point?: AudioPoint, character = "*") {
    if (!this.context) return;
    this.cooldowns.set(cue.id, this.context.currentTime);
    const version = this.cueVersion;
    this.pendingRepetitions.set(
      cue.id,
      (this.pendingRepetitions.get(cue.id) ?? 0) + 1,
    );
    const release = () => {
      if (version === this.cueVersion)
        this.pendingRepetitions.set(
          cue.id,
          Math.max(0, (this.pendingRepetitions.get(cue.id) ?? 1) - 1),
        );
    };
    const valid = () =>
      version === this.cueVersion && !this.paused && !this.disposed;
    const play = () => {
      if (!valid()) {
        release();
        return;
      }
      void this.playAsset(cue.assetId, {
        category: cue.category,
        volume: cue.volume,
        point: cue.spatial ? point : undefined,
        priority: cue.priority,
        character,
        maxDistance: cue.maxDistance,
        valid,
      }).then((handle) => {
        release();
        if (handle) {
          this.repetitions.set(cue.id, (this.repetitions.get(cue.id) ?? 0) + 1);
          this.cooldowns.set(cue.id, this.context?.currentTime ?? 0);
          this.record(cue.trigger);
          if (cue.subtitle) this.subtitleHandler?.(cue.subtitle);
        }
      });
    };
    if (cue.delay) {
      const timer = window.setTimeout(() => {
        this.scheduled.delete(timer);
        play();
      }, cue.delay * 1000);
      this.scheduled.add(timer);
    } else play();
  }
  private cancelPendingCues() {
    this.cueVersion++;
    this.pendingRepetitions.clear();
    this.scheduled.forEach(clearTimeout);
    this.scheduled.clear();
  }
  footstep(
    surface: Surface,
    point: AudioPoint,
    running: boolean,
    frame: number,
    foot: string,
  ) {
    if (this.paused || this.context?.state !== "running") return;
    const version = this.cueVersion;
    let variant = Math.floor(Math.random() * 3);
    if (variant === this.lastVariant.get(surface)) variant = (variant + 1) % 3;
    this.lastVariant.set(surface, variant);
    void this.playAsset("step-" + surface + "-" + variant, {
      category: "footsteps",
      volume: running ? 0.85 : 0.5,
      point,
      priority: 2,
      rate: (running ? 1.07 : 0.97) + Math.random() * 0.06,
      maxDistance: 18,
      maxWait: 0.1,
      valid: () => version === this.cueVersion && !this.paused,
    }).then((handle) => {
      if (handle) this.record("footstep", { surface, frame, foot });
    });
  }
  private record(
    event: string,
    detail: { surface?: Surface; frame?: number; foot?: string } = {},
  ) {
    this.eventCounts[event] = (this.eventCounts[event] ?? 0) + 1;
    this.recent.push({ event, at: this.context?.currentTime ?? 0, ...detail });
    if (this.recent.length > 24) this.recent.shift();
  }
  private bootAmbience() {
    const now = this.context?.currentTime ?? 0;
    this.ambience = [
      {
        event: "conversation",
        point: { x: -6, y: 1.606, z: 0.6 },
        next: now + 7,
        min: 13,
        max: 28,
        character: "চা-মামা কুদ্দুস",
      },
      {
        event: "slogan",
        point: { x: 1.8, y: 2.066, z: 10.6 },
        next: now + 10,
        min: 10,
        max: 22,
      },
      {
        event: "bell",
        point: { x: -4.1, z: -3.7 },
        next: now + 3,
        min: 7,
        max: 18,
      },
      {
        event: "bus",
        point: { x: 3.1, z: 21.5 },
        next: now + 8,
        min: 12,
        max: 25,
      },
      {
        event: "tea",
        point: { x: -6.7, z: 1.3 },
        next: now + 5,
        min: 4,
        max: 11,
      },
      {
        event: "crow",
        point: { x: 7.2, y: 6, z: 11.7 },
        next: now + 9,
        min: 9,
        max: 22,
        night: false,
      },
      {
        event: "construction",
        point: { x: 14, z: 30 },
        next: now + 13,
        min: 18,
        max: 35,
        night: false,
      },
      {
        event: "microphone",
        point: { x: 1.8, y: 2.05, z: 9.35 },
        next: now + 6,
        min: 15,
        max: 28,
      },
      {
        event: "insects",
        point: { x: -7.2, z: -13.5 },
        next: now + 4,
        min: 5,
        max: 10,
        night: true,
      },
    ];
    this.reconcileAmbientLoops();
  }
  private reconcileAmbientLoops() {
    const c = this.context;
    if (!c || this.disposed || this.paused || c.state !== "running") return;
    for (const layer of [
      {
        id: "traffic",
        point: { x: -12, y: 1, z: -15 },
        gain: 0.18 / 0.65,
        enabled: true,
      },
      {
        id: "cng",
        point: { x: 4, y: 0.8, z: 2 },
        gain: 0.15 / 0.65,
        enabled: true,
      },
      {
        id: "rain",
        point: { x: 0, y: 8, z: 3 },
        gain: 0.28 / 0.65,
        enabled: this.raining,
      },
    ]) {
      const current = this.loops.get(layer.id);
      const candidates = this.content.cues.filter(
        (cue) => cue.enabled && cue.trigger === layer.id,
      );
      const cue =
        candidates.find((candidate) =>
          current?.signature.startsWith(candidate.id + "|"),
        ) ?? candidates[0];
      if (!layer.enabled || !cue) {
        this.loopRequests.delete(layer.id);
        if (current) {
          this.stop(current.handle, 0.15);
          this.loops.delete(layer.id);
        }
        continue;
      }
      const asset = this.content.assets.find((a) => a.id === cue.assetId);
      const signature = [
        cue.id,
        cue.assetId,
        asset?.url,
        cue.category,
        cue.volume,
        cue.spatial,
        cue.maxDistance,
        cue.priority,
      ].join("|");
      if (
        current?.signature === signature ||
        this.loopRequests.get(layer.id)?.signature === signature
      )
        continue;
      if ((this.loopRetryAt.get(layer.id) ?? 0) > c.currentTime) continue;
      const token = ++this.loopVersion;
      this.loopRequests.set(layer.id, { token, signature });
      const valid = () =>
        this.loopRequests.get(layer.id)?.token === token &&
        !this.disposed &&
        !this.paused;
      void this.playAsset(cue.assetId, {
        category: cue.category,
        point: cue.spatial ? layer.point : undefined,
        volume: cue.volume * layer.gain,
        loop: true,
        priority: cue.priority,
        character: layer.id,
        maxDistance: cue.maxDistance,
        fadeIn: 0.15,
        valid,
      }).then((handle) => {
        if (!valid()) {
          if (handle) this.stop(handle);
          return;
        }
        this.loopRequests.delete(layer.id);
        if (!handle) {
          this.loopRetryAt.set(layer.id, c.currentTime + 5);
          return;
        }
        const old = this.loops.get(layer.id);
        this.loops.set(layer.id, { handle, signature });
        if (old) this.stop(old.handle, 0.15);
      });
    }
  }
  tick() {
    const c = this.context;
    if (!c || c.state !== "running" || this.paused) return;
    for (const layer of this.ambience) {
      if (c.currentTime < layer.next) continue;
      layer.next =
        c.currentTime + layer.min + Math.random() * (layer.max - layer.min);
      if (layer.night !== undefined && layer.night !== this.night) continue;
      if (layer.event === "slogan" && this.musicContext !== "mission") continue;
      this.event(layer.event, layer.point, layer.character);
    }
    this.reconcileAmbientLoops();
  }
  setNight(night: boolean) {
    this.night = night;
  }
  setRain(raining: boolean) {
    this.raining = raining;
    this.loopRequests.delete("rain");
    this.loopRetryAt.delete("rain");
    this.reconcileAmbientLoops();
  }
  listener(x: number, z: number, yaw: number) {
    this.listenerPoint = { x, y: 1.6, z };
    const c = this.context;
    if (!c) return;
    const l = c.listener,
      t = c.currentTime;
    l.positionX.setTargetAtTime(x, t, 0.04);
    l.positionY.setTargetAtTime(1.6, t, 0.04);
    l.positionZ.setTargetAtTime(-z, t, 0.04);
    l.forwardX.setTargetAtTime(Math.sin(yaw), t, 0.04);
    l.forwardY.setTargetAtTime(0, t, 0.04);
    l.forwardZ.setTargetAtTime(-Math.cos(yaw), t, 0.04);
    l.upY.value = 1;
    for (const h of this.playing)
      if (h.point)
        h.filter.frequency.setTargetAtTime(
          audioOccluded(this.listenerPoint, h.point, this.obstacles)
            ? 1300
            : 20000,
          t,
          0.08,
        );
  }
  effect(hit = false) {
    this.event(hit ? "hit" : "pickup", this.listenerPoint);
  }
  async interfaceClick() {
    if (!this.context) return;
    await this.context.resume();
    await this.playAsset("menu", {
      category: "interface",
      volume: 0.3,
      preview: this.paused,
      priority: 2,
    });
  }
  async preview(category: AudioCategory) {
    if (this.disposed) return;
    const request = ++this.previewRequest;
    for (const handle of this.playing) if (handle.preview) this.stop(handle);
    const c = this.ensureContext();
    await c.resume();
    await this.refreshPublished(false);
    if (this.disposed || request !== this.previewRequest) return;
    const channel = category === "master" ? "interface" : category,
      cue = this.content.cues.find(
        (entry) => entry.enabled && entry.category === channel,
      ),
      track =
        this.content.tracks.find(
          (entry) =>
            entry.enabled && entry.contexts.includes(this.musicContext),
        ) ?? this.content.tracks.find((entry) => entry.enabled),
      id =
        channel === "music"
          ? track?.assetId
          : channel === "footsteps"
            ? "step-asphalt-0"
            : cue?.assetId;
    if (!id || !this.content.assets.some((asset) => asset.id === id)) {
      this.lastError = `${audioLabels[category]} বিভাগে চালু শব্দ পাওয়া যায়নি।`;
      this.notify();
      if (this.paused) void c.suspend();
      return;
    }
    const playing = await this.playAsset(id, {
      category: channel,
      volume: channel === "music" ? track?.volume : (cue?.volume ?? 0.65),
      preview: true,
      priority: 10,
      valid: () => request === this.previewRequest,
    });
    if (!playing && this.paused && request === this.previewRequest)
      void c.suspend();
    return playing;
  }
  pause(paused: boolean) {
    this.paused = paused;
    if (paused) {
      this.resumeVersion++;
      this.previewRequest++;
      this.loopRequests.clear();
      this.cancelPendingCues();
    }
    for (const h of this.playing) {
      if (!paused && h.preview) this.stop(h);
      h.gate.gain.setTargetAtTime(
        paused && !h.preview ? 0 : 1,
        this.context?.currentTime ?? 0,
        0.02,
      );
    }
    if (paused) void this.context?.suspend();
    else {
      void this.start(this.musicContext);
    }
  }
  diagnostics() {
    const signal = new Float32Array(512);
    this.analyser?.getFloatTimeDomainData(signal);
    const outputRms = Math.sqrt(
      signal.reduce((sum, v) => sum + v * v, 0) / signal.length,
    );
    return {
      state: this.status,
      unlocked: this.unlocked,
      catalogSource: this.catalogSource,
      revision: this.content.revision,
      context: this.musicContext,
      activeVoices: this.playing.size,
      music: this.music
        ? {
            trackId: this.music.character,
            assetId: this.music.assetId,
            configuredVolume: this.content.tracks.find(
              (t) => t.id === this.music?.character,
            )?.volume,
            gain: this.music.gain.gain.value,
            loop: this.music.source.loop,
          }
        : null,
      loops: [...this.loops.entries()].map(([id, loop]) => ({
        id,
        assetId: loop.handle.assetId,
        category: loop.handle.category,
        gain: loop.handle.gain.gain.value,
      })),
      repetitions: Object.fromEntries(this.repetitions),
      outputRms,
      dropped: this.dropped,
      eventCounts: { ...this.eventCounts },
      recent: [...this.recent],
      settings: this.settings,
      lastError: this.lastError,
    };
  }
  dispose() {
    this.disposed = true;
    this.cancelPendingCues();
    this.resumeVersion++;
    this.previewRequest++;
    this.loopRequests.clear();
    this.loops.clear();
    if (this.poll) clearInterval(this.poll);
    this.scheduled.forEach(clearTimeout);
    for (const h of this.playing) this.stop(h);
    void this.context?.close();
    this.observers.clear();
  }
}
