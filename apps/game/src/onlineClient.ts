import { Client, type Room } from "@colyseus/sdk";
import {
  invitePattern, networkStep, onlineName, roomType, stepStreet, streetYaw,
  type OnlineProfile, type Pose, type StreetInput, type StreetSnapshot,
} from "../../../packages/shared/src/online";
import type { Item } from "../../../packages/shared/src/combat";

const profileKey = "neta-party-profile-v1";
const reconnectKey = "neta-party-seat-v1";
export const readOnlineOption = (name: string) => {
  const value = new URLSearchParams(location.search).get(name)?.trim().toUpperCase() ?? "";
  return invitePattern.test(value) ? value : "";
};
export async function onlineProfile(referral?: string) {
  let token = "";
  try { token = localStorage.getItem(profileKey) ?? ""; } catch { /* Session can still play. */ }
  const response = await fetch("/api/online/profile", {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ token: token || undefined, referral: token ? undefined : referral }),
  });
  const result = await response.json() as OnlineProfile & { error?: string };
  if (!response.ok || !result.token) throw new Error(result.error ?? "খেলোয়াড় পরিচয় তৈরি করা যায়নি।");
  try { localStorage.setItem(profileKey, result.token); } catch { /* Only active session persists. */ }
  return result;
}
const safeError = (error: unknown) =>
  error instanceof Error && /\p{Script=Bengali}/u.test(error.message)
    ? error.message : "ঘরে যোগ দেওয়া যায়নি। পরিচয় বা সংযোগ আবার দেখুন।";

export function storedSeat() {
  try { return sessionStorage.getItem(reconnectKey) ?? ""; } catch { return ""; }
}
function saveSeat(token: string) {
  try {
    if (token) sessionStorage.setItem(reconnectKey, token);
    else sessionStorage.removeItem(reconnectKey);
  } catch { /* Automatic reconnection still works. */ }
}
export class PartyClient {
  snapshot?: StreetSnapshot;
  status: "connected" | "reconnecting" | "closed" = "connected";
  notice = "";
  private pending: StreetInput[] = [];
  private sequence = 0;
  private sampleTime = 0;
  private round = -1;
  private predicted?: Pose;
  private listeners = new Set<() => void>();
  private readonly room: Room;
  private constructor(room: Room) {
    this.room = room;
    room.reconnection.minUptime = 0;
    room.reconnection.maxRetries = 35;
    room.reconnection.maxEnqueuedMessages = 0;
    saveSeat(room.reconnectionToken);
    room.onMessage("street", (snapshot: StreetSnapshot) => {
      this.snapshot = snapshot;
      const self = snapshot.players[this.id];
      if (self) {
        if (snapshot.round !== this.round) { this.round = snapshot.round; this.pending = []; }
        this.sequence = Math.max(this.sequence, self.ack);
        this.pending = this.pending.filter((input) => input.seq > self.ack);
        this.predicted = this.pending.reduce<Pose>((pose, input) => stepStreet(pose, input), self);
      }
      this.emit();
    });
    room.onMessage("notice", (text: string) => { this.notice = text; this.emit(); });
    room.onMessage("reward", (text: string) => { this.notice = text; this.emit(); });
    room.onDrop(() => { this.status = "reconnecting"; this.pending = []; this.emit(); });
    room.onReconnect(() => {
      this.status = "connected";
      this.pending = [];
      // The SDK fires onReconnect before replacing its token.
      queueMicrotask(() => { if (this.status === "connected") saveSeat(room.reconnectionToken); });
      this.emit();
    });
    room.onLeave(() => {
      this.status = "closed";
      saveSeat("");
      this.notice = "ঘরের সংযোগ শেষ হয়েছে। আবার যোগ দিতে পারেন।";
      this.emit();
    });
  }
  static async enter(mode: "create" | "join" | "reconnect", options?: { name: string; look: number; scarf: boolean; code: string; profile: OnlineProfile }) {
    const client = new Client(location.origin);
    try {
      if (mode === "reconnect") return new PartyClient(await client.reconnect(storedSeat()));
      if (!options || !onlineName(options.name)) throw new Error("বাংলায় একটি নাম লিখুন।");
      if (mode === "join" && !invitePattern.test(options.code)) throw new Error("ঘরের ছয় অক্ষরের পরিচয় দিন।");
      const payload = { token: options.profile.token, name: options.name, look: options.look, scarf: options.scarf };
      return new PartyClient(await (mode === "create" ? client.create(roomType, payload) : client.joinById(options.code, payload)));
    } catch (error) {
      if (mode === "reconnect") saveSeat("");
      throw new Error(safeError(error), { cause: error });
    }
  }
  get id() { return this.room.sessionId; }
  get me() { return this.snapshot?.players[this.id]; }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { for (const fn of this.listeners) fn(); }
  start() { if (this.status === "connected") this.room.send("start"); }
  friendly(value: boolean) { if (this.status === "connected") this.room.send("friendly", value); }
  pickup() { if (this.status === "connected") this.room.send("pickup"); }
  use(item: Item) { if (this.status === "connected") this.room.send("use", item); }
  leave() {
    saveSeat("");
    this.status = "closed";
    void this.room.leave().catch(() => {});
  }
  move(dt: number, x: number, z: number, yaw: number, run: boolean) {
    if (!this.me || !this.predicted || this.status !== "connected" || this.snapshot?.phase !== "playing") return this.me;
    this.sampleTime += dt;
    if (this.sampleTime < networkStep) return this.predicted;
    this.sampleTime = Math.min(networkStep, this.sampleTime - networkStep);
    if (this.pending.length >= 40) return this.predicted;
    const input: StreetInput = { seq: ++this.sequence, x: Math.max(-1, Math.min(1, x)), z: Math.max(-1, Math.min(1, z)), yaw: streetYaw(yaw), run };
    this.pending.push(input);
    this.predicted = stepStreet(this.predicted, input);
    this.room.send("input", input);
    return this.predicted;
  }
}
