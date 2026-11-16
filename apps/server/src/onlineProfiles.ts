import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { invitePattern, type OnlineProfile } from "../../../packages/shared/src/online.ts";
import { ApiError } from "./content.ts";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newInvite = () => Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
export const normalizedInvite = (value: unknown) => typeof value === "string" && value.length <= 12 ? value.trim().toUpperCase() : "";
type Profile = { id: string; code: string; created: number; inviter: string; claimed: boolean; scarf: boolean };
type Profiles = Record<string, Profile>;
const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

export class OnlineProfiles {
  private profiles: Profiles = {};
  private readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();
  private creation = new Map<string, { at: number; count: number }>();
  constructor(directory: string) { this.file = join(directory, "online-profiles.json"); }
  async init() {
    try { this.profiles = JSON.parse(await readFile(this.file, "utf8")) as Profiles; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  find(token: unknown) {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return;
    return this.profiles[tokenId(token)];
  }
  private result(token: string, profile: Profile): OnlineProfile {
    return { token, code: profile.code, scarf: profile.scarf, pending: !!profile.inviter && !profile.claimed };
  }
  private mutate<T>(change: (next: Profiles) => T) {
    const task = this.queue.then(async () => {
      const next = structuredClone(this.profiles);
      const result = change(next);
      if (result === undefined) return result;
      const temp = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(next), { flag: "wx", mode: 0o600 });
      await rename(temp, this.file);
      this.profiles = next;
      return result;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  profile(token: unknown, referral: unknown, address: string) {
    if (token !== undefined && token !== "") {
      const profile = this.find(token);
      if (!profile) throw new ApiError(401, "এই খেলোয়াড় পরিচয় পাওয়া যায়নি।");
      return Promise.resolve(this.result(token as string, profile));
    }
    const now = Date.now();
    for (const [ip, entry] of this.creation)
      if (now - entry.at > 60 * 60_000) this.creation.delete(ip);
    const counter = this.creation.get(address) ?? { at: now, count: 0 };
    if (++counter.count > 12) throw new ApiError(429, "অনেকবার পরিচয় তৈরি হয়েছে। পরে আবার চেষ্টা করুন।");
    this.creation.set(address, counter);
    const incoming = normalizedInvite(referral);
    if (referral && !invitePattern.test(incoming))
      throw new ApiError(400, "ছয় অক্ষরের আমন্ত্রণ পরিচয় দিন।");
    return this.mutate((next) => {
      const all = Object.values(next);
      const inviter = incoming ? all.find((profile) => profile.code === incoming) : undefined;
      if (incoming && !inviter) throw new ApiError(404, "এই আমন্ত্রণ পরিচয় পাওয়া যায়নি।");
      const used = new Set(all.map((profile) => profile.code));
      let code: string;
      do { code = newInvite(); } while (used.has(code));
      const secret = randomBytes(32).toString("hex");
      const id = tokenId(secret);
      const profile = { id, code, created: now, inviter: inviter?.id ?? "", claimed: false, scarf: false };
      next[id] = profile;
      return this.result(secret, profile);
    });
  }
  reward(qualified: readonly string[]) {
    const ids = new Set(qualified);
    return this.mutate((next) => {
      const changed = new Set<string>();
      for (const id of ids) {
        const guest = next[id];
        if (!guest || guest.claimed || guest.id === guest.inviter || !ids.has(guest.inviter)) continue;
        const inviter = next[guest.inviter];
        if (!inviter || inviter.created > guest.created) continue;
        guest.claimed = guest.scarf = inviter.scarf = true;
        changed.add(id);
        changed.add(inviter.id);
      }
      return changed.size ? changed : undefined;
    });
  }
}
