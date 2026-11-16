/** The existing civilian motion is shared by reset/spawn and rendered frames. */
export const maximumSimulationStep = 0.05;
const civilianPatrolRange = 1.5,
  civilianPatrolRate = 0.32;
export const maximumCivilianSpeed = civilianPatrolRange * civilianPatrolRate;
// Spawn validation covers the next capped frame plus a visible clearance margin.
export const initialOccupantClearance =
  maximumCivilianSpeed * maximumSimulationStep + 0.05;

export function civilianPatrol(baseZ: number, time: number, phase: number) {
  const angle = time * civilianPatrolRate + phase;
  return {
    z: baseZ + Math.sin(angle) * civilianPatrolRange,
    velocity: Math.cos(angle) * maximumCivilianSpeed,
  };
}

/** Conservative bounds of the entire moving civilian circle, not just its
 * current phase. Used only when choosing a place where a new player may idle. */
export function civilianPatrolBounds(
  baseX: number,
  baseZ: number,
  radius = 0.58,
) {
  return {
    x: baseX,
    z: baseZ,
    w: radius * 2,
    d: (civilianPatrolRange + radius) * 2,
  };
}
