import type { IncomingMessage, Server as HttpServer, ServerResponse } from "node:http";
import { Room, Server, ServerError, matchMaker, type Client } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { invitePattern, onlineLooks, onlineName, reconnectSeconds, roomType } from "../../../packages/shared/src/online.ts";
import { newInvite, type OnlineProfiles } from "./onlineProfiles.ts";
import { StreetMatch } from "./streetMatch.ts";

const invalid = (message: string) => new ServerError(4210, message);
const authorizedHost = (req: IncomingMessage) => {
  const host = req.headers.host;
  return !!host && /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host) &&
    (!req.headers.origin || [`http://${host}`, `https://${host}`].includes(req.headers.origin));
};
type JoinOptions = { token?: string; name?: string; look?: number; scarf?: boolean };
function rooms(profiles: OnlineProfiles) {
  const codes = new Set<string>(), occupants = new Set<string>();
  function authenticate(options: JoinOptions) {
    const profile = profiles.find(options.token);
    const name = onlineName(options.name), look = options.look;
    if (!profile) throw invalid("আগে খেলোয়াড় পরিচয় তৈরি করুন।");
    if (!name || typeof look !== "number" || !Number.isInteger(look) || look < 0 || look >= onlineLooks.length)
      throw invalid("বাংলা নাম লিখে পোশাক বাছুন।");
    if (occupants.has(profile.id)) throw invalid("এই পরিচয় দিয়ে একটি ঘরে খেলা চলছে।");
    return { id: profile.id, name, look, scarf: options.scarf === true && profile.scarf };
  }
  type Auth = ReturnType<typeof authenticate>;
  return class StreetRoom extends Room {
    maxClients = 6;
    maxMessagesPerSecond = 50;
    seatReservationTimeout = 10;
    private match!: StreetMatch;
    private identities = new Map<string, string>();
    private ticks = 0;
    private rewarded = 0;

    static async onAuth(_token: string, options: JoinOptions) { return authenticate(options); }
    async onCreate(options: JoinOptions) {
      authenticate(options);
      if (codes.size >= 40) throw invalid("এখন নতুন ঘরের জায়গা নেই।");
      let code: string;
      do { code = newInvite(); } while (codes.has(code));
      codes.add(code);
      this.roomId = code;
      this.match = new StreetMatch(code);
      await this.setPrivate(true);
      this.onMessage("input", (client, input: unknown) => this.match.input(client.sessionId, input));
      this.onMessage("pickup", (client) => this.match.pickup(client.sessionId));
      this.onMessage("use", (client, item: unknown) => this.match.use(client.sessionId, item));
      this.onMessage("friendly", (client, value: unknown) => {
        if (client.sessionId === this.match.state.host && this.match.state.phase !== "playing" && typeof value === "boolean")
          this.match.state.friendly = value;
      });
      this.onMessage("start", (client) => {
        if (this.match.start(client.sessionId)) void this.lock();
        else client.send("notice", "খেলা শুরুর জন্য আয়োজক ও অন্তত দুইজন সংযুক্ত খেলোয়াড় প্রয়োজন।");
      });
      this.onMessage("*", () => {});
      this.setSimulationInterval(() => this.tick(), 50);
    }
    onJoin(client: Client, _options: JoinOptions, auth: Auth) {
      if (this.match.state.phase !== "lobby") throw invalid("এই ঘরের খেলা শুরু হয়ে গেছে।");
      if (!auth || occupants.has(auth.id)) throw invalid("এই পরিচয় দিয়ে একটি ঘরে খেলা চলছে।");
      if (Object.values(this.match.state.players).some((p) => p.look === auth.look))
        throw invalid("এই পোশাকটি নেওয়া হয়েছে। অন্যটি বাছুন।");
      if (Object.values(this.match.state.players).some((p) => p.name === auth.name))
        throw invalid("এই নামটি নেওয়া হয়েছে। অন্য নাম লিখুন।");
      this.identities.set(client.sessionId, auth.id);
      occupants.add(auth.id);
      this.match.add(client.sessionId, auth.name, auth.look, auth.scarf);
    }
    onDrop(client: Client) {
      this.match.connect(client.sessionId, false);
      return this.allowReconnection(client, reconnectSeconds).catch(() => {});
    }
    onReconnect(client: Client) { this.match.connect(client.sessionId, true); }
    onLeave(client: Client) {
      const id = this.identities.get(client.sessionId);
      if (!id) return;
      occupants.delete(id);
      this.identities.delete(client.sessionId);
      this.match.remove(client.sessionId);
    }
    onDispose() {
      codes.delete(this.roomId);
      for (const id of this.identities.values()) occupants.delete(id);
    }
    private tick() {
      const { state } = this.match;
      this.match.tick();
      if (state.phase === "playing" || ++this.ticks % 4 === 0) this.broadcast("street", state);
      if (state.phase !== "won" || state.round === this.rewarded) return;
      this.rewarded = state.round;
      const qualified = this.match.qualified().flatMap((sid) => {
        const id = this.identities.get(sid);
        return id ? [id] : [];
      });
      if (qualified.length < 2) return;
      void profiles.reward(qualified).then((unlocked) => {
        if (!unlocked) return;
        for (const client of this.clients) {
          const id = this.identities.get(client.sessionId);
          if (id && unlocked.has(id)) client.send("reward", "আমন্ত্রণের পুরস্কার • নকশাদার গামছা খুলেছে।");
        }
      }).catch(() => {
        for (const client of this.clients) client.send("notice", "পুরস্কার রাখা যায়নি। পরে আবার চেষ্টা করুন।");
      });
    }
  };
}

export async function attachStreetRooms(server: HttpServer, profiles: OnlineProfiles) {
  const listeners = server.listeners("request") as ((req: IncomingMessage, res: ServerResponse) => void)[];
  server.removeAllListeners("request");
  const transport = new WebSocketTransport({
    server,
    maxPayload: 2048,
    verifyClient: ({ req }: { req: IncomingMessage }) => authorizedHost(req) && /\/[A-HJ-NP-Z2-9]{6}(?:\?|$)/.test(req.url ?? ""),
  });
  const runtime = new Server({ transport, greet: false, gracefullyShutdown: false });
  runtime.define(roomType, rooms(profiles));
  await runtime.serverless();
  server.removeAllListeners("request");
  const rates = new Map<string, { until: number; count: number }>();
  const fail = (res: ServerResponse, status: number, error: string, code = status) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ code, error }));
  };
  server.on("request", (req, res) => {
    const path = req.url?.split("?")[0] ?? "/";
    if (!path.startsWith("/matchmake/")) {
      for (const handler of listeners) handler.call(server, req, res);
      return;
    }
    if (!authorizedHost(req)) return fail(res, 403, "এই ঠিকানায় যোগ দেওয়া যাবে না।");
    const size = Number(req.headers["content-length"]);
    if (req.method !== "POST" || !Number.isInteger(size) || size < 0 || size > 2048 || req.headers["transfer-encoding"])
      return fail(res, 400, "ঘরের অনুরোধ সঠিক নয়।");
    const route = /^\/matchmake\/(create|joinById|reconnect)\/([^/]+)$/.exec(path);
    if (!route || (route[1] === "create" ? route[2] !== roomType : !invitePattern.test(route[2])))
      return fail(res, 404, "ব্যক্তিগত ঘরের পরিচয় দিন।");
    const now = Date.now(), address = req.socket.remoteAddress ?? "local";
    let rate = rates.get(address);
    if (!rate || rate.until <= now) { rate = { until: now + 60_000, count: 0 }; rates.set(address, rate); }
    if (++rate.count > 80) return fail(res, 429, "অনেকবার চেষ্টা হয়েছে। একটু পরে আবার চেষ্টা করুন।");
    void (async () => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        if (!body || typeof body !== "object" || Array.isArray(body))
          return fail(res, 400, "ঘরের অনুরোধ সঠিক নয়।");
        const context = { ip: address, headers: new Headers(Object.entries(req.headers).flatMap(([key, value]) =>
          typeof value === "string" ? [[key, value] as [string, string]] : [])) };
        const [method, key] = route.slice(1);
        const seat = method === "create" ? await matchMaker.create(key, body, context)
          : method === "joinById" ? await matchMaker.joinById(key, body, context)
          : await matchMaker.reconnect(key, body);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify(seat));
      } catch (error) {
        if (error instanceof SyntaxError) return fail(res, 400, "ঘরের অনুরোধ সঠিক নয়।");
        const message = error instanceof Error && /\p{Script=Bengali}/u.test(error.message)
          ? error.message : "ঘরটি পাওয়া যায়নি, ভরে গেছে অথবা খেলা শুরু হয়েছে।";
        // Colyseus application codes are not HTTP statuses.
        return fail(res, 409, message, error instanceof ServerError ? error.code : 409);
      }
    })();
  });
  return runtime;
}
