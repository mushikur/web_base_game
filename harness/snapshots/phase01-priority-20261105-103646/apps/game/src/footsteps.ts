export type Contact = { foot: string; phase: number };
/** Crossings of imported animation phase, never an independent cadence timer. */
export class FootContacts {
  private last?: { clip: string; phase: number };
  reset() {
    this.last = undefined;
  }
  update(
    clip: string,
    phase: number,
    moving: boolean,
    contacts: Contact[],
  ): Contact[] {
    if (
      !moving ||
      !Number.isFinite(phase) ||
      !["Walk", "Run", "Carry", "AssistedWalk"].includes(clip)
    ) {
      this.reset();
      return [];
    }
    phase = ((phase % 1) + 1) % 1;
    const previous = this.last;
    this.last = { clip, phase };
    if (!previous || previous.clip !== clip) return [];
    const travelled = (phase - previous.phase + 1) % 1;
    if (travelled > 0.6) return []; // skip discontinuities/resume, never emit a burst of stale steps
    return contacts.filter((contact) => {
      const distance = (contact.phase - previous.phase + 1) % 1;
      return distance > 0 && distance <= travelled;
    });
  }
}
