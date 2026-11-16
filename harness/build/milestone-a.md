# Milestone A — Complete audio system

## Purpose
Extend the working slice with original/authorized audio and actual Admin-to-game publishing.

## Scope
Nine persisted volume/mute buses; gesture unlock; original Foley/music bank; separately attributed Bengali fictional voices; surface-aware animation-frame footsteps; HRTF distance/occlusion; randomized ambience; bounded priority voices; playlist order/random/loop/fades; audio/voice upload and preview, draft/publish/rollback.

## Non-goals
Do not claim later mission, vehicle, multiplayer or newspaper actions exist merely because their audio events are registered. Implement their gameplay in the later milestones. No new city or duplicate game engine.

## Dependencies
Existing Babylon/Havok slice, local Web Audio, shipped PCM bank, native Node HTTP content service and React audio administration. No external runtime audio service or paid API.

## Acceptance criteria
- All nine buses persist independently and master mute survives a new game/reload.
- Before a gesture, no AudioContext starts; after a gesture actual output exists. Pause and previews remain consistent.
- Foot contact events come from actual Walk/Run animation phase and actual movement; idle, blocked movement and resume do not produce stale bursts. Eight mapped surfaces have distinct assets and visible matching patches.
- Original music has five contexts, configured fades and bounded voice use; fictional Bengali lines include subtitles and documented licenses.
- Authenticated Admin can validate/upload/preview/save/publish/rollback. Drafts do not leak into the public game; published changes reach an already open game; edited content is not overwritten by bundled upgrades.
- Types/lint/unit/API regression/build pass. Inspect actual game and Admin on desktop/mobile, measure FPS and record runtime evidence. Clearly distinguish observed output signal from human auditory review.

## Verification plan
Native Node API integration with isolated temporary data, generated audio signal/header/budget checks, animation crossing and surface/occlusion tests; production browser flow including volume persistence, walk/run contacts, mute/unmute output, Admin upload/publish/rollback and the game's published revision.

## Approval gate
Continue to B only after A's implemented scope and actual runtime acceptance pass. Keep unmet sound quality, device or browser conditions explicit; never replace evidence with compilation claims.
