import {
  AnimationGroup,
  AssetContainer,
  LoadAssetContainerAsync,
  Scene,
  TransformNode,
} from "./engine";

export const missionAnimationDurations = {
  Speech: 3.2,
  Warn: 1.6,
  Cover: 2,
  Phone: 3.4,
  EggReact: 0.65,
  SandalReact: 0.85,
  Defeated: 1.2,
  Resting: 3,
  Assist: 2.1,
  Carry: 1.3,
  AssistedWalk: 1.3,
  Loading: 1.8,
} as const;
export type MissionAnimationName = keyof typeof missionAnimationDurations;
const leaf = (name: string) => name.slice(name.lastIndexOf("/") + 1);
/** The bank uses precisely the base rest hierarchy. This is same-rig name
 * mapping, not humanoid retargeting with guessed bone proportions. */
export class MissionAnimationBank {
  private container: AssetContainer;
  private constructor(container: AssetContainer) {
    this.container = container;
  }
  static async load(
    scene: Scene,
    path = "/assets/models/mission-animations.glb",
    required: readonly string[] = Object.keys(missionAnimationDurations),
  ) {
    const container = await LoadAssetContainerAsync(
      path,
      scene,
    );
    for (const group of container.animationGroups) group.stop();
    for (const name of required)
      if (!container.animationGroups.some((g) => g.name === name)) {
        container.dispose();
        throw new Error("চরিত্রের প্রয়োজনীয় অঙ্গভঙ্গি পাওয়া যায়নি।");
      }
    return new MissionAnimationBank(container);
  }
  bind(root: TransformNode, prefix = root.name, skip: readonly string[] = []): AnimationGroup[] {
    const nodes = new Map(
      root
        .getDescendants(false)
        .filter((node) => node instanceof TransformNode)
        .map((node) => [leaf(node.name), node]),
    );
    const bound: AnimationGroup[] = [];
    try {
      for (const source of this.container.animationGroups) {
        if (skip.includes(source.name)) continue;
        for (const targeted of source.targetedAnimations)
          if (!nodes.has(leaf(targeted.target.name)))
            throw new Error("চরিত্রের অস্থি ও অঙ্গভঙ্গি মিলছে না।");
        const group = source.clone(
          `${prefix}/${source.name}`,
          (target) => nodes.get(leaf(target.name)),
          true,
          false,
        );
        group.stop();
        group.enableBlending = true;
        group.blendingSpeed = 0.12;
        bound.push(group);
      }
      return bound;
    } catch (error) {
      for (const group of bound) group.dispose();
      throw error;
    }
  }
  dispose() {
    this.container.dispose();
  }
}
