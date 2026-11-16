# নেতা উঠছে!

**প্রতিশ্রুতি অনেক। রাস্তাটা ছাড়েন!**

**বর্তমান পর্যালোচনা (৬ নভেম্বর ২০২৬): Phase 05-এর দলীয় খেলা।** [স্থানীয় গেম](http://127.0.0.1:4306/) ও [যাচাইয়ের ফল](harness/build-log.md) দেখুন। আগের [Phase 01-এর দৃশ্যের পর্যালোচনা](harness/phase-01-20261105-review.md), চূড়ান্ত শিল্পমান ও desktop 60 FPS লক্ষ্য পৃথকভাবে খোলা। নিচের A–H প্রতিবেদন ঐতিহাসিক অগ্রগতি।

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

Open [the local game](http://127.0.0.1:4300/) or [the Bengali Admin](http://127.0.0.1:4300/admin/). The Admin has first-use password setup. In **গেমের কনটেন্ট**, save the draft, open **খসড়া গেমে দেখুন** to play it privately, and publish it when ready. A new game page load takes the published catalog. Audio retains its existing separate publication and settings. Keep `var/game` when upgrading.

For Phase 05, use the server served game. Choose **বন্ধুদের সঙ্গে খেলুন**, enter a Bengali name and choose a shirt. Create a room and send its six-character code to a second player. For a local test, open the game in a private window or another browser profile so the two players have distinct identities. The host starts with at least two players. A dropped connection keeps its seat for 65 seconds while the server is running. The invite URL is local to this computer. Public hosting and remote device validation belong to the release phase.

New referral players enter the friend's referral code before creating a profile. Both players unlock the patterned scarf once they win together with qualifying participation. The profile and reward are stored in `var/game/online-profiles.json`; the browser holds the corresponding identity token. Team play is a separate on-foot mission at প্রতিশ্রুতি মোড় and does not change the saved solo campaign.

The server listens on localhost. It can use a dedicated [MongoDB and GridFS setup](apps/server/README.md) for the game catalog and its media. With no database configured, it stores the new catalog and media locally alongside the existing audio data. `npm run preview` still serves the game-only build on port 4173, with the local API proxied to port 4300.

The separate QA server uses `NETA_PORT=4301`, `NETA_DATA_DIRECTORY=var/qa-audio-20261103` and `NETA_TEST_MODE=1`. Its synthetic account and test uploads are separate from your content.

## Controls

Walk with W/A/S/D or arrows and hold Shift to run. E handles nearby collection/vehicle context; Tab boards or exits the parked CNG. Select an item with 1/2 or the mouse wheel; left-click or Enter uses it (Space remains an alias). Drag the scene to orbit without throwing, M opens/closes the expanded map, and Escape pauses. Camera distance has explicit near/far buttons.

Mobile provides a joystick, camera swipe, item/context/use/map buttons and a run toggle. Tap run once, then move the joystick; tap again to turn it off. The pressed state and Bengali label show whether run is enabled, allowing one-handed operation. Nearby pickups supply six items and refill after fifteen active seconds. Throws use Havok gravity with a modest forward aiming assist. Civilians award no points and cost health if hit; close worker crowds can push and reduce health outside tutorial safety.

The Bengali tutorial advances through ten actual actions, including item use and animated entry/exit of one parked CNG. It supports Skip, “আর দেখাবেন না” and Settings replay. Replay preserves position, inventory and score; it is unavailable during boarding/seated motion. Tutorial safety suspends hostile damage while its lessons are open. B provides one street and one parked-seat exercise; later driving and full mission completion remain deferred.

New games select from a finite trusted factory spawn registry, checking current world clearance and occupancy for the full player footprint. Ground height comes from the street. A blocked registry shows a Bengali retry state instead of inventing a fallback point. `/api/spawns` reads the isolated published registry; B's shipped revision has factory provenance, not an observed user/Admin approval. Authenticated spawn editing/publication belongs to G and has not been claimed as implemented.

## Architecture

- `apps/game`: React Bengali interface, Vite build, Babylon 9 3D scene, Havok Physics V2 projectiles, original animated GLB player/NPCs, spatial Web Audio.
- `packages/shared`: Bengali content, item rewards, quality settings, movement bounds, ballistic launch calculation, trusted spawn validation and tutorial state machine.
- `apps/admin`: Bengali game and audio editing, licensed media, playable draft preview, publication, rollback and audit.
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
