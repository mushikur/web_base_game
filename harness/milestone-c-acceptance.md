# Milestone C acceptance — active, not accepted

Updated **2026-11-04, Asia/Dhaka**. This file records implementation and verification separately. **C is active and not accepted. Actual desktop and mobile hub completions, connected desktop travel to the committee entrance, and mobile map/input observations are recorded below. All-five desktop/mobile coverage, recovery/regression checks, final-source verification and final FPS/resource/visual acceptance remain pending. D–H must wait for C's applicable gates.**

## Preserved boundary

- Functional B is frozen under `harness/accepted-builds/milestone-b-20261104/` with its manifest and source archive `assets/source/archive/milestone-b-functional-20261104.zip`.
- The primary game on port4300 is intended to remain on that frozen B tree; QA4301 is the C preview. The B/C isolation implementation and earlier live probe are recorded in `harness/build-log.md`; a fresh C production probe is still required after the final C build.
- Primary and QA audio data, publication history, tutorial preferences and the B spawn registry must remain preserved. No data reset is part of C. C's optional local solo checkpoint uses the separate key `neta-solo-missions-c1`.
- Existing B frame-rate evidence describes B and its observed hardware/window conditions. It is **not** a current C measurement. Real Android qualification remains unobserved.

## Implementation present in source

| Requirement | Present implementation | Acceptance still required |
| --- | --- | --- |
| Five connected fictional Dhaka areas | `world-layout.ts`, `sectorBlueprints.ts` and `sectors.ts` define the protected hub plus কমিটি গলি, মাইক চত্বর, পোস্টার পট্টি and ক্ষমতা ভবন, authored connectors, shops, props, parking and actors. | Walk actual roads to all five; inspect distinct architecture, Bengali signs, lighting, silhouettes, seams and collision. Data labels alone do not pass. |
| Streaming and resource ownership | `SectorCache` provides distance/hysteresis activation, pins, two-encounter active budget, bounded sleeping cache and owned cleanup. `SectorManager` batches local geometry and owns scene-local material/texture leases. | Observe active resources while crossing and leaving sectors, unload/reload and verify counts do not grow. Audit Director behavior against sector activation, not just geometry visibility. |
| Mission chain | Pure reducer includes all ten phases, guarded selection/entry, observed physical impacts, flee request/arrival, evacuation loading/exit, failure cleanup and explicit retry. Completion cannot come from a marker click or elapsed timer. | Actually complete all five encounters and ambulance departures. Observe bounds failure, player failure and retry while retaining other completions. |
| Navigation and surfaces | Radius-aware routes reject buildings and unbuilt land. Authored long-road nodes plus bounded blocker corners permit real detours. Hub heights/surfaces are retained except C's explicit speech-platform/ramp extension. | Observe route following, rerouting after displacement, platform access and near-wall/camera interaction on desktop and mobile. |
| Moving/reactive actors | `MissionActorAI` implements speech, notice/cover/flee, item reactions, warning/follow/dodge, phone/shop/crossing/siren/return and completion dispersal. Original compatible skeletal animation bank and accessories are wired. | Observe actual displacement, turns, cover and pursuit; verify limbs, blends, phones/banners, footstep contacts, tutorial safety and readable subtitles. An animation-name diagnostic is insufficient. |
| Non-graphic evacuation | Original ambulance model, two rigged paramedics, body/door anchors, assistance/loading controllers, rotated body clearance and blocked-route waiting are wired. | Observe the complete approach → exit → assist → load → re-enter → close → departure sequence; intentionally block a door and route, then clear it. No teleport or instantly hidden actor may substitute for loading. |
| Bengali map/HUD | Five-area map, routes, mission state, tea, actual available pickups/vehicles, ambulance, safe starts and player heading are represented. Solo friends are truthfully empty. | Verify visible state, selection/next/retry guidance, Bengali shaping/font loading, small-screen scrolling and no overlap. No false all-complete state is allowed when selection is absent. |
| Save/new run/retry | Versioned checkpoint validates/reconstructs mission facts; new run and retry have separate paths. Resume retains completed areas and currently restarts an unfinished encounter at selection. | UI must explicitly communicate the unfinished-encounter restart rather than promise exact in-progress continuation. Verify completed facts, inventory/run semantics, preferences and dynamic resource cleanup through real controls. |

## Actual focused checks observed

The domain/navigation workstream ran the following against its saved source, after formatting:

`node --experimental-strip-types --test tests/c-missions.test.ts tests/c-navigation.test.ts`

**16/16 tests passed**: eight mission-domain tests and eight navigation tests. These are actual automated observations, not rendered gameplay evidence.

- Mission tests cover discovery, no-route rejection, real entrance/sector/tutorial guards, replacing selection, single-active encounter, civilian-safe/no-duplicate scoring, observed fleeing, zero-resolve evacuation, required loading and actual exit position, completion once, bounds warning/return/grace, player failure, cleanup/retry, all-five completion and checkpoint repair/replay rejection.
- Navigation tests route from protected B starts to five entrances, distinguish the pedestrian gap from the wide hub ambulance lane, reject unbuilt shortcuts/closed roads, find a real detour, preserve sampled hub surfaces and validate map/Bengali data.
- The actual imported `allSectorObstacles` blueprint is used for outer entrances, leaders/workers, shop fronts, pickups, cover, escape and CNG boarding-side routes. Ambulance approaches/exits additionally sample the complete9-point1.1×2.53m half-extents every0.2m. This sampling supplements the separate exact rotated-body tests; it is not an OBB proof or a runtime observation.
- A real metadata conflict was fixed: the office road's centerline crosses the office tea counter. Intermediate nodes at x66/z53 and z72 plus critical obstruction corners allow a checked detour; the shop was not silently removed.
- A real full-body entrance conflict was fixed: the outer ambulance entrance/exit changed to center.z−15 so its2.53m half-length stays on authored ground, including poster/office areas without a south connector.
- Speech-platform tests retain the original platform collider as input, verify the C walking-floor override, actual east-ramp heights, routing via its toe, rejected unsupported west ledge and accepted original0.32m curb.
- Lazy visibility in A* reduced the same full-blueprint test's observed total from roughly765–912ms to188ms on this host. This is a Node test-suite timing across many route queries, **not game FPS, a browser frame-time promise or phone performance**.

Targeted ESLint passed for the three shared modules and their two tests. Workspace typecheck also passed during the workstream's handoff. Root-owned integration continued changing afterward; these observations do **not** replace the final whole-repository checks/build required below.

The later full run in `harness/evidence/milestone-c/sixth-verification.txt` passes typecheck, lint, **126/126 tests** and both production builds. Its game entry is `index-CJ4F1sqm.js` with dynamic game chunk `game-D1x2n_KP.js`; the Admin entry is `index-5vGrCj27.js`. The game build retains a large-chunk advisory, not a build failure. This is a saved pass for that source boundary. A subsequent Director route-callback fix is still being integrated, so **the final-source verification/build/served-byte gate remains open**; do not reuse this pass as evidence for later edits.

Focused escort recovery evidence is saved in `escort-source-handoff.md` and `escort-evacuation-regression.txt`: the latter records **14/14 controller/world/obstruction checks passing**, including eleven authored/observed leader starting poses and bounded crew movement. The sixth full suite also includes the exhausted-worker bay-clearance and pause/tutorial/obstruction regressions. Escort routing, exhausted-worker clearance and QA snapshot ownership have source/focused-test fixes; those checks do not establish actual all-five browser completion or a final post-route-fix production pass.

## Actual production gameplay progress — sixth build boundary

All paths in this section are under `harness/evidence/milestone-c/`. Observations retain their build/run scope; completing the hub is one of five missions.

- **Desktop:** the earlier `index-BmNgk0Ml.js` run completes the actual hub encounter/evacuation (`fourth-hub-completed.json`, with flee/loading/evening captures retained). On the sixth production build `index-CJ4F1sqm.js`/`game-D1x2n_KP.js`, the player walks connected roads from the hub to the committee approach while retaining the completed hub fact. `sixth-committee-approach.json` places the player at approximately x−47.738/z33.999 with committee approaching. `sixth-committee-paused.json` records committee active, six collected sandals, player approximately x−41.588/z41.953 and the hub still completed. This is observed travel/entry/collection, **not committee completion or all-five traversal**.
- **Mobile viewport:** actual measured **390×844**, mobile profile, with joystick movement, Run, pickup, camera swipe, item selection and physical throws observed. `sixth-mobile-entry.json/.jpg`, `sixth-mobile-flee.json/.jpg` and `sixth-mobile-completed.json/.jpg` retain entry → two leader hits/resolve20 → actual fleeing → resolve-zero defeat → full ambulance flow. The completed snapshot has one completed mission (`promise-junction`), no active encounter, and the next committee marker selected. Its history records all eight ambulance stages: approach, exit-medics, assist, load, return-medics, close-doors, depart and completed, plus the guarded `ambulance-loaded` and actual `ambulance-exited` completion events. This passes that observed hub loop only; it does not prove all five areas or a physical Android device.
- **Mobile map:** `sixth-mobile-map.jpg` visibly contains all five Bengali area labels and readable scrollable mission buttons, with the hub completed and committee selected. Marker selection/rerouting to microphone and then committee was observed while retaining the one completed fact. The saved map JSON records the final committee selection; it is not a separate saved snapshot of the intermediate microphone selection.
- **Concurrent controls:** the user confirmed that their own simultaneous input caused the extra Arrow-key movement/throws during the test, then released controls again. These events are not recorded as a player-input defect. Only isolated, observed input is eligible for subsequent control acceptance.
- **Performance limits:** raw sixth snapshots contain frame counters covering mixed foreground/background testing. No final controlled 600-frame desktop/mobile busy/boundary/chase/loading pass is granted by them. No Android FPS qualification is claimed. The earlier B desktop performance gap remains open.

The remaining four actual mission completions, mobile visits to all sectors, bounds/player failure and retry, intentionally blocked ambulance/door recovery, full A/B regressions, repeated runtime resource release and final screenshot/performance evidence remain required.

## Integration review findings — source closure, runtime confirmation pending

Read-only review findings were sent to the integrator. Fixes already seen in current source include impact eligibility before the old game reward path, map-open freezing of game updates/physics/animations, full rotated ambulance body occupancy, external/interior medic routing, retry-base clearance, animation-time wiring and disposable phone/medical accessories. These are source observations, with runtime regression still pending.

The following fixes are now present in source. This review does not mark their runtime/resource regressions passed:

1. `game.ts` captures each `dressCharacter` call's new material objects, disposes them without shared textures through the actor's idempotent `release`, and caches reusable item materials. Dynamic sector reload still needs observed material/texture counts alongside mesh/rig/physics/shadow counts.
2. `MissionDirector.tick` checks the outer sector's `active` state before running its actors, disables sleeping rigs/accessories/banners and stops their animation groups. Runtime traversal must still demonstrate the two-encounter budget and bounded active resources.
3. Completed ambulances retain distinct model/leader/medic records at the observed exit, remain in the map's actual ambulance list and release owned resources only beyond the camera range plus margin. Actual successive evacuations must still prove no visible jump, missing patient or resource growth.
4. The HUD requires exactly five completed facts before showing the all-paths-open title. Both the mission panel and expanded map expose explicit retry buttons for restartable encounters; completion selection avoids a rejected automatic `select` of such an area. Actual failure/retry checks remain pending.
5. Resume explicitly says `শেষ করা অভিযান রেখে খেলুন` and explains that an unfinished encounter restarts at its entrance. Outer crowd names use `bn(i + 1)`; HUD/map status uses the live mission phase. Actual persistence/new-run/retry and small-screen text checks remain pending.
6. Director routing reads current evacuation leader/medic snapshots, excludes the controlled actor, includes player/other actor occupancy and distinguishes own-vehicle interior routing. These callbacks still require actual loading, personnel re-entry and intentionally blocked-door/route recovery; pure-controller success does not establish visual acceptance.

## Gates before C may be accepted

- [ ] Final typecheck, lint, complete preserved/new tests and both production builds pass after the last source change; save outputs and verify served entry/model/animation bytes.
- [ ] Current C production build runs on QA4301 while primary4300 remains the frozen B build, with unrelated data/configuration preserved.
- [ ] Actual desktop walking connects all five areas, real marker selection/routes work and all five mission/evacuation chains complete.
- [ ] Actual mobile viewport uses touch joystick/swipe/context/items/map to visit the areas and complete the mission/chase/evacuation loop. State explicitly that viewport emulation is not Android hardware.
- [ ] Bounds failure, player failure, retry, blocked ambulance/door recovery, pause/resume, tutorial replay and checkpoint/new-run semantics are observed.
- [ ] A/B regression passes: tutorial/replay/Skip/preferences, parked CNG/blocked exit, egg/sandal physics/scoring/civilian penalty, audio clarity/mutes/Admin publication, Bengali rendering, day/evening, quality profiles and shop/camera/avatar/seated behavior.
- [ ] Foreground C FPS/frame times and active resources are measured in busy encounter, boundary crossing, chase and loading. Global performance targets and unobserved real-device limits are stated honestly.
- [ ] Repeated unload/reload/new-run cycles demonstrate bounded rigs, animation groups, physics bodies, shadows, materials/textures and audio emitters.
- [ ] Current C screenshots include day/evening, connected areas, chase and loading, with at least three actual gameplay angles. Visual quality is inspected and limitations recorded.
- [ ] `harness/build-log.md`, C specification/status, asset provenance and this acceptance record contain the final observed evidence and exact remaining limitations.

**No C acceptance or D start is granted by this progress record.**
