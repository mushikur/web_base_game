/** Ownership and sharing are separate: a pre-existing hub resource is never
 * adopted, while a newly generated resource can be retained by several sectors. */
export class SectorResources<T> {
  private readonly records = new Map<
    T,
    {
      dispose: () => void;
      persistent: boolean;
      owners: Set<string>;
    }
  >();
  private readonly owners = new Map<string, Set<T>>();
  register(resource: T, dispose: () => void, persistent = false) {
    const record = this.records.get(resource);
    if (record) {
      record.persistent ||= persistent;
      return;
    }
    this.records.set(resource, { dispose, persistent, owners: new Set() });
  }
  retain(owner: string, resources: readonly T[]) {
    if (this.owners.has(owner))
      throw new Error("সেক্টরের সম্পদ একবারই যুক্ত করা যাবে।");
    const retained = new Set<T>();
    for (const resource of resources) {
      const record = this.records.get(resource);
      if (record) {
        record.owners.add(owner);
        retained.add(resource);
      }
    }
    this.owners.set(owner, retained);
  }
  release(owner: string) {
    const retained = this.owners.get(owner);
    if (!retained) return;
    for (const resource of retained)
      this.records.get(resource)?.owners.delete(owner);
    this.owners.delete(owner);
    this.sweep();
  }
  sweep() {
    for (const [resource, record] of this.records)
      if (!record.persistent && record.owners.size === 0) {
        this.records.delete(resource);
        record.dispose();
      }
  }
  get size() {
    return this.records.size;
  }
  dispose() {
    for (const record of this.records.values()) record.dispose();
    this.records.clear();
    this.owners.clear();
  }
}
