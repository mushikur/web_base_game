import type { Scene } from "@babylonjs/core/scene";
import type { Material } from "@babylonjs/core/Materials/material";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { SectorResources } from "./sectorResources.ts";

type Resource = Material | BaseTexture;
const scenes = new WeakMap<
  Scene,
  { pool: SectorResources<Resource>; clients: number }
>();

/** The environment and its scripted traffic may borrow the same vehicle paint.
 * A scene-local lease lets either service unload first without destroying a
 * material still referenced by the other service's live meshes. */
export function acquireSectorResources(scene: Scene) {
  let shared = scenes.get(scene);
  if (!shared) {
    shared = { pool: new SectorResources<Resource>(), clients: 0 };
    scenes.set(scene, shared);
  }
  shared.clients++;
  let released = false;
  return {
    pool: shared.pool,
    release() {
      if (released) return;
      released = true;
      shared!.clients--;
      if (shared!.clients === 0) {
        shared!.pool.dispose();
        scenes.delete(scene);
      }
    },
  };
}
