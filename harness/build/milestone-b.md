# Milestone B — First-time tutorial and safe random spawn

Status: **FUNCTIONAL SCOPE VERIFIED.** Actual desktop/mobile ten-step tutorials, blocked-exit/retry, camera/audio regressions and final full patrol-cycle observations pass B's scoped criteria. Latest diagnostic-only build CSdJS6tH passes60 tests, types/lint and both builds. Actual focused desktop29.7343FPS misses the global60FPS target; PC mobile viewport30.0006FPS is not Android qualification. This is a functional pass, not a performance pass. **C is READY to start; its gameplay is not yet implemented.**

## Current evidence — 2026-11-04

The implementation includes trusted finite spawn selection, the action-driven Bengali tutorial and expanded map, desktop/mobile controls, persisted preferences/replay, and original animated boarding of the existing parked CNG. Replay preserves the current position, inventory and score; it is refused while boarding/seated. The original six clips are retained with three additional entry/seated/exit clips.

`harness/evidence/milestone-b/verification-resume-checks.txt` records types, lint, **60/60 tests and both production builds passing** for `index-CSdJS6tH.js`, which only adds the simulation-time diagnostic to the accepted gameplay source. Actual1280×720 desktop and390×844 mobile ten-step chains were observed on CmxIvYoq; targeted camera/counter/seat-opacity regressions and three angles on DYjhqTCn. Final CSdJS6tH desktop/mobile idle observations cover26.956/30.9792 simulation seconds, unchanged player and moving NPCs, exceeding the19.635s patrol cycle. All3 eligible points among6 registered have automated full-cycle coverage. Current foreground FPS and its unmet desktop target are stated above. See `harness/milestone-b-acceptance.md` for exact evidence/build boundaries; no real-phone or final-art qualification is claimed.

## Purpose and boundary

Extend the working street with a Bengali first-time tutorial and safe randomized starts. Preserve the existing scene, actors, original rig, camera, pickups, projectiles, audio settings and publication history. Do not rebuild the game or introduce a second input/physics engine.

The smallest complete B includes all ten tutorial actions and one usable parked green CNG for the boarding exercise. Driving, traffic simulation, passenger management and additional vehicle types belong to E. Connected mission areas and advanced AI belong to C; the tutorial ends by viewing the existing first mission marker, without claiming the later mission chain works.

Full spawn administration belongs to G under AGENTS.md. B must not add an unrelated Admin module or make the user create a production password or manually publish content merely to keep the working game playable.

## Pre-implementation audit and regression risks

The following audit describes the accepted A baseline before B edits, not the current implementation status.

- `DhakaGame.start()` currently resets the player to `(0, 0, -9)`. It must retain its actor/pickup/projectile reset behavior while replacing that fixed placement.
- The current help dialog is static instructions, not an action-driven tutorial. The existing mini-map has no expanded-map action or selectable tutorial marker.
- Existing controls cover movement, Shift, E, Space, 1/2, drag-to-orbit and wheel zoom. Tab, M, Enter, click-to-use and wheel item selection need deliberate integration with existing dialog focus handling.
- `World` currently returns environment/collision data, while the rickshaw/CNG roots are discarded after creation. Vehicle children can enter static material batching. Boarding requires retaining a vehicle descriptor and excluding its movable/interactive meshes from batching; the street itself should remain batched.
- The original editable character currently supplies Idle, Walk, Run, Throw, Hit and Pickup. A seated pose or UI label alone does not satisfy animated entry/exit. Add and verify original entry/seated/exit clips without removing existing motions, weights or optional garments.
- Preserve A's animation-contact footsteps, speech priorities, browser gesture unlock, pause behavior and published audio. Tutorial progress must not introduce a generic footstep timer or reset device audio preferences.

## Trusted spawn content contract

The request says “Admin-approved locations,” while AGENTS.md schedules the full spawn editor for G. Use this staged design without inventing an observed Admin action:

1. Ship a small, curated **factory spawn registry** for the existing street. It is the trusted initial content publication supplied with the project, not a client-asserted approval flag. Record its world version, revision and factory provenance. Player-facing text may call these “নির্ধারিত নিরাপদ স্থান”; do not describe a factory seed as a user/Admin approval performed in the browser.
2. Runtime selection reads only that trusted registry or a valid server-published replacement. Never accept arbitrary coordinates or `approved: true` from a player request, URL, tutorial state or local preference as an approved spawn.
3. Reserve a separate spawn-content namespace for G's authenticated draft/publish/rollback and audit provenance. Audio saves/imports/rollback must not alter it. B may expose/read trusted published spawn configuration if needed, but must not build the full spawn editor ahead of G or pretend a static form is administration.
4. G's acceptance must demonstrate an actual authenticated Admin publication changing the real game's allowed spawn registry. B's evidence must state whether it used factory defaults or an existing genuine Admin publication. This is a staged implementation interpretation, not a claim that G's approval flow has already been verified.

Suggested internal registry fields are `schemaVersion`, `worldVersion`, `revision`, `source` (`factory` or `admin-publication`), and locations with stable ID, Bengali name, enabled state, x/z and facing. Derive ground height from the world; never trust a supplied y value. Keep the source/provenance label truthful and keep the published allowlist separate from transient player occupancy.

Before creating actors at a new-game start, restore the world/parked-vehicle state and compute current exclusions. Shuffle/filter a finite candidate list using an injectable RNG, then select one eligible point. Validate the entire player footprint, including clearance, against:

- The current navigation region and world bounds.
- Buildings, counters, parked vehicles and other walk blockers.
- Every puddle/water footprint, including points whose centre is dry but whose radius overlaps water.
- Mission crowd/exclusion zones and current NPC occupancy.
- Traffic and other-player occupancy when those systems exist; B must provide the exclusion interface and fixture coverage without claiming actual multiplayer or traffic has been tested.

Validate both trusted content and current runtime occupancy. Do not use unbounded random retries, an unvalidated hard-coded fallback, a new unapproved point, or a point left inside an obstruction. If all approved candidates are occupied, keep the player out of simulation and show a Bengali retry state such as “নিরাপদ জায়গা খালি নেই। আবার চেষ্টা করুন।” The retry must preserve preferences and data.

Factory candidates must have a collision-safe route to the tutorial pickup, parked CNG and first marker. Test multiple starts and deterministic edge cases; one fortunate random start is not enough evidence.

## Tutorial behavior

Use one small, versioned tutorial state machine. Progress comes from actual gameplay events rather than a “পরের ধাপ” button that merely declares an action complete. Show the current Bengali instruction with a matching original icon and concise desktop/mobile control hint.

| Step | Bengali instruction direction | Completion observation |
| --- | --- | --- |
| 1 | “একটু সামনে হাঁটুন” | Measured player displacement, not a held key or a blocked animation. |
| 2 | “চারপাশ দেখতে ক্যামেরা ঘোরান” | Actual camera yaw/pitch change from drag/swipe. |
| 3 | “দৌড়ে এগিয়ে যান” | Running animation/state and real movement while run is active. |
| 4 | “ছোট মানচিত্র খুলুন” | Expanded mini-map actually opens. |
| 5 | “কাছের জিনিস কুড়িয়ে নিন” | An available street pickup changes inventory and plays Pickup. |
| 6 | “সঙ্গে থাকা জিনিস বেছে নিন” | Explicitly select an owned usable item; automatic selection during pickup does not pass. |
| 7 | “বেছে নেওয়া জিনিস ব্যবহার করুন” | A real use/throw action with its quantity, animation and physics; an empty-inventory warning does not pass. |
| 8 | “সবুজ সিএনজির কাছে যান” | Contextual vehicle interaction becomes available at the safe approach anchor. |
| 9 | “সিটে উঠুন, আবার নেমে আসুন” | Completed animated entry, actual seated attachment and collision-safe animated exit. Both directions are required. |
| 10 | “প্রথম অভিযানের চিহ্ন দেখুন” | The real first marker is viewed/selected on the map and its Bengali objective appears. |

Tutorial instructions must guide from every valid initial spawn. If a needed item is unavailable, wait for or provide its legitimate respawn; never fabricate inventory/progress. The boarding exercise must remain reachable and usable after Skip or Settings replay.

While the tutorial is open, suspend worker damage, hostile targeting/chase and dangerous vehicle/mission activation. Keep the player, camera, non-dangerous world rendering, required pickup/projectile exercise and audio functional. Do not globally pause the whole simulation in a way that prevents the current lesson. C/E must later honor the same tutorial-safety gate.

Provide “এড়িয়ে যান”, the exact preference “আর দেখাবেন না”, and a Settings action to replay. Store only a small versioned tutorial preference/progress record. A normal pause, Settings dialog, tab blur or resume must clear held controls without falsely completing a step. Skip releases tutorial-only safety after returning to normal gameplay; it must not award score, items or mission completion. Replay preserves the live position, inventory and score, and is refused during boarding/seated motion. Replaying and then skipping must preserve an earlier completed preference.

Adapt control hints from actual input/pointer capability, independently of graphics quality. A desktop can choose mobile graphics without losing keyboard/mouse instructions; a touch device can use higher graphics without receiving unusable mouse-only directions. A secondary input can update hints without erasing progress.

## Input contract

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move | WASD or arrows | Existing left joystick |
| Camera | Mouse drag/orbit | Swipe on the scene |
| Run | Shift while moving | Run toggle button, then joystick movement |
| Pickup/context | E | Contextual interaction button |
| Vehicle interaction | Tab near a valid vehicle | The same contextual interaction button |
| Use item | Left click or Enter | Attack/use button |
| Change item | Number keys or wheel | Item selection button/slots |
| Mini-map | M | Mini-map button |
| Pause | Esc | Pause button |

Distinguish a click from a camera drag; releasing a drag must not throw an item. Wheel item selection replaces the old gameplay wheel-zoom behavior; retain the explicit near/far camera controls. Space may remain a documented compatibility alias until a later milestone assigns it another real action; it is not the primary B instruction.

Respect form inputs, dialogs, default-prevented events and their existing focus trap. Tab is a gameplay vehicle shortcut only while the gameplay surface is active; it must continue normal accessible focus movement inside dialogs. UI button clicks must not also trigger scene attacks. Consume each deliberate use/select action once, clear pointer/key capture on blur/cancel/pause, and keep the mobile joystick and camera swipe independent.

The mobile run button uses `onClick={() => g.run()}` and exposes `aria-pressed={s.runEnabled}`. Its Bengali label announces turning run on/off. A toggle lets one hand activate run and then operate the joystick without requiring a second simultaneous held touch. Actual displacement while run is active still completes the lesson; toggling alone does not.

## Parked CNG boarding dependency

Retain a descriptor with the authored root, collision footprint, safe approach/door anchor, seat transform, safe exit candidates and occupancy. Keep its child geometry out of static batching. B needs one empty usable seat; E later extends this to drivers, passengers and motion.

Use explicit approach → entering → seated → exiting states with appropriate Bengali prompts. Move to the approach anchor through the allowed walk region; play original rigged EnterVehicle, Seated and ExitVehicle clips with blending and spatial A audio events. Attach to the correct seat after alignment, use a sensible vehicle camera and prevent normal on-foot walking/throwing while seated. A pose instantly appearing in a seat, an external portrait, or a button that only changes a status string is not boarding.

Before exit, validate full-footprint clearance against the same world/occupancy data. Try bounded alternate authored exit anchors; if blocked, remain safely seated with a Bengali explanation and allow retry. Do not disable all world collision. An obstruction fallback may be used only for a verified entry/exit obstruction, with a recorded reason and a safe validated placement; it is not the default path. No driving claim is made in B.

## Verification and acceptance

Before closing B:

- Run focused state-machine, input and spawn tests, then typecheck, lint, all preserved tests and production builds. Use deterministic RNG/occupancy fixtures for blocked edges, radius-over-water, NPC/crowd/traffic/player exclusions, unknown/unpublished points, all-candidates-blocked and a valid finite choice. Test real published-content reads/restart isolation if B adds that service endpoint; never reset audio data for a test.
- Verify tutorial transitions from actual displacement, camera motion, run, map, inventory, projectile and seat events. Test Skip, preference reload, version repair, Settings replay, input-mode adaptation, disabled dangerous AI and recovery from pause/blur. Empty actions, blocked motion and repeated keys must not advance progress.
- Verify the original GLB still contains the preserved motions and new rigged boarding clips with valid weights. Unit checks alone do not establish believable animation or camera visibility.
- Run the production build and complete all ten steps in an actual desktop viewport and mobile viewport. Observe touch joystick/swipe/run/context/item/attack/map controls, Tab/Enter/wheel/click-drag behavior, Bengali shaping, scroll/clipping, safe boarding/exit and a blocked-exit retry. Explicitly measure the DOM viewport rather than trusting a requested override.
- Regress the existing street's player/camera collision, egg/sandal physics and scoring, civilian penalties, day/evening/profile switching, A's animation-contact footsteps, voice clarity, mute persistence and real Admin audio publication/rollback.
- Measure FPS with actual visible frame/elapsed-time samples, capture at least three meaningful gameplay angles and record exact results/limitations in `harness/build-log.md`. Mobile emulation is not Android hardware qualification. Keep working QA tabs marked for handoff across interruptions, and preserve the user's played run.

Continue to C only when B's implemented scope and actual runtime acceptance pass. Keep the later full Admin approval workflow, driving/traffic, connected city and multiplayer claims explicitly deferred to their milestones. Do not treat this specification, tests alone or a successful build as B completion.
