# Phase 00–01 resumption audit — 2026-11-02

User explicitly requested Phase 00–01 only and a visual gate. Current directory resolved to `D:/neta-udche -3d`. Root package `neta-uthche` contains the standalone game workspaces, original source/runtime assets, phase harness and evidence. No clothing application, unrelated project files or database configuration was found in the application/source inventory. `git status --short --branch` reported that this directory is not a Git repository. Existing work was preserved; no Git reset, database action, deletion or unrelated project change was performed.

`AGENTS.md`, `GOALS.md`, `PLANS.md` and `harness/build/phase-00.md` through `phase-06.md` already existed. Maintained them rather than recreating the project. Admin/server directories remain reserved documentation only. Updated discovery prerequisites to support resuming an existing standalone checkout.

## Current APIs verified using Context7

- `/babylonjs/documentation`: official ES6 Havok setup, asynchronous initialization before `HavokPlugin`, `scene.enablePhysics`, Physics V2 aggregate usage. [Official source](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/physics/v2/usingHavok.md).
- `/babylonjs/havok`: package default async factory and the supported `locateFile` override used to bundle WASM locally. [Official package](https://github.com/BabylonJS/havok/blob/main/packages/havok/README.md).
- `/vitejs/vite`: `publicDir` files copied to production `outDir`; `vite build`, `vite preview --host 127.0.0.1 --strictPort`; preview serves built output. [Official options](https://github.com/vitejs/vite/blob/main/docs/config/shared-options.md).

Live npm metadata matched installed versions: Babylon core 9.33.1, Havok 1.3.14, Vite 8.3.5; local Node v26.5.0. Initial restricted network check returned ENOTFOUND/socket access errors; the normal network retry succeeded. No package upgrade or new runtime dependency was needed.

## Bounded completion changes

Added an elapsed-time FPS window that excludes hidden-tab/resume gaps, clears on quality/lighting changes, and exposes a Bengali reset button only in QA mode. Added a test against the mathematically incorrect arithmetic average of per-frame FPS. Added Bengali camera near/far buttons for desktop/touch using the existing camera limits. Suppressed accidental gameplay text selection during Shift movement/orbit. Player motion history in QA records actual requested runtime animation states.

Current evidence and any remaining gate failures will be recorded in `harness/phase-01-review.md`. No Phase 02–06 implementation is authorized or started.
