# Milestone B — functional scope verified

Updated **2026-11-04, Asia/Dhaka**. **B's functional scope is VERIFIED; C is READY to start.** The final patrol-safe spawn was observed through complete simulation cycles on desktop and mobile viewports, and genuine focused FPS was measured. This is a scoped functional pass, **not a performance pass**: current desktop observation is29.7343FPS against the global60FPS target, and Android hardware remains unqualified. C gameplay has not yet been implemented.

## Checked builds and limits

- `index-CmxIvYoq.js`: actual desktop1280×720 and mobile390×844 ten-step tutorial chains, preference/reload, controls and physical-item evidence.
- `index-DYjhqTCn.js`: targeted real rendered camera/counter/opacity, boarding, civilian-penalty and three-angle regression. Both camera-fix regression and earlier tutorial evidence remain valid within their observed scope.
- Spawn-exclusion build `index-Bol4r5V1.js`, CSS `index-hKJLPJH0.css`: `verify-final.txt` records **typecheck, lint,60/60 tests and game/Admin production builds passing**. Its then-open rendered idle-cycle/FPS observations were completed on the diagnostic-only resumption build below.
- Accepted functional resumption build `index-CSdJS6tH.js`: the only subsequent code addition is the read-only `simulationTime` diagnostic. `verification-resume-checks.txt` again passes types, lint,60/60 tests and both production builds. Actual loaded entry is recorded in both resumed viewport datasets. Its desktop/mobile idle-cycle and focused FPS checks below close the two functional acceptance observations left open by Bol4r5V1; no performance-target pass is inferred.

The existing single Dhaka street, original assets and A audio/data were extended. B supplies Bengali tutorial, trusted randomized starts, map/input improvements and one parked-CNG exercise. Driving, connected missions, full Admin spawn editing and multiplayer remain deferred. The original six rig motions are preserved, with original EnterVehicle/Seated/ExitVehicle clips on the same skeleton. Artwork remains stylized; final semi-realistic art approval and Android hardware qualification are open.

## Covered evidence

| Area | Actual evidence | Limit |
| --- | --- | --- |
| Ten tutorial steps | `accepted-mobile-chain.json` records step0→10/completed at390×844 using buttons/joystick/swipe. `accepted-desktop-chain.json` and exact `verified-desktop-*` records in `final-mobile-tutorial.json` cover1280×720 keyboard/mouse actions. Tutorial completion comes from actual actions, not a Next button. | Complete chains belong to CmxIvYoq, before later targeted camera and spawn fixes. |
| Physics and input | Mobile egg6→5, one throw/hit, score5 and target75. Desktop Enter and left-click/wheel interactions observed; sandal score8. Camera drag did not throw. Desktop input remained desktop while using mobile graphics. | No later mission completion claim. |
| Boarding and blocked exit | Actual seat root[4,.3400000036,2.6700000763], Seated clip; visibly enabled Bengali barriers keep exit attempt seated/step8 at exactly the same position. Removing barriers permits ExitVehicle then onFoot at[2.6199998856,0,1.9199999571]/step9. | QA fixture is explicit and disabled in ordinary gameplay. No driving. |
| Replay/Skip/preferences | Replay and Skip preserve score5, eggs5 and exact live position. `verified-preferences-reloaded` shows don't-show=true, tutorialOpen=false and master muted=true after reload/new start. Settings are subsequently restored. | New-game score reset is expected; replay is what preserves the live run. |
| Mobile map | Overflow was found and fixed. `mobile-map-fixed.json`: width366.2744px, x11.9927 within390px viewport, clientWidth=scrollWidth365. Bengali labels and mission text appear in screenshots. | Scroll is intentional for the map dialog. |
| Trusted spawn content | Runtime uses revision1/source factory/origin server-factory. Tests reject client approval flags, unknown points/y/world, full-footprint obstacles/water/occupancy, invalid registry and all-blocked cases; service tests preserve isolated audio publication/restart data. | Factory provenance is not an observed authenticated Admin approval; full editor belongs to G. |
| Random start history | `actual-random-spawns.json` records5 real starts/4 unique: east-middle, west-middle, east-south, west-south. | These precede the final whole-patrol exclusion and do not prove the latest eligible set. |
| Final whole-patrol safety | Final tests sample721 points over each full19.635s patrol cycle, multiple initial times/phases. Six registry entries yield **3 eligible points: west-south, east-south, west-middle**. Final CSdJS6tH desktop/mobile observations cover26.956/30.9792 simulation seconds with unchanged player and moving NPCs. | Actual final idle-cycle pass for west-south, automated whole-cycle coverage for all3. Do not claim all6 eligible or rendered cycles at all3. |
| Camera/opacity | On DYjhqTCn, a very tight shop view resolves~.049884m and hides the player body (opacity0); opening the view restores opacity~.9808 at4.736m, then~1 at5.002m. Normal vehicle view resolves3.818m with opacity~1. Counter blocks walking without phantom player steps. | Targeted actual camera regression; later source changes only affect spawn selection and diagnostics. |
| Pause/civilian rules | Actual pause clears keys/touch/run/pointer, keeps position and suspends audio. Civilian hit leaves score0, costs health100→92 and records civilianHits1. Automated preserved rules also pass. | Resume's immediate snapshot can still show suspended audio; later running audio is separately observed. |
| A Admin/audio preservation | Real Admin publication reaches running game as revision8/music-chase/volume.11; rollback reaches revision9/music-exploration/.55. Draft10 restores baseline7 content with new audit/history retained. `audio-qa-restored.json` confirms primary unchanged and QA published/draft configuration restored. | QA bytes/revisions intentionally change with audit history; do not claim QA file byte identity. |

## Performance and images already observed

CmxIvYoq mobile390×844/profile mobile/AOoff:600 visible frames/9999.5ms=60.0030FPS (`verified-mobile-fps-600-frame-sample`). DYjhqTCn desktop1280×720/profile desktop/HDR+AO:600/10000.6ms=59.9964FPS (`final-camera-build-desktop-fps`). Seated angle:600/10116.4ms=59.3096FPS. These are brief local-PC foreground samples, not stable whole-game or phone qualification. Subsequent background~1FPS observations are retained and excluded from foreground performance claims.

Three actual DYjhqTCn gameplay angles are `final-desktop-tea-shop.png`, `final-desktop-cng-seated-opaque.png` and `final-desktop-evening-rickshaw.png`. Mobile seated/blocked/exit/completed and Bengali desktop/mobile screenshots are also retained. No screenshot is relabeled as a new Bol4r5V1 observation.

Both older `bengali-rendering-*.json` files record `badGlyphs:true`; the whole-block regex was a false positive. Fresh `bengali-script-audit-final.json` uses the actual390×844 DOM and Unicode script properties: no Devanagari-script letters or U+FFFD; bundled Noto Sans Bengali. The only character in the broader Devanagari block is `।`U+0964, shared Common-script danda punctuation valid in Bengali. The original flags remain unchanged. `bengali-text-audit-corrected.json` independently checks the smaller previously saved shaping samples; it is not a new browser observation. Visual shaping and no-overflow observations remain separate evidence.

`production-probe-final.json` confirms both4300/4301 deliver Bol4r5V1, `game-BjTwHhyS.js`, the current CSS and952896-byte character with matching hashes. Primary audio hash is unchanged (`165595c81dc7dd8eb2edea9bea08468fe8f8aad09bc970bc2b08ca28880ce23b`); QA published9/draft10 preserve restored baseline configuration and audit/history. This is read-only delivery/data evidence, not a final gameplay/FPS pass.

## Resolved final functional gate — actual focused Chrome

The earlier foreground blocker was resolved through the user's explicit authorization to restore/focus the Chrome QA window. `windowFocused:true` from actual window observations accompanies the FPS samples; `pageVisible:true` alone had been insufficient for the background IAB. No power preferences were changed. Only the separate QA run was used.

| Final observation on CSdJS6tH | Actual values |
| --- | --- |
| Desktop idle cycle |1280×720, Desktop/HDR/AOon; simulation169.7261→196.6821=26.956s, exceeding the19.634954s full patrol period. Player stays exactly[-6.3,.2,-16], controls empty, four walking NPCs visibly move; minimum saved NPC centre distance7.5420m, greater than the1.0m clearance requirement. |
| Mobile idle cycle |390×844, Mobile/HDR/AOoff; simulation471.1926→502.1718=30.9792s, same unchanged player/cleared controls, four moving civilians, minimum saved NPC distance7.6940m. |
| Focused desktop FPS |7 focused records, final600frames/20178.7ms=29.7343FPS; full-window range29.5331–29.9150. Final frame window fits inside31.494s observed foreground span. **Global60FPS target unmet.** |
| Focused mobile-viewport FPS |7 focused records, final600/19999.6ms=30.0006FPS. First record is10-frame warmup; only the last3 have full600-frame windows. Final window fits inside31.173s foreground span. **This is PC viewport emulation, not an Android30FPS qualification.** |

Raw records: `resumed/desktop-idle-cycle-timed.json`, `desktop-foreground.json`, `mobile-foreground.json`; independent assertions: `desktop-independent-audit.json`, `mobile-independent-audit.json`. Clearance is recomputed at the saved observations; continuous safety is additionally covered by the conservative full patrol envelopes and automated721-sample tests across all3 eligible starts.

`resumed/hardware.json` records Intel Core5 210H, Intel Graphics/60Hz and9% battery while discharging. These are test-environment facts, not proof of the30FPS cause. The global graphics target is60FPS on a reasonable desktop and stable30FPS on Android; B's own functional criteria and shared verification require measurement, without stating a numeric B-specific threshold. The functional gate can pass while this broader performance requirement stays explicitly unmet.

- [x] Observe a complete rendered final patrol cycle and unchanged player on both measured viewports.
- [x] Measure genuine focused desktop/mobile viewport FPS and record the unmet desktop target honestly.
- [x] Finalize live production/QA asset byte/hash evidence against Bol4r5V1 and record primary data preservation: `production-probe-final.json`. `production-probe.json` remains historical CmxIvYoq evidence.
- [x] Resolve the Bengali flag with Unicode script-property checks of the actual DOM, retaining the earlier broad-block false positive.
- [x] Close the scoped B functional matrix from actual observations and append the build log before C. The latest instrumentation-build handoff hash probe/source backup are recorded separately when produced; no fabricated artifact is cited here.

## Explicit remaining project requirements

Investigate the~30FPS focused desktop result and improve or qualify performance toward the60FPS target as the world expands. Diagnose render cost versus browser/display/power conditions before attributing cause. Real Android stable30FPS and final semi-realistic visual approval remain open. Earlier background~1FPS and older higher foreground samples remain historical; neither replaces these current measurements. **No claim that the entire A–H game or its performance requirements are complete.**
