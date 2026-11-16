# Milestone A review — 2026-11-03

Historical intermediate review. **Superseded by the passed [A acceptance](milestone-a-acceptance.md).** Failures and incomplete attempts below are preserved as history; current status is A passed, B next. The A–H expansion remains authorized.

Latest resumption: **25/25 tests**, types/lint and both production builds pass after the voice clarity fixes below. A new selected IAB preview successfully rendered at **1280×720**; desktop settings/evening/another camera angle are now captured. Mobile and final post-fix listening/gameplay remain open after the next preview creation timed out after 300 seconds. Earlier blocker details below are historical observations, not a claim that no desktop preview ever worked.

## Preserved boundary and architecture

The workspace is the standalone Bengali game at `D:/neta-udche -3d`; Git reports no repository. The working Babylon/Havok street, original skinned character, ten actors, camera, pickups, physical throws, Bengali interface and local assets are retained. No commerce project, database or user data was connected, reset or deleted. Pre-expansion source is archived at `assets/source/archive/pre-expansion-20261102-230305.zip`.

TypeScript workspaces remain `apps/game`, `apps/admin`, `apps/server`, `packages/shared`. A adds a Web Audio graph, native Node local content service and real Bengali audio/music editing. It adds no external runtime audio service. Other Admin modules, the tutorial, city, driving, multiplayer and newspaper are not implemented by this milestone.

## Implemented

- Nine independent persisted volume/mute buses; trusted-gesture unlock, master limiter, bounded voices, category auditions and pause-safe previews.
- Eight street surfaces with three original footstep variations each. Walk/Run contacts are calibrated from the original GLB sole geometry and actual animation frames; movement and animation weight gate contact emission.
- HRTF distance attenuation and practical wall low-pass occlusion, with consistent Babylon/Web Audio coordinate conversion. Traffic/CNG layers follow published cue enable/file/volume changes. Other street layers use randomized intervals and distances.
- Five original music contexts, loop/order/random/volume, natural fade-out, crossfades and finite non-loop playlists.
- 65 original Foley/music files plus 23 separately licensed fictional Bengali speech clips with subtitles. See `ASSETS.md`, retained model card/CC BY-SA/CMU notices and editable authoring scripts. Signal inspection does not establish voice intelligibility or a convincing Dhaka dialect.
- Bengali Admin upload/preview, sound and voice metadata, music contexts, draft/save/publish/history/rollback and recovery of the draft replaced during rollback. Draft uploads remain private; published revisions are monotonic. Existing edited entries survive bundled imports.
- WAV/MP3/OGG bounds and framing checks, executable-prefix rejection, local authentication/session/origin checks, range streaming, atomic durable local JSON. Tests use isolated temporary data.

Later gameplay has registered audio assets; that does not prove jumping, driving, missions, evacuation or newspaper gameplay exists. Spawn/idle/detected and later AI voice hooks still belong to their actor/gameplay integration, rather than being claimed as demonstrated in A.

## Changed file groups

- Game: `apps/game/src/audio.ts`, `footsteps.ts`, `AudioSettings.tsx`, `game.ts`, `main.tsx`, `style.css`, `world.ts`, and the Vite API proxy configuration.
- Shared rules/content: `packages/shared/src/audio.ts`, `street-surfaces.ts` and their shared exports.
- Administration/service: `apps/admin` React entry/styles/Vite/workspace files; `apps/server/src/content.ts`, `http.ts`, `main.ts` and workspace configuration.
- Editable asset authoring: `assets/source/generate-audio.mjs`, `analyze-footsteps.mjs`, `generate-voices.mjs`, `synthesize-voices.py`, generated provenance; bundled audio, speech, contact calibration and license files under `public/assets`.
- Verification: `tests/audio.test.ts`, `audio-api.test.ts`, `street-audio.test.ts`, preserved regression tests and `harness/evidence/expansion`.
- Root workspace scripts/lock/configuration, `.gitignore`, `ASSETS.md`, `README.md`, goals/plans and harness scope/build documents. Git diff is unavailable because the workspace is not a Git repository.

## Actual checks

Final `npm run verify` passed **typecheck, lint, 25/25 tests and game/Admin production builds** after the last source edit. Full output: `harness/evidence/expansion/milestone-a-checks.txt`. Vite retains a large 3D chunk advisory; build succeeded.

Tests cover the preserved GLB/physics/civilian rewards/collisions/Bengali/FPS/material budgets, settings recovery, animation phase crossings, eight surfaces/occlusion, PCM signal/budget, authenticated upload/publish/rollback/restart/draft recovery, stale editors, MP3 framing and seven reproducible Web Audio lifecycle/publication/preview regressions. Mock graphs are not browser or human listening tests.

Production runs locally on 4300; an isolated test server runs on 4301 with `var/qa-audio-20261103`. The primary Admin remains first-use/unconfigured; the agent did not choose the user's password. All browser uploads and music edits below were made only in the separate test environment.

## Observed browser flows

| Flow | Actual evidence |
| --- | --- |
| No autoplay before gesture | `before-gesture.json`: not-started, unlocked=false, RMS=0. |
| Output after click | `after-gesture.json`: running, published revision 1, actual output RMS >0, traffic/CNG and exploration music active. This proves output signal, not auditory quality. |
| Settings persistence | Music changed through its slider to 0.23; `reloaded-settings.json` shows 0.23 after reload, before a new gesture. |
| Master mute | `master-muted.json`: master muted=true, actual output RMS=0. After unmute, later samples have nonzero output. |
| Animation-timed Walk | `walk-desktop.json`: actual player movement from z=-9 to -6.4953; Walk contacts near frames 15/45 of its 60-frame cycle. Filename is historical to the attempted desktop test; **actual viewport was 597×646**, not 1280×720. |
| Animation-timed Run | `run-contact.json`: player at z=0.3249; Run contacts near frames 10/30 of its 40-frame cycle, with actual Run animation observed. |
| Pickup and physical egg impact | `egg-hit.json`: six eggs collected, one consumed, score=5, hits=1, target resolve/health=75; Pickup/Throw motions and pickup/throw/egg/hit/firstHit audio events observed. |
| Admin upload and preview | Original licensed test speech WAV uploaded via the form; successful draft message observed. Music preview's HTML audio reported paused=false and `/assets/audio/music-chase.wav`. Human hearing was not assessed. |
| Draft isolation | `draft-unpublished.json`: game remains revision 1, exploration asset and configured volume 0.55 after Admin saved a changed draft. |
| Publication in running game | `admin-published-in-game.json`: revision 4, actual exploration playback uses `music-chase` and configured volume 0.11. The game was not recreated; its published-catalog refresh control was used. |
| Rollback and draft recovery | `admin-rollback.jpg`: public revision 6, saved draft revision 5. Restoring that draft showed “অপ্রকাশিত খসড়ার বাংলা সুর” without publishing it. `rollback-in-game.json`: game revision 6, original exploration asset and 0.55 volume. |

Two current gameplay angles are saved as `gameplay-front.png` and `gameplay-cng.png`. `admin-rollback.jpg` is a rendered Admin screenshot. The `.jpg` was captured through the browser screenshot API; it is evidence of that actual page, not a mockup.

Additional rendered captures, taken on selected QA preview 5 before the voice-fix rebuild, are `desktop-settings-1280.png`, `desktop-evening-1280.png` and `desktop-rickshaw-1280.png`. These close the earlier absence of three observed scene angles, but they are not a post-voice-fix interaction pass.

## Voice feedback and corrective work

The user reported that in-world Bengali speech was unclear or unnatural. The user then listened directly to `voice-spawn-0.wav` without game mixing/occlusion and reported that this dry sample was clear. This does not approve every speaker or the revised in-world mix.

Concrete runtime defects were found and fixed:

- Voice/crowd/combat category audition had fallen through to the menu beep. Audition now refreshes published content without booting ambience and selects an enabled asset from the actual requested category, using its configured gain. Missing content reports Bengali instead of silently substituting a beep.
- A hit emitted item speech and first/repeated-hit speech, sometimes terminal speech, in the same frame. It now retains combat effects and selects one highest-priority voiced reaction per impact.
- Speech replacement used to stop the old clip before the new buffer was decoded. Decoding now completes first; equal-priority speech preserves the current sentence, while higher priority can still interrupt.
- Impact dialogue now emits from the authored mouth at local y=1.606 m, transformed by the actor. Serving-counter conversation, stage slogans and microphone have explicit plausible emitter heights. Practical wall occlusion remains.
- Generic hit subtitle writes were removed: the score/civilian-warning toast remains, while actual voice playback alone sets the spoken subtitle. A suppressed new reaction therefore cannot replace a still-playing sentence's subtitle.

Five added regression tests cover real published category auditions, missing-category Bengali errors, decode/priority behavior, single prioritized impact audio contracts, and ambient speech heights. The impact unit test calls the real audio API; it does not directly exercise `DhakaGame.hit()`. Final actual-hit and listening regression is still required. No new voice model/API was installed. Model/license research and exclusions are documented in `harness/context/005-voice-quality-review.md`.

## Performance and rendered limits

At the **observed 597×646 viewport**, the desktop graphics profile reported 600 visible frames over 9999.5 ms, approximately **60.00 FPS** (`walk-desktop.json`); HDR and AO were active. Other snapshots briefly report 58–61 FPS. These are short local-PC observations, not a stable 1280×720 benchmark or Android performance qualification.

The Bengali HUD/subtitles and menu controls were rendered and read at this size. Dedicated current-build 1280×720 desktop and 390×844 mobile shaping/layout/gameplay/FPS checks remain **unverified**. Historical screenshots/FPS from other builds are not reused as a current pass. Latest label-only changes and Bengali connection-error fallback built successfully, but were not re-inspected after the browser failure.

Subsequent selected-preview recovery measured DOM width=1280 and height=720. Desktop settings and all nine audio controls were inspected; evening lighting and Bengali HUD/signs rendered. `desktop-evening-1280.json` records **40.946 FPS**, 600 frames, desktop profile/HDR/AO. This is the actual larger-viewport result, not the earlier ~60FPS smaller-viewport sample. Night insect events were recorded. Desktop walking moved x from0 to-3.13965 and then z to-5.4216. `water-contacts.json` records the resulting location, but its bounded recent-event window no longer retained player contact events; it does **not** prove a passed water-footstep synchronization check. Dedicated 390×844 mobile and final voice-fix rebuild inspection remain unverified.

## Exact browser blocker

1. The IAB viewport capability accepted 1280×720 requests, but DOM dimensions and screenshots remained 597×646. Reacquiring the capability and hiding the panel did not change the measured dimensions.
2. A separate Chrome QA tab was created. Browser connection subsequently returned `Debugger unattached`; the attempted browser call timed out and reset the tool session.
3. Native Chrome inspection first reported its window minimized. After restoring/activation, native `get_window_state` and `list_windows` timed out.
4. IAB subsequently timed out on `Input.dispatchMouseEvent` while opening Settings. Its resulting interaction state is unknown, so no further gameplay result was inferred.

A later read did show Settings open, but took about 34 seconds and reported 12 FPS. The subsequent evening-preset click failed before command dispatch. The user explicitly restarted the browser connection; Chrome inventory/session naming then worked, but binding the existing game still returned `Debugger unattached`. Creating/navigating a fresh Chrome test tab timed out and reset the tool session again. This recovery attempt did not close the rendered acceptance gate.

This prevents the required desktop/mobile rendered gate and third current-build gameplay angle. No automated test result substitutes for them. The final production asset/API probes are recorded separately from browser checks in `server-production-probe.json`.

Recovery then succeeded by creating a new selected IAB preview and applying its viewport there; existing-background game tabs had remained at their earlier dimensions. After the user sent a fresh “try again”, that temporary QA tab was no longer available (`Tab not found`). Creating a replacement IAB preview then timed out at the tool boundary after **300 seconds**. Final mobile/post-fix runtime verification remains blocked by this latest failure. Avoid resetting the existing played primary tab to compensate.

## Remaining acceptance work

- Restore browser control, retain the QA tab with `markHandoff()` during ongoing work, and inspect the last voice-fix build at measured 1280×720 and 390×844 viewports. Recheck all nine controls, scrolling, Bengali shaping and errors. The older IAB temporary viewport reset succeeded; the later selected 1280×720 QA tab disappeared before its override could be explicitly reset, so reset any surviving override after recovery.
- Complete idle/blocked/resume footstep and additional-surface runtime checks, category mute/volume auditions, daytime/evening ambience and music-context transitions. The unit/graph coverage already passes but does not close these browser observations.
- Recheck camera collision, sandal pickup/throw and mobile joystick/action regression; preserve the three observed angles and capture final-build screenshots/FPS samples.
- Perform human auditory review of Bengali speech intelligibility, voice balance, spatial orientation and music loops. Do not turn output RMS into a hearing claim.
- Only then close A and begin B. B has read-only preparation, no implementation. C–H and two-/six-player multiplayer remain unimplemented and untested.

Do not rebuild from scratch on resume. Use the existing production/test servers and preserved test draft/history. No source or dependency installation blocker was found.
