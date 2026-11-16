# Milestone A acceptance — 2026-11-03

**A's implemented audio scope passes its acceptance gate. Proceed to B.** The earlier browser/service interruptions were recovered; their failed evidence remains in the review/build log. No acceptance of later gameplay, final artwork or real-phone performance is implied.

## Preserved project and delivered scope

The existing standalone Babylon/Havok Bengali street, skinned GLB, actors, physical egg/sandal actions, desktop/mobile interface and local data were extended. No commerce app, external database or user content was reset. Source archive: `assets/source/archive/pre-expansion-20261102-230305.zip`. Git is not initialized in this workspace.

A delivers nine persisted audio buses, gesture unlock and category auditions, calibrated animation-contact footsteps on eight mapped surfaces, spatial attenuation/wall occlusion, bounded priority playback, randomized Dhaka ambience, five music contexts/fades/playlists and a real Bengali audio Admin/service with authorized upload, preview, draft, publish, rollback and draft recovery.

65 original Foley/music files and 23 separately licensed fictional Bengali speech clips are local. Editable sources, exact lines/model hashes and notices are documented in `ASSETS.md`. No alternate model, paid TTS API, real politician recording or commercial song was introduced. Audio entries for future jumping/driving/mission/evacuation/newspaper actions are available; their gameplay hooks remain the responsibility of later milestones.

## Final checks and production identity

- `npm run verify`: **typecheck, lint, 28/28 tests, game build and Admin build passed**. Full output: `harness/evidence/expansion/milestone-a-checks.txt`.
- The last decorative crosshair `pointer-events` CSS correction received a fresh successful production build: `milestone-a-final-build.txt`. It changes gesture pass-through, not game rules or audio.
- Actually loaded and inspected final game entry: `/assets/index-SdHMXPBR.js`; CSS: `/assets/index-DHztAZe9.css`. DOM/diagnostics evidence: `accepted-build-loaded.json`.
- Local production 4300 and isolated QA4301 health/content/files pass; public audio revisions remain 1 and 6 respectively. Game/Admin entry and CSS bytes match disk. `server-production-probe-final.json`. Earlier failed/stopped-service probes are preserved, not relabelled passes.
- Owned servers were restarted as hidden standalone Node processes, keeping `var/game` and `var/qa-audio-20261103`. Start record: `service-processes.json`. Primary Admin password setup remains owned by the user; synthetic test account/content is confined to QA.

## Observed runtime acceptance

| Requirement | Actual observation/evidence in `harness/evidence/expansion` |
| --- | --- |
| Gesture unlock | `before-gesture.json`: not-started/unlocked=false/RMS0. `after-gesture.json`: running and nonzero signal after click. |
| Independent persisted buses | All nine volumes changed independently, four category mutes changed, reload preserved them exactly. Original preferences were restored exactly. `nine-channel-changed.json`, `nine-channel-reloaded.json`, `nine-channel-restored.json`. |
| Master mute | `master-muted.json`: muted=true/outputRms0; later unmuted samples have nonzero output. Signal is not a human hearing claim. |
| Actual Walk/Run contacts | `walk-desktop.json`, `run-contact.json`, `run-final-build.json`: actual displacement and calibrated alternating contacts, rather than an interval timer. |
| Idle/blocked/resume | `idle-footsteps-final.json`: Idle and unchanged position/no player contacts while the world remains active. `blocked-footsteps-final.json`: additional blocked input held exactly the same position and added no player contacts. `pause-resume-final.json` plus later running snapshots: paused input cannot move player, context suspends and resumes without stale player contacts. Immediate post-click suspended snapshot was asynchronous, not a failed-resume claim. |
| Eight surfaces | Asphalt/Run; concrete/pavement; shop floor; water; brick; dirt; metal; mud contacts observed in their mapped areas. See `shop-floor-footsteps-final.json`, `pavement-footsteps-final.json`, `water-footsteps-final.json`, `brick-contact-verified.json`, `dirt-first-contact-final.json`, `metal-contact-verified.json`, `mud-contact-verified.json`. The earlier `water-contacts.json` lacks retained player events and remains an inconclusive attempt. |
| First new-surface playback | All 24 small footstep files now warm during bootstrap. Slow-download regression proves first brick/mud contacts use decoded cache instead of being discarded; actual dirt/metal/brick/mud contacts recorded after this change. |
| Pickup/projectiles | Touch joystick moved the player; touch pickup collected eggs and sandals. Egg consumed one, scored5 and left target75; sandal scored another8, total13 and target35. `mobile-joystick-final.json`, `mobile-pickup-final.json`, `mobile-sandal-pickup-final.json`, `mobile-voice-hit-final.json`, `mobile-sandal-hit-final.json`. |
| Speech clarity | User initially reported unclear in-world speech, found dry sample clear, then reported revised in-world impact speech clear. `voice-user-review.json`. Actual hit diagnostics show one voiced reaction per impact, alongside effects. |
| Real auditions/subtitles | Category audition uses enabled published speech/effect, not a menu-beep fallback. Actual voice preview produced output; 5 targeted graph regressions cover cue/gain/priority/decode/mouth-height behavior. Spoken subtitles now follow actual playback rather than being overwritten by generic hit text. |
| Real publishing | Saved draft did not reach game revision1. Publish changed running exploration playback to music-chase/volume0.11 at revision4. Rollback returned original asset/volume0.55 at revision6. Draft5 was recoverable separately. `draft-unpublished.json`, `admin-published-in-game.json`, `admin-rollback.jpg`, `rollback-in-game.json`. |
| Day/evening | Both lighting states rendered; evening insect events and day ambience observed. Music switched exploration↔mission near the existing leader. New mission gameplay is not claimed. |
| Camera collision and gesture | At the tea-shop grazing position the old camera was behind a wall. Authored wall/column bounds plus camera clearance now retract it to about1.94m, retaining player visibility; walking/Havok colliders unchanged. `camera-occlusion-before-fix.png`, `camera-occlusion-fixed.json/.png`, two NullEngine ray regressions. Centre crosshair no longer intercepts gestures: actual drag yaw0→0.7 in `camera-drag-final.json`. |
| Bengali and mobile layout | Measured390×844, bn-BD, no horizontal page/dialog overflow, no replacement character/Devanagari letters. Noto Bengali shaping sample visually inspected on desktop/mobile, including স্বাধীনতা, প্রতিশ্রুতি, ক্ষুদ্র, শ্রদ্ধা, দৃষ্টি, কর্মী, র‍্যাফেল, কৌতুক. `mobile-layout-final.json`, `mobile-settings-final.png`, `bengali-shaping-desktop-final.png`, `bengali-shaping-mobile-final.png`. |

## Measured performance and screenshots

Final **1280×720 Desktop**: 59.9976FPS, 600 visible frames over10000.4ms, HDR/AO enabled. `desktop-performance-last-build.json`.

Final **390×844 Mobile profile on this PC**: 60.00FPS, 600 frames over10000ms, AO disabled. `mobile-performance-last-build.json`. A separate active mobile interaction sample was56.99FPS; earlier heavy/background samples were lower and remain recorded. These brief local-PC measurements do not establish stable Android hardware performance or every future mission's performance.

Three final rendered gameplay angles: `final-day-street.png`, `final-day-cng.png`, `final-evening-rickshaw.png`. Tea-counter visibility proof is additional. Actual settings/Admin/Bengali/mobile screenshots are preserved alongside them. No screenshot is a mockup.

## Limits carried forward

- Existing artwork remains stylized; final semi-realistic art acceptance and real-device qualification stay open.
- Human feedback covers tested speech, not blanket approval of every speaker/dialect or all future mixes. The Piper source model includes Bangladesh and Indian Bengali; no per-speaker accent guarantee is claimed.
- The current slice still has one practice location. Tutorial, full mission states/AI/evacuation, more items, driving, multiplayer, other Admin modules and the newspaper are unimplemented until B–H.
- `harness/build/milestone-b.md` is preparation only. Begin the smallest complete B, preserve the accepted slice and require B's own runtime evidence.
