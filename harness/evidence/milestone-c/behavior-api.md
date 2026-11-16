# C behavior and evacuation handoff

Implemented on 2026-11-04, Asia/Dhaka. These are module and imported-asset checks, **not visual gameplay acceptance**.

## Original assets

- `assets/source/generate-mission-animations.mjs` writes the separate `public/assets/models/mission-animations.glb` motion bank: 165,984 bytes, 17 matching original rest joints, 12 original clips: Speech, Warn, Cover, Phone, EggReact, SandalReact, Defeated, Resting, Assist, Carry, AssistedWalk and Loading.
- The base character is unchanged, SHA256 `41798de6425d8faa6308183dab5825951dfeef287b2d2c442fb04ae4ba4cf789`; all nine accepted base clips remain in their original file.
- `ambulance.ts` is editable original metre-scale fictional microbus modelling. It includes framed openings, cabin and rear door hinges, turning wheels/rims, roof beacons, glass, mirrors/wipers, cabin seats, dashboard/steering, rear cabinet, stretcher rails/casters/mattress/blanket and Bengali service labels. It copies no hospital/aid organization identity.
- `ambulanceGeometry.ts` is the shared source of model anchor positions and the 2.2 × 5.05 m closed body footprint. Rear entry, rest, front seats and side exits are actual scene nodes constructed from those values.
- `attachMissionAccessories` adds joint-linked phones and Bengali medical identifiers; `missionProps.ts` makes a folded original Bengali leaflet from folded triangles. Neither is a portrait or capsule substitute.
- All new geometry, textures and motions above are project-original procedural artwork. Existing photographic PBR material maps retain the attribution already recorded in ASSETS.md; their source/license is not changed here.

## APIs and ownership

`MissionActorAI` is scene-independent. Its actual displacement selects walking/running facts. It has leader notice/cover/flee/finite paper-prop events, distinct item reactions, worker warning/follow/dodge/siren yield/scatter, civilian traffic crossing/shop/phone/siren/return, pause/tutorial safety, and resting defeated leaders/workers. The siren chooses one bounded yield destination rather than moving the goal away forever. Root-owned sector logic supplies collision/path/height callbacks and performs audio/projectile/rig rendering.

`EvacuationController` accepts one definition/request per mission. Its stages are approach, exit-medics, assist, load, return-medics, close-doors, depart and completed. It exposes actual actor poses, animation names and independent clip times, doors, signed `wheelTravel` and absolute `vehicleTravel`. Loading and exit completion depend on observed pose/anchor contact; assistance and doors take their finite authored clip durations. A blocked route/door waits indefinitely and cannot complete because a timer expired. Six nearby assistance positions per medic are tested for actual reachability so the office's arcade columns cannot trap a fixed side point. Departure reverses out of the loading bay rather than sweeping a microbus180degrees through the hub dais.

Callbacks must preserve ownership: `canActorStand(x,z,who,interior)` and `pathTo(from,to,who,interior)` include the ambulance body outside. Interior movement ignores only that vehicle body during actual open-door anchor travel. Vehicle clearance includes static walls/dais, the entire rotated body and actual living occupants, excluding passengers attached to this ambulance. `rotatedFootprintClear` uses separating-axis collision against all static AABBs, tests authored-ground coverage over the whole body and rejects occupied character envelopes. `ambulanceNavigationObstacles` provides a conservative walking/planning AABB.

`MissionAnimationBank.load(scene).bind(actorRoot,prefix)` clones groups onto this instantiated rig's actual named transform nodes. Dispose bound groups before releasing a rig; dispose the bank after all bindings. `createAmbulance(...).dispose()` removes its shadow casters and owned model/material/texture resources. Root integration owns physician actors, physics/camera proxies and sound emitters.

## API verification

Context7 resolved `/babylonjs/documentation` and returned the official animation target name-mapping/retargeting and rest-pose requirements:

- https://github.com/babylonjs/documentation/blob/master/content/features/featuresDeepDive/animation/animationRetargeting.md

The bank uses the exact original17joint rest hierarchy, so same-rig `AnimationGroup.clone(newName,targetConverter,true,false)` is used; no guessed humanoid proportions or new retargeting dependency is introduced. Installed9.33.1 `animationGroup.pure.d.ts` confirms the clone signature and group disposal. Actual Babylon import/clone execution is covered by the NullEngine test below, including the target skeleton transform matrices. No dependency changed.

## Observed checks

`behavior-contract-tests.txt` records **20/20 passing** tests:

- AI movement, changing headings/cover/flee, finite props, actual-wall blocking, item-ID deduplication/reactions, tutorial/pause, worker siren/rest/scatter and civilian crossing/shop/return.
- Accepted .32 m curb traversal, .46 m unsupported dais edge rejection and continuous ramp acceptance.
- GLB header/accessors/durations, all17restjoint translations, normalized finite quaternions, actual motion and seamless loops; defeated/resting pelvis continuity and unchanged base bytes.
- Actual Babylon9.33.1 NullEngine import of the meshless motion bank and base GLB, all12groups ×18channels mapped to this real skinned instance, nonidentity animated arm quaternion, finite skeleton matrices, and clone disposal preserving the target geometry. This is imported-asset/API evidence, **not a GPU rendering result**.
- Entire ambulance stage chain, exactly-once completion, blocked roads/doors, pause and cancellation/retry.
- Full rotated vehicle/static collision at .1 m intervals along all five actual authored approaches, using the resident outer-sector blueprints plus the protected hub footprints.
- All five complete evacuation flows through actual obstacles/body-safe doors, including a leader initially on the hub dais and outer leaders at their final escape points.
- The actual hub bay occupied by a worker: ambulance stops, stays stopped until the real worker AI moves away in response to its siren, then finishes the journey.

Remaining acceptance belongs to the root integration: real rendered desktop/mobile gameplay, animation/camera/audio inspection, traffic/crowd occupancy, FPS/resource measurements, screenshots, all mission completion/failure/retry flows and A/B regression.
