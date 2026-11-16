# নেতা উঠছে!

**প্রতিশ্রুতি অনেক। রাস্তাটা ছাড়েন!**

Standalone Bengali third-person web game, set on one fictional Dhaka block around **কেটলি কেবিনেট**. The authorized [incremental expansion](harness/context/004-expansion-request.md) proceeds through milestones A–H in order. This repository has no connection to any commerce project or database.

Current gate: [Milestone A passed](harness/milestone-a-acceptance.md); [B's functional scope is verified](harness/milestone-b-acceptance.md), with60 passing tests, both production builds, desktop/mobile ten-step tutorials, animated boarding and final focused patrol-cycle checks. Actual B focused FPS is29.7343 desktop and30.0006 in a PC mobile viewport. The global desktop60FPS target remains unmet; Android performance and final art approval are unqualified. [C is ACTIVE, with implementation present and actual runtime acceptance pending](harness/milestone-c-acceptance.md): five connected areas, sector loading, mission/AI/ambulance controllers and the Bengali map are integrated. Actual C starts, movement, hub entry, cover and physical hits have been observed; all-five completion and the remaining acceptance checks have not passed. Accepted B is preserved in `harness/accepted-builds/milestone-b-20261104/` and `assets/source/archive/milestone-b-functional-20261104.zip`. D–H have not started. Historical evidence keeps its exact build boundaries; this is not a performance pass or full-game completion.

The photo-led graphics revision adds detailed vehicle geometry, reference-inspired material maps, HDR lighting, desktop contact shading, street trees/railings/posters/drains and local garments. The original rig now retains six motions plus three original boarding clips. Drag to orbit; use the explicit near/far camera controls to zoom. The mouse wheel selects items in gameplay. See [the graphics revision report](harness/graphics-upgrade.md) for historical art results and limitations.

## Run locally

Node >=22.12 is required (tested with Node 26.5.0).

```powershell
npm ci
npm run dev
```

For the tested production version:

```powershell
npm run build
npm start
```

Open [the local game](http://127.0.0.1:4300/). [Audio administration](http://127.0.0.1:4300/admin/) has a first-use password setup owned by you. Game play needs no account, API key, external database or font service. Audio drafts, upload files and published revisions are stored locally in `var/game`; retain that folder when upgrading. The server listens only on localhost. `npm run preview` still serves the game-only build on port 4173, with the local API proxied to port 4300.

The separate QA server uses `NETA_PORT=4301`, `NETA_DATA_DIRECTORY=var/qa-audio-20261103` and `NETA_TEST_MODE=1`. Its synthetic account and test uploads are separate from your content.

## Controls

Walk with W/A/S/D or arrows and hold Shift to run. E handles nearby collection/vehicle context; Tab boards or exits the parked CNG. Select an item with 1/2 or the mouse wheel; left-click or Enter uses it (Space remains an alias). Drag the scene to orbit without throwing, M opens/closes the expanded map, and Escape pauses. Camera distance has explicit near/far buttons.

Mobile provides a joystick, camera swipe, item/context/use/map buttons and a run toggle. Tap run once, then move the joystick; tap again to turn it off. The pressed state and Bengali label show whether run is enabled, allowing one-handed operation. Nearby pickups supply six items and refill after fifteen active seconds. Throws use Havok gravity with a modest forward aiming assist. Civilians award no points and cost health if hit; close worker crowds can push and reduce health outside tutorial safety.

The Bengali tutorial advances through ten actual actions, including item use and animated entry/exit of one parked CNG. It supports Skip, “আর দেখাবেন না” and Settings replay. Replay preserves position, inventory and score; it is unavailable during boarding/seated motion. Tutorial safety suspends hostile damage while its lessons are open. B provides one street and one parked-seat exercise; later driving and full mission completion remain deferred.

New games select from a finite trusted factory spawn registry, checking current world clearance and occupancy for the full player footprint. Ground height comes from the street. A blocked registry shows a Bengali retry state instead of inventing a fallback point. `/api/spawns` reads the isolated published registry; B's shipped revision has factory provenance, not an observed user/Admin approval. Authenticated spawn editing/publication belongs to G and has not been claimed as implemented.

## Architecture

- `apps/game`: React Bengali interface, Vite build, Babylon 9 3D scene, Havok Physics V2 projectiles, original animated GLB player/NPCs, spatial Web Audio.
- `packages/shared`: Bengali content, item rewards, quality settings, movement bounds, ballistic launch calculation, trusted spawn validation and tutorial state machine.
- `apps/admin`: Bengali audio/music editing, licensed upload/preview, draft/publish/rollback and draft recovery. Other Admin modules wait for their authorized milestone.
- `apps/server`: local authenticated audio content service, atomic JSON persistence, isolated published spawn reads and production static serving.
- `assets/source`: editable original GLB authoring; runtime GLB in `public/assets/models`.
- `harness/build`: gated phase specifications 00–06; `harness/context`: scope/API decisions; `harness/build-log.md`: observed results and limitations; `harness/evidence`: screenshots and recorded checks.

## Verification and evidence

```powershell
npm run verify
npm run assets
```

Append `?qa=1` to the URL to show a Bengali runtime diagnostics disclosure with actual frame samples, positions, skeleton and animation counts. It does not appear in the ordinary game. No analytics or remote telemetry is sent.

Read [build evidence](harness/build-log.md), [historical slice acceptance](harness/phase-01-status.md) and [asset provenance](ASSETS.md) before treating the game as approved. Mobile viewport emulation is not Android hardware qualification. The current expansion is authorized; each milestone must pass its verification gate before the next begins.
