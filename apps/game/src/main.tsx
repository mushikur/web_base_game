import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/noto-sans-bengali/400.css";
import "@fontsource/noto-sans-bengali/600.css";
import "@fontsource/noto-sans-bengali/700.css";
import "@fontsource/noto-sans-bengali/800.css";
import {
  bn,
  content,
  catalogAssetUrl,
  itemOrder,
  tutorialSteps,
  qualityOrder,
  qualitySettings,
  type Item,
} from "@neta/shared";
import type { DhakaGame, Snapshot } from "./game";
import "./style.css";
import { AudioSettings } from "./AudioSettings";
import { OnlinePanel } from "./OnlinePanel";
import { readOnlineOption, storedSeat } from "./onlineClient";
import { MissionMap } from "./missionMap";
import { NewspaperView } from "./NewspaperView";
import { weatherOptions } from "./weatherOptions";
import {
  worldAreas,
  type AreaId,
} from "../../../packages/shared/src/world-layout";
import { missionPhaseLabels } from "../../../packages/shared/src/missions";

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    arrow: (
      <>
        <path d="M4 12h15M13 6l6 6-6 6" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    sound: (
      <>
        <path d="M4 9v6h4l5 4V5L8 9H4Zm13-1q6 4 0 8m2-11q9 7 0 14" />
      </>
    ),
    settings: (
      <>
        <path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3Z" />
        <circle cx="12" cy="11" r="3" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    pin: (
      <>
        <path d="M18 9c0 5-6 11-6 11S6 14 6 9a6 6 0 1 1 12 0Z" />
        <circle cx="12" cy="9" r="2" />
      </>
    ),
    egg: <path d="M19 14c0 5-14 5-14 0C5 8 9 3 12 3s7 5 7 11Z" />,
    sandal: (
      <>
        <path d="M8 3c3-2 8 0 8 4l2 12c-1 3-9 4-11 0L6 8c0-3 1-4 2-5Z" />
        <path d="m7 10 5-3 5 3m-5-3v5" />
      </>
    ),
    heart: (
      <path d="M20 5c-3-3-7 0-8 2-1-2-5-5-8-2-5 5 8 15 8 15S25 10 20 5Z" />
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4m0 14v4M1 12h4m14 0h4" />
      </>
    ),
    rickshaw: (
      <>
        <circle cx="5" cy="17" r="3" />
        <circle cx="20" cy="17" r="3" />
        <path d="m5 17 4-8 5 8H5m9 0 4-10h3M8 5h4M2 12V5c1-5 12-5 13 0v7m-13 0h11M4 6h8" />
      </>
    ),
    hand: (
      <>
        <path d="M7 13V7a1.5 1.5 0 0 1 3 0v4-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v7c0 7-10 8-13 3l-4-6c-1-2 2-3 3-1l2 2Z" />
      </>
    ),
    move: (
      <>
        <path d="M12 3v18M3 12h18m-5-5 5 5-5 5M7 7l-5 5 5 5M7 7l5-5 5 5M7 17l5 5 5-5" />
      </>
    ),
    camera: (
      <>
        <path d="m3 8 5-1 2-3h4l2 3 5 1v12H3Z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    baton: <path d="m7 20-3-3L15 5l4 4L7 20Zm6-12 3 3m-7 2 3 3M15 5l2-2 4 4-2 2" />,
    soundDevice: <path d="m3 10 6-1 8-4v14l-8-4-6-1v-4Zm6 5 2 5H7l-2-5m15-7 2-2m-2 10 2 2" />,
    spark: <path d="m4 20 3-10 7 7-10 3Zm8-11 2-4m2 7 4-2M16 3l1 2 2 1m-5 9 4 2m3-10 1-2" />,
    run: (
      <>
        <circle cx="15" cy="4" r="2" />
        <path d="m7 9 5-2 5 5 4-1M12 7l-2 7 6 3v5M10 14l-6 7M2 6h5M1 10h4" />
      </>
    ),
    map: (
      <>
        <path d="m2 6 6-3 8 3 6-3v16l-6 3-8-3-6 3Zm6-3v16m8-13v16" />
      </>
    ),
    pickup: (
      <>
        <path d="M4 16v5h16v-5M12 3v13m-5-5 5 5 5-5" />
      </>
    ),
    select: (
      <>
        <rect x="2" y="5" width="8" height="14" rx="2" />
        <rect x="14" y="5" width="8" height="14" rx="2" />
        <path d="m16 13 2 2 3-5" />
      </>
    ),
    use: (
      <>
        <path d="m3 19 8-8m-5-1 5 1 1 5m1-10 2-3m2 6 4-1m-5 5 3 3" />
        <circle cx="8" cy="16" r="5" />
      </>
    ),
    vehicle: (
      <>
        <path d="M4 17V7l3-4h10l3 4v10ZM4 8h16M8 3v5m8-5v5M3 13h4m10 0h4M6 17v4m12-4v4" />
      </>
    ),
    board: (
      <>
        <path d="M14 3h7v18h-7M2 12h14m-5-5 5 5-5 5" />
      </>
    ),
    mission: (
      <>
        <path d="M6 22V3m0 1c5-5 7 5 14 0v9c-7 5-9-5-14 0" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.target}
    </svg>
  );
}

function MiniMap({
  s,
  expanded = false,
  onOpen,
  onSelect,
}: {
  s: Snapshot;
  expanded?: boolean;
  onOpen?: () => void;
  onSelect?: (id: AreaId) => void;
}) {
  return (
    <MissionMap
      data={s.missionMap}
      areas={s.catalog.areas}
      player={{ x: s.x, z: s.z }}
      yaw={s.yaw}
      expanded={expanded}
      onOpen={onOpen}
      onSelect={onSelect}
    />
  );
}

function TutorialPanel({ s, game }: { s: Snapshot; game: DhakaGame }) {
  const step = tutorialSteps[s.tutorial.stepIndex];
  if (!s.tutorialOpen || !step) return null;
  return (
    <section
      className="tutorial-panel"
      aria-label="খেলা শেখার নির্দেশনা"
      data-testid="tutorial-panel"
    >
      <div className="tutorial-top">
        <span className="tutorial-icon">
          <Icon name={step.icon} size={27} />
        </span>
        <div>
          <span className="tutorial-kicker">গলি চেনার পাঠ</span>
          <strong>
            ধাপ {bn(s.tutorial.stepIndex + 1)} / {bn(tutorialSteps.length)}
          </strong>
        </div>
        <span className="tutorial-safety">নিরাপদ অনুশীলন</span>
      </div>
      <div className="tutorial-progress" aria-hidden="true">
        {tutorialSteps.map((entry, i) => (
          <i
            key={entry.id}
            className={i <= s.tutorial.stepIndex ? "done" : ""}
          />
        ))}
      </div>
      <h2 aria-live="polite">{step.title}</h2>
      <p>{step[s.inputMode]}</p>
      <div className="tutorial-guide">
        <Icon name="pin" size={15} />
        <span>{s.tutorialGuide}</span>
      </div>
      <footer>
        <label>
          <input
            type="checkbox"
            checked={s.dontShowTutorial}
            onChange={(event) => game.setDontShowTutorial(event.target.checked)}
          />
          আর দেখাবেন না
        </label>
        <button onClick={() => game.skipTutorial()}>
          এড়িয়ে যান <Icon name="arrow" size={15} />
        </button>
      </footer>
    </section>
  );
}

function ExpandedMap({ s, game }: { s: Snapshot; game: DhakaGame }) {
  return (
    <div className="map-backdrop">
      <section
        className="expanded-map-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-title"
      >
        <header>
          <div>
            <span className="eyebrow">পাড়ার পথঘাট</span>
            <h2 id="map-title">পাঁচ পাড়ার পথঘাট</h2>
          </div>
          <button
            autoFocus
            className="icon-button"
            aria-label="মানচিত্র বন্ধ করুন"
            onClick={() => game.map(false)}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="expanded-map-body">
          <MiniMap s={s} expanded onSelect={(id) => game.selectMission(id)} />
          <div className="map-destinations">
            <p>চিহ্ন বেছে অবস্থান ও কাজ দেখুন।</p>
            {worldAreas
              .filter((a) => s.missionMap.phases[a.id] === "restartable")
              .map((a) => (
                <button key={a.id} onClick={() => game.retryMission(a.id)}>
                  {s.catalog.areas[a.id].name} • আবার চেষ্টা করুন
                </button>
              ))}
            <button
              className={s.selectedMapMarker === "mission" ? "active" : ""}
              onClick={() => game.viewFirstMarker()}
              aria-pressed={s.selectedMapMarker === "mission"}
            >
              <Icon name="mission" />
              <span>
                <strong>প্রথম অভিযানের চিহ্ন</strong>
                <small>সভার সামনে সোনালি বৃত্ত</small>
              </span>
            </button>
            <button
              className={s.selectedMapMarker === "vehicle" ? "active" : ""}
              onClick={() => game.viewVehicleMarker()}
              aria-pressed={s.selectedMapMarker === "vehicle"}
            >
              <Icon name="vehicle" />
              <span>
                <strong>সবুজ সিএনজি</strong>
                <small>সভার আগে ডান পাশে • খালি সিট ১টি</small>
              </span>
            </button>
            {s.selectedMapMarker === "mission" && (
              <article className="marker-detail" aria-live="polite">
                <span>এই গলির লক্ষ্য</span>
                <h3>সভা শেষ, রাস্তা খোলা!</h3>
                <p>
                  {s.missionMap.activeId
                    ? missionPhaseLabels[
                        s.missionMap.phases[s.missionMap.activeId]
                      ]
                    : s.missionMap.routeMessage}
                </p>
                <small>সামনের সোনালি বৃত্তটি অভিযানের অবস্থান দেখায়।</small>
              </article>
            )}
            {s.selectedMapMarker === "vehicle" && (
              <article className="marker-detail" aria-live="polite">
                <span>সিটে ওঠার অনুশীলন</span>
                <h3>সবুজ সিএনজি</h3>
                <p>
                  খোলা পাশের দরজার কাছে গিয়ে মিথস্ক্রিয়া করুন। বসে চারপাশ দেখুন,
                  তারপর নিরাপদে নামুন।
                </p>
              </article>
            )}
            <div className="map-key">
              <span>● ডিম ও স্যান্ডেল</span>
              <span>▣ সিএনজি</span>
              <span>⚑ অভিযানের চিহ্ন</span>
            </div>
            <button className="secondary" onClick={() => game.map(false)}>
              গলিতে ফিরুন <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Joystick({ game }: { game: DhakaGame }) {
  const ref = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  const update = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect(),
      x = (e.clientX - r.left - r.width / 2) / 38,
      y = (e.clientY - r.top - r.height / 2) / 38,
      l = Math.max(1, Math.hypot(x, y));
    setPoint({ x: (x / l) * 30, y: (y / l) * 30 });
    game.joystick(x / l, y / l);
  };
  const end = () => {
    setPoint({ x: 0, y: 0 });
    game.joystick(0, 0);
  };
  return (
    <div
      ref={ref}
      className="joystick"
      role="group"
      aria-label="চলার স্পর্শ নিয়ন্ত্রণ"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) update(e);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div style={{ transform: `translate(${point.x}px,${point.y}px)` }} />
      <span>চলুন</span>
    </div>
  );
}

function App() {
  const canvas = useRef<HTMLCanvasElement>(null),
    game = useRef<DhakaGame | null>(null);
  const [s, setS] = useState<Snapshot | null>(null),
    [settings, setSettings] = useState(false),
    [help, setHelp] = useState(false),
    [onlineOpen, setOnlineOpen] = useState(() => !!(readOnlineOption("room") || readOnlineOption("ref") || storedSeat())),
    [startupError, setStartupError] = useState("");
  useEffect(() => {
    let g: DhakaGame | undefined;
    let cancelled = false;
    void import("./game")
      .then(({ DhakaGame }) => {
        if (cancelled) return;
        g = new DhakaGame(canvas.current!, setS);
        game.current = g;
        void g.init();
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled)
          setStartupError(
            "এই ব্রাউজারে ত্রিমাত্রিক দৃশ্য চালু করা যায়নি। হালনাগাদ ব্রাউজারে আবার চেষ্টা করুন।",
          );
      });
    return () => {
      cancelled = true;
      g?.dispose();
    };
  }, []);
  const g = game.current;
  const qaDiagnostics =
    s?.ready && g && new URLSearchParams(location.search).has("qa")
      ? g.diagnostics()
      : null;
  const openSettings = () => {
    setSettings(true);
    if (s?.playing && !s.paused) g?.pause();
  };
  const closeSettings = () => {
    setSettings(false);
    if (s?.playing && s.paused) g?.pause();
  };
  useEffect(() => {
    if (!settings && !help && !s?.paused && !s?.mapOpen && !s?.spawnBlocked && !(onlineOpen && !s?.playing) && s?.online?.phase !== "won")
      return;
    const prior = document.activeElement as HTMLElement | null;
    const handle = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        (settings || help || game.current?.state.mapOpen)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (settings) {
          setSettings(false);
          if (game.current?.state.playing && game.current.state.paused)
            game.current.pause();
        }
        setHelp(false);
        if (game.current?.state.mapOpen) game.current.map(false);
      }
      if (event.key === "Tab") {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
        const controls = Array.from(
          dialog?.querySelectorAll<HTMLElement>(
            'button,a[href],input,select,[tabindex="0"]',
          ) ?? [],
        ).filter((e) => e.offsetParent !== null && !e.matches(":disabled"));
        if (!controls.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !dialog?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !dialog?.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => {
      window.removeEventListener("keydown", handle, true);
      if (
        game.current?.state.playing &&
        !game.current.state.paused &&
        !game.current.state.mapOpen &&
        !game.current.state.spawnBlocked
      )
        canvas.current?.focus();
      else if (prior?.isConnected) prior.focus();
    };
  }, [settings, help, s?.paused, s?.mapOpen, s?.spawnBlocked, onlineOpen, s?.playing, s?.online?.phase]);
  const catalog = s?.catalog;
  const branding = catalog?.branding ?? content;
  const logo = catalog && catalogAssetUrl(catalog, catalog.branding.logo);
  const player = catalog?.characters.player;
  const portrait = catalog && player && catalogAssetUrl(catalog, player.portrait);
  const target = catalog && Object.values(catalog.characters).find((character) => character.name === s?.target);
  const targetPortrait = catalog && target && catalogAssetUrl(catalog, target.portrait);
  const mission = s?.missionMap.activeId ?? s?.missionMap.selectedId;
  return (
    <main
      data-theme={catalog?.branding.theme}
      className={`app ${s?.playing ? "is-playing" : ""} input-${s?.inputMode ?? "desktop"} ${s?.tutorialOpen ? "is-tutorial" : ""}`}
    >
      <canvas
        ref={canvas}
        className="game-canvas"
        tabIndex={0}
        aria-label="ঢাকার কাল্পনিক গলির ত্রিমাত্রিক খেলা"
      />
      <div className="scene-vignette" />
      {s?.catalogPreview && <aside className="catalog-preview-badge">খসড়া প্রিভিউ • অগ্রগতি সেভ হবে না</aside>}
      {!s?.ready && (
        <div className="loading">
          <div className="loading-mark">
            <Icon name="rickshaw" size={52} />
          </div>
          <p>ঢাকার গলিতে স্বাগতম</p>
          <h1>{branding.title}</h1>
          <span>
            {startupError ||
              s?.error ||
              "গলি সাজানো হচ্ছে… চায়ের কেটলিটা বসুক!"}
          </span>
          {s?.error || startupError ? (
            <button className="primary" onClick={() => location.reload()}>
              আবার চেষ্টা করুন
            </button>
          ) : (
            <div className="loading-line">
              <i />
            </div>
          )}
          <small>সব চরিত্র ও ঘটনা কাল্পনিক</small>
        </div>
      )}
      {s?.ready && !s.playing && (
        <>
          <header className="home-header">
            <a className="brand" href="#" aria-label={`${branding.title} প্রচ্ছদ`}>
              <span className="brand-icon">
                {logo ? <img className="catalog-logo" src={logo} alt="" /> : <Icon name="rickshaw" size={28} />}
              </span>
              <strong>
                {branding.title}
              </strong>
            </a>
            <nav>
              <span className="edition">
                <i /> ঢাকার গল্প, আপনার খেলা
              </span>
              <button
                className="icon-button"
                aria-label="সেটিংস খুলুন"
                onClick={openSettings}
              >
                <Icon name="settings" />
              </button>
            </nav>
          </header>
          <section className="home-copy">
            <div className="eyebrow">
              <span /> {s.catalog.areas["promise-junction"].name} থেকে স্বাগতম
            </div>
            <h1>
              {branding.title === content.title ? <>নেতা<br /><span>উঠছে!</span></> : <span>{branding.title}</span>}
              <svg viewBox="0 0 300 25" aria-hidden="true">
                <path
                  d="M8 15Q130-3 285 10M40 24Q190 6 272 20"
                  stroke="currentColor"
                  strokeWidth="5"
                  fill="none"
                />
              </svg>
            </h1>
            <h2>{branding.slogan}</h2>
            <p>
              চায়ের কাপে ঝড়, রাস্তায় সভা।
              <br />
              এই গলির জট খুলবেন আপনিই!
            </p>
            <button className="primary play-button" onClick={() => g?.start()}>
              <span>গলিতে নামুন</span>
              <Icon name="arrow" size={25} />
            </button>
            {s?.hasSavedRun && (
              <div className="resume-run">
                <button className="secondary" onClick={() => g?.start(true)}>
                  শেষ করা অভিযান রেখে খেলুন
                </button>
                <small>শেষ চেকপয়েন্ট থেকে ফিরুন। অসমাপ্ত অভিযান প্রবেশপথে আবার শুরু হবে।</small>
              </div>
            )}
            {!s.catalogPreview && <button className="secondary online-home" onClick={() => setOnlineOpen(true)}>
              বন্ধুদের সঙ্গে খেলুন
            </button>}
            <button className="text-button" onClick={() => setHelp(true)}>
              <span className="help-circle">?</span> কীভাবে খেলবেন
            </button>
            <div className="home-meta">
              <span>
                <Icon name="pin" size={15} /> এক টুকরো কাল্পনিক ঢাকা
              </span>
              <span>একক খেলা</span>
            </div>
          </section>
          <aside className="street-caption">
            <span className="caption-line" />
            <div>
              <small>আজকের ঠিকানা</small>
              <h3>{s.catalog.areas["promise-junction"].tea}</h3>
              <p>গরম চা, ঠান্ডা প্রতিশ্রুতি।</p>
            </div>
            <span className="area-number">০১</span>
          </aside>
          <footer className="home-footer">
            <span>হাসির খেলা। সব চরিত্র ও সংগঠন কাল্পনিক।</span>
            <span>
              তৈরি বাংলায়, ঢাকার মেজাজে <i>✦</i>
            </span>
          </footer>
        </>
      )}
      {s?.ready && g && !s.catalogPreview && onlineOpen && <OnlinePanel game={g} playing={s.playing} close={() => setOnlineOpen(false)} />}
      {s?.playing && g && !s.report && (
        <>
          <header className="hud-header">
            <div className="player-card">
              <div className="avatar-monogram">{portrait && !s.online ? <img className="catalog-portrait" src={portrait} alt="" /> : (s.online?.name ?? player?.name)?.at(0)}</div>
              <div>
                <strong>{s.online?.name ?? player?.name}</strong>
                <div className="health-line">
                  <Icon name="heart" size={13} />
                  <div className="health-track">
                    <i style={{ width: `${s.health}%` }} />
                  </div>
                  <span>{bn(s.health)}</span>
                </div>
                {s.online ? <div className="combat-facts" aria-label="দলের হিসাব">
                  <span>দলের পয়েন্ট {bn(s.online.teamScore)}</span>
                  {s.combo > 1 && <b>টানা {bn(s.combo)}</b>}
                </div> : <div className="combat-facts" aria-label="অভিযানের হিসাব">
                  <span>জনরোষ {bn(s.outrage)}%</span>
                  <span>ছবি {bn(s.evidenceCount)}</span>
                  {s.combo > 1 && <b>টানা {bn(s.combo)}</b>}
                </div>}
              </div>
              <div className="score">
                <span>পয়েন্ট</span>
                <b>{bn(s.score).padStart(2, "০")}</b>
              </div>
            </div>
            <div className="location-pill">
              <i />
              {s.catalog.areas["promise-junction"].name}
              <span>{weatherOptions.find(({ id }) => id === s.weather)?.label}</span>
            </div>
            <div className="hud-tools">
              <button
                className="icon-button"
                aria-label={s.muted ? "শব্দ চালু করুন" : "শব্দ বন্ধ করুন"}
                onClick={() => g.mute()}
              >
                <Icon name="sound" />
                {s.muted && <i className="muted-slash" />}
              </button>
              <button
                className="icon-button"
                aria-label="বিরতি"
                onClick={() => g.pause()}
              >
                <Icon name="pause" />
              </button>
              <button
                className="icon-button"
                aria-label="সেটিংস খুলুন"
                onClick={openSettings}
              >
                <Icon name="settings" />
              </button>
            </div>
          </header>
          {s.online ? <section className="mission online-mission">
            <div className="mission-label"><span>দলীয় অভিযান</span><Icon name="target" size={17} /></div>
            <h2>{s.catalog.areas["promise-junction"].name}</h2>
            <p>জিনিস কুড়িয়ে মঞ্চের দিকে ছুড়ুন। সবাই মিলে রাস্তা খুলুন।</p>
            <ul className="online-players">{s.online.players.map((p) => <li key={p.id}>
              <span>{p.name}</span><small>{p.connected ? bn(p.score) : "সংযোগ ফিরছে"}</small>
            </li>)}</ul>
          </section> : !s.tutorialOpen && (
            <section className="mission">
              <div className="mission-label">
                <span>এই গলির কাজ</span>
                <Icon name="target" size={17} />
              </div>
              <h2>
                {(mission ? s.catalog.areas[mission].name : undefined) ??
                  (s.missionMap.completed === 5
                    ? "পাড়ার সব পথ খুলেছে!"
                    : "মানচিত্রে গন্তব্য বেছে নিন")}
              </h2>
              <p>
                {s.missionMap.activeId
                  ? missionPhaseLabels[
                      s.missionMap.phases[s.missionMap.activeId]
                    ]
                  : s.missionMap.routeMessage}
              </p>
              {mission && s.catalog.areas[mission].objective.normalize("NFC") !== worldAreas.find((area) => area.id === mission)?.objective.normalize("NFC") &&
                <p>{s.catalog.areas[mission].objective}</p>}
              {worldAreas
                .filter((a) => s.missionMap.phases[a.id] === "restartable")
                .map((a) => (
                  <button
                    className="mission-retry"
                    key={a.id}
                    onClick={() => g.retryMission(a.id)}
                  >
                    {a.name} • আবার চেষ্টা করুন
                  </button>
                ))}
              <div>
                <span className="step-number">
                  {bn(s.missionMap.completed)}/{bn(5)}
                </span>
                <span>
                  {s.egg + s.sandal > 0
                    ? "সামনে এগিয়ে সভার দিকে লক্ষ্য করুন"
                    : "কাছের ডিম ও স্যান্ডেল কুড়িয়ে নিন"}
                </span>
              </div>
            </section>
          )}
          <TutorialPanel s={s} game={g} />
          <div className="crosshair" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          {s.target && (
            <aside className="target-status">
              {targetPortrait && <img className="catalog-portrait" src={targetPortrait} alt="" />}
              <span>{s.target}</span>
              <div>
                <i style={{ width: `${s.targetHealth}%` }} />
              </div>
              <small>
                {s.targetHealth <= 0
                  ? "আজকের মতো ক্ষান্ত!"
                  : `ধৈর্য ${bn(s.targetHealth)}`}
              </small>
            </aside>
          )}
          <MiniMap s={s} onOpen={() => g.map(true)} />
          {s.vehiclePrompt && (
            <div className="vehicle-context" role="status">
              <Icon name="vehicle" size={19} />
              {s.vehiclePrompt}
            </div>
          )}
          <div className="game-notice" role="status">
            {s.online?.status === "reconnecting" ? "সংযোগ ফিরছে… আপনার আসন রাখা আছে।" : s.online?.notice || s.message}
          </div>
          {s.subtitle && (
            <div className="subtitle" aria-live="polite">
              {s.subtitle}
            </div>
          )}
          <div className="inventory desktop-inventory" aria-label="সঙ্গে থাকা জিনিস">
            {itemOrder.map((kind, i) => (
              <button
                key={kind}
                className={`item-slot ${s.selected === kind ? "selected" : ""}`}
                onClick={() => g.select(kind)}
                aria-label={kind === "hand" ? `${s.catalog.items[kind].name} বাছুন` : `${s.catalog.items[kind].name} বাছুন, ${bn(s[kind])}টি`}
                aria-pressed={s.selected === kind}
                disabled={s.boardingState !== "onFoot"}
              >
                <span className="key-hint">{i + 1}</span>
                <Icon name={kind === "sound" ? "soundDevice" : kind} size={27} />
                <span className="item-name">{s.catalog.items[kind].name}</span>
                <b>{kind === "hand" ? "সবসময়" : `× ${bn(s[kind])}`}</b>
              </button>
            ))}
          </div>
          <label className="mobile-inventory">
            <span>সঙ্গে থাকা জিনিস</span>
            <select
              aria-label="সঙ্গে থাকা জিনিস বাছুন"
              value={s.selected}
              disabled={s.boardingState !== "onFoot"}
              onChange={(event) => g.select(event.currentTarget.value as Item)}
            >
              {itemOrder.map((item) => <option key={item} value={item}>
                {s.catalog.items[item].name}{item === "hand" ? "" : ` • ${bn(s[item])}টি`}
              </option>)}
            </select>
          </label>
          {s.vehicleName ? <div className="desktop-controls">
            <span><kbd>W S</kbd> সামনে ও পেছনে</span>
            <span><kbd>A D</kbd> বাঁক নিন</span>
            <span><kbd>Space</kbd> ব্রেক • <kbd>H</kbd> সংকেত</span>
            <span><kbd>Tab</kbd> নামুন • <kbd>M</kbd> মানচিত্র</span>
          </div> : <div className="desktop-controls">
            <span>
              <kbd>W A S D</kbd> চলুন
            </span>
            <span>
              <kbd>Shift</kbd> দৌড়
            </span>
            <span>
              <kbd>E</kbd> মিথস্ক্রিয়া
            </span>
            <span>
              <kbd>Enter</kbd> ব্যবহার
            </span>
            <span>{!s.online && <><kbd>Tab</kbd> গাড়ি • </>}<kbd>M</kbd> মানচিত্র</span>
            <span>টেনে ক্যামেরা • চাকা দিয়ে জিনিস বদলান</span>
            {!s.online && <span><kbd>Q</kbd> প্রমাণের ছবি</span>}
          </div>}
          <div className="action-buttons">
            <button
              className={`pickup-button ${s.nearPickup || s.nearVehicle ? "near" : ""}`}
              onClick={() => g.context()}
              aria-label={
                s.boardingState === "seated"
                  ? s.vehicleName ? "গাড়ি থেকে নামুন" : "সিএনজি থেকে নামুন"
                  : s.nearVehicle
                    ? s.tutorialOpen ? "সিএনজিতে উঠুন" : "গাড়িতে উঠুন"
                    : "কাছের জিনিস কুড়ান"
              }
            >
              <Icon
                name={
                  s.nearVehicle || s.boardingState !== "onFoot"
                    ? "vehicle"
                    : "hand"
                }
              />
              <span>
                {s.boardingState === "seated"
                  ? "নামুন"
                  : s.nearVehicle
                    ? "গাড়ি"
                    : "কুড়ান"}
              </span>
            </button>
            <button
              className="throw-button"
              onClick={() => s.vehicleName ? g.horn() : g.throw()}
              disabled={s.boardingState !== "onFoot" && !s.vehicleName}
            >
              <Icon name="target" size={29} />
              <span>{s.vehicleName ? "সংকেত" : "ব্যবহার"}</span>
            </button>
          </div>
          <div
            className="camera-tools"
            role="group"
            aria-label="ক্যামেরার দূরত্ব"
          >
            <button
              aria-label="ক্যামেরা কাছে আনুন"
              onClick={() => g.zoom(-0.6)}
            >
              <span aria-hidden="true">＋</span> কাছে
            </button>
            <button aria-label="ক্যামেরা দূরে নিন" onClick={() => g.zoom(0.6)}>
              <span aria-hidden="true">−</span> দূরে
            </button>
            {!s.online && <button aria-label="প্রমাণের ছবি তুলুন" onClick={() => g.captureEvidence()} disabled={s.boardingState !== "onFoot"}>
              <Icon name="camera" size={17} /> ছবি
            </button>}
          </div>
          <div className="mobile-controls">
            <Joystick game={g} />
            <button
              className="run-button"
              aria-label={s.vehicleName ? "ব্রেক" : s.runEnabled ? "দৌড় বন্ধ করুন" : "দৌড় চালু করুন"}
              aria-pressed={s.vehicleName ? s.driveBrake : s.runEnabled}
              onClick={() => s.vehicleName ? g.brake() : g.run()}
            >
              {s.vehicleName ? "ব্রেক" : "দৌড়"}
            </button>
          </div>
          {s.mapOpen && <ExpandedMap s={s} game={g} />}
          {s.spawnBlocked && (
            <div className="modal-backdrop">
              <section
                className="dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="spawn-title"
              >
                <span className="eyebrow">একটু অপেক্ষা</span>
                <h2 id="spawn-title">নিরাপদ জায়গা খালি নেই।</h2>
                <p>
                  নির্ধারিত কোনো স্থান এখন খালি পাওয়া যায়নি। আবার চেষ্টা করুন।
                </p>
                <button autoFocus className="primary" onClick={() => g.start()}>
                  আবার চেষ্টা করুন <Icon name="arrow" />
                </button>
                <button className="text-button" onClick={() => g.home()}>
                  প্রচ্ছদে ফিরুন
                </button>
              </section>
            </div>
          )}
          {s.online?.phase === "won" && !settings && <div className="modal-backdrop">
            <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="party-win">
              <span className="eyebrow">দলীয় অভিযান শেষ</span>
              <h2 id="party-win">দল মিলে রাস্তা খুলেছেন!</h2>
              <p>দলের পয়েন্ট {bn(s.online.teamScore)} • সেরা টানা আঘাত {bn(s.online.bestCombo)}</p>
              <ul className="online-players">{s.online.players.map((p) => <li key={p.id}><span>{p.name}</span><small>{bn(p.score)} পয়েন্ট</small></li>)}</ul>
              {s.online.notice && <p role="status">{s.online.notice}</p>}
              {s.online.host && <button className="primary" disabled={s.online.players.filter((p) => p.connected).length < 2} onClick={() => g.restartOnline()}>
                আবার দলীয় খেলা শুরু করুন
              </button>}
              <button className="text-button" onClick={() => g.home()}>প্রচ্ছদে ফিরুন</button>
            </section>
          </div>}
          {s.paused && !settings && s.online?.phase !== "won" && (
            <div className="modal-backdrop">
              <section
                className="dialog pause-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pause-title"
              >
                <span className="eyebrow">এক কাপ চায়ের বিরতি</span>
                <h2 id="pause-title">{s.online ? "দলের খেলা চলছে।" : "গলি অপেক্ষায় আছে।"}</h2>
                <p>
                  {s.online ? "আপনার নিয়ন্ত্রণ বিরতিতে আছে। অন্যরা খেলতে পারবেন।" : `পয়েন্ট ${bn(s.score)} • ছুড়েছেন ${bn(s.throws)} বার`}
                </p>
                <button autoFocus className="primary" onClick={() => g.pause()}>
                  {s.health === 0 ? "আবার শুরু করুন" : "খেলায় ফিরুন"}{" "}
                  <Icon name="arrow" />
                </button>
                <button className="secondary" onClick={openSettings}>
                  সেটিংস
                </button>
                <button className="text-button" onClick={() => g.home()}>
                  প্রচ্ছদে ফিরুন
                </button>
              </section>
            </div>
          )}
        </>
      )}
      {s?.report && g && <NewspaperView edition={s.report} onReplay={() => g.start()} onHome={() => g.home()} />}
      {settings && s && g && (
        <div className="modal-backdrop">
          <section
            className="dialog settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <button
              className="dialog-close icon-button"
              aria-label="সেটিংস বন্ধ করুন"
              onClick={closeSettings}
            >
              <Icon name="close" />
            </button>
            <span className="eyebrow">আপনার মতো করে</span>
            <h2 id="settings-title">খেলার সেটিংস</h2>
            <fieldset>
              <legend>দৃশ্যের মান</legend>
              <div className="segmented quality-options">
                {qualityOrder.map((id) => (
                  <button
                    key={id}
                    className={s.quality === id ? "active" : ""}
                    aria-pressed={s.quality === id}
                    onClick={() => g.setQuality(id)}
                  >
                    {qualitySettings[id].label}
                    <span>
                      {id === "desktop"
                        ? "বিস্তারিত ছায়া ও আলো"
                        : id === "desktop-medium"
                          ? "সুষম আলো, হালকা ছায়া"
                          : id === "mobile"
                            ? "ছোট পর্দায় সহজে চলুক"
                            : "কম শক্তির যন্ত্রে হালকা দৃশ্য"}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>গলির সময় ও আবহাওয়া</legend>
              <div className="segmented">
                {weatherOptions.map(({ id, label }) => (
                  <button key={id}
                    className={s.weather === id ? "active" : ""}
                    aria-pressed={s.weather === id}
                    onClick={() => g.setWeather(id)}
                  >{label}</button>
                ))}
              </div>
            </fieldset>
            <AudioSettings audio={g.audio} />
            {!s.online && <fieldset className="tutorial-settings">
              <legend>গলি চেনার পাঠ</legend>
              <p>
                শেখা আবার শুরু করলে আপনার জায়গা, পয়েন্ট ও সঙ্গে থাকা জিনিস রাখা
                হবে। গাড়িতে থাকলে আগে নিরাপদে নামুন।
              </p>
              {s.playing && s.health <= 0 && (
                <p role="status">
                  আগে নতুন করে খেলুন, তারপর শেখা আবার চালু করুন।
                </p>
              )}
              <button
                className="secondary"
                disabled={
                  s.playing && (s.health <= 0 || s.boardingState !== "onFoot")
                }
                onClick={() => {
                  if (!s.playing) g.start();
                  if (g.replayTutorial()) closeSettings();
                }}
              >
                শেখা আবার শুরু করুন <Icon name="arrow" size={18} />
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={s.dontShowTutorial}
                  onChange={(event) =>
                    g.setDontShowTutorial(event.target.checked)
                  }
                />
                আর দেখাবেন না
              </label>
            </fieldset>}
            <p className="language-note">
              ভাষা: বাংলা
              <br />
              <span>বাংলা লেখা, সংলাপ ও নির্দেশনাসহ।</span>
            </p>
            <button className="primary" autoFocus onClick={closeSettings}>
              ঠিক আছে <Icon name="arrow" />
            </button>
          </section>
        </div>
      )}
      {help && (
        <div className="modal-backdrop">
          <section
            className="dialog help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <button
              className="dialog-close icon-button"
              aria-label="নির্দেশনা বন্ধ করুন"
              onClick={() => setHelp(false)}
            >
              <Icon name="close" />
            </button>
            <span className="eyebrow">গলির নিয়মকানুন</span>
            <h2 id="help-title">চলুন, রাস্তা খুলি।</h2>
            <ol>
              <li>ডিম আর স্যান্ডেলের কাছে গিয়ে কুড়িয়ে নিন।</li>
              <li>সভায় থাকা কাল্পনিক নেতাকর্মীদের দিকে লক্ষ্য করুন।</li>
              <li>ছুড়ুন, পয়েন্ট পান। পথচারীকে লাগলে পয়েন্ট নেই।</li>
            </ol>
            <p>
              কম্পিউটারে <kbd>W A S D</kbd> বা তীরচিহ্নে চলুন, <kbd>Shift</kbd>{" "}
              ধরে দৌড়ান। <kbd>E</kbd> দিয়ে মিথস্ক্রিয়া, ক্লিক বা{" "}
              <kbd>Enter</kbd> দিয়ে ব্যবহার করুন। দৃশ্য টেনে ক্যামেরা ঘোরান। 1 /
              2 বা মাউসের চাকা দিয়ে জিনিস বদলান। <kbd>Tab</kbd> দিয়ে গাড়িতে উঠুন
              বা নামুন, <kbd>M</kbd> দিয়ে মানচিত্র খুলুন। <kbd>Space</kbd> দিয়েও
              ছুড়তে পারেন।
            </p>
            <p>
              মোবাইলে বাঁয়ের গোল নিয়ন্ত্রণে চলুন, ডানের বোতামে কুড়ান ও ছুড়ুন।
              কাছে ও দূরে বোতাম দিয়ে ক্যামেরার দূরত্ব বদলান।
            </p>
            <button
              className="primary"
              autoFocus
              onClick={() => setHelp(false)}
            >
              বুঝেছি <Icon name="arrow" />
            </button>
          </section>
        </div>
      )}
      {qaDiagnostics && s && g && (
        <details className="qa-panel">
          <summary>পরীক্ষা • {bn(s.fps)} ফ্রেম/সে.</summary>
          <button onClick={() => g.resetBenchmark()}>নতুন মাপ নিন</button>
          <button
            disabled={
              s.boardingState !== "seated" && !qaDiagnostics.qaExitBlocked
            }
            onClick={() => g.setQaExitBlocked(!g.diagnostics().qaExitBlocked)}
          >
            {qaDiagnostics.qaExitBlocked
              ? "পরীক্ষার রেলিং সরান"
              : "নামার পথে পরীক্ষার রেলিং রাখুন"}
          </button>
          <output
            data-testid="runtime-evidence"
            data-evidence={JSON.stringify(qaDiagnostics)}
          >
            <p>গড় {bn(qaDiagnostics.fpsAverage)} ফ্রেম/সে.</p>
            <p>
              স্থান {s.x.toFixed(2)}, {s.z.toFixed(2)}
            </p>
            <p>
              কঙ্কাল {bn(qaDiagnostics.skeletons)} • অ্যানিমেশন{" "}
              {bn(qaDiagnostics.animationGroups)}
            </p>
            <p>{content.shapingSample}</p>
          </output>
        </details>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
