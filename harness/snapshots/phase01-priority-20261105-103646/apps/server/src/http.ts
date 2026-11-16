import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile, writeFile, stat, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, join, extname, sep } from "node:path";
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ContentStore, ApiError, bengali } from "./content.ts";
import { SpawnStore } from "./spawns.ts";
import type { AudioAsset } from "../../../packages/shared/src/audio.ts";
const derive = promisify(scrypt);
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".hdr": "application/octet-stream",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".txt": "text/plain; charset=utf-8",
};
async function bytes(req: IncomingMessage, max = 1_000_000) {
  let size = 0;
  const list: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new ApiError(413, "ফাইলটি অনুমোদিত সীমার চেয়ে বড়।");
    list.push(Buffer.from(chunk));
  }
  return Buffer.concat(list);
}
async function json(req: IncomingMessage) {
  try {
    return JSON.parse((await bytes(req)).toString()) as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "পাঠানো তথ্য সঠিক নয়।");
  }
}
function mp3Frame(data: Buffer, offset: number) {
  if (
    offset + 4 > data.length ||
    data[offset] !== 0xff ||
    (data[offset + 1] & 0xe0) !== 0xe0
  )
    return;
  const version = (data[offset + 1] >> 3) & 3,
    layer = (data[offset + 1] >> 1) & 3,
    bitrateIndex = data[offset + 2] >> 4,
    rateIndex = (data[offset + 2] >> 2) & 3;
  if (
    version === 1 ||
    layer !== 1 ||
    bitrateIndex === 0 ||
    bitrateIndex === 15 ||
    rateIndex === 3
  )
    return;
  const rates = [44100, 48000, 32000],
    bitrates =
      version === 3
        ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
        : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    sampleRate = rates[rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4),
    length =
      Math.floor(
        ((version === 3 ? 144000 : 72000) * bitrates[bitrateIndex]) /
          sampleRate,
      ) +
      ((data[offset + 2] >> 1) & 1);
  if (length < 4 || offset + length > data.length) return;
  return { length, version, sampleRate };
}
function validMp3(data: Buffer) {
  let offset = 0;
  if (data.toString("ascii", 0, 3) === "ID3") {
    if (
      data.length < 10 ||
      ![2, 3, 4].includes(data[3]) ||
      data.subarray(6, 10).some((byte) => (byte & 0x80) !== 0)
    )
      return false;
    const size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9];
    offset = 10 + size;
    if (offset > data.length) return false;
    if (
      data[3] === 4 &&
      data[5] & 0x10 &&
      data.toString("ascii", offset, offset + 3) === "3DI"
    )
      offset += 10;
  }
  let count = 0;
  let first: ReturnType<typeof mp3Frame>;
  while (offset < data.length) {
    if (
      count >= 2 &&
      data.length - offset === 128 &&
      data.toString("ascii", offset, offset + 3) === "TAG"
    )
      return true;
    // Some encoders pad the end of the stream. Never skip arbitrary leading junk.
    if (
      count >= 2 &&
      data.length - offset <= 4096 &&
      data.subarray(offset).every((byte) => byte === 0)
    )
      return true;
    const frame = mp3Frame(data, offset);
    if (
      !frame ||
      (first &&
        (frame.version !== first.version ||
          frame.sampleRate !== first.sampleRate))
    )
      return false;
    first ??= frame;
    count++;
    offset += frame.length;
  }
  return count >= 2;
}
export function audioFormat(data: Buffer, filename: string) {
  if (
    filename.length > 200 ||
    /[\\/]/.test(filename) ||
    filename.includes(String.fromCharCode(0))
  )
    throw new ApiError(400, "ফাইলের নাম সঠিক নয়।");
  const prefix = data.subarray(0, 16).toString("latin1").trimStart();
  if (
    prefix.startsWith("MZ") ||
    prefix.startsWith("ZM") ||
    prefix.startsWith("#!") ||
    prefix.startsWith("<") ||
    data.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) ||
    prefix.startsWith("PK")
  )
    throw new ApiError(
      400,
      "চালানো যায় এমন কোড বা আর্কাইভ অডিও হিসেবে দেওয়া যাবে না।",
    );
  const ext = extname(filename).toLowerCase();
  if (
    ext === ".wav" &&
    data.length >= 44 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WAVE"
  ) {
    let format = false,
      payload = false;
    for (let p = 12; p + 8 <= data.length;) {
      const id = data.toString("ascii", p, p + 4),
        size = data.readUInt32LE(p + 4);
      if (p + 8 + size > data.length)
        throw new ApiError(400, "অডিও ফাইলটি অসম্পূর্ণ।");
      if (id === "fmt " && size >= 16) {
        const type = data.readUInt16LE(p + 8),
          channels = data.readUInt16LE(p + 10),
          rate = data.readUInt32LE(p + 12);
        format =
          [1, 3].includes(type) &&
          channels >= 1 &&
          channels <= 2 &&
          rate >= 8000 &&
          rate <= 96000;
      }
      if (id === "data" && size > 0) payload = true;
      p += 8 + size + (size % 2);
    }
    if (format && payload) return { extension: ext, mime: "audio/wav" };
  }
  if (
    ext === ".ogg" &&
    data.toString("ascii", 0, 4) === "OggS" &&
    (data.subarray(0, 65536).includes(Buffer.from("OpusHead")) ||
      data.subarray(0, 65536).includes(Buffer.from("vorbis")))
  )
    return { extension: ext, mime: "audio/ogg" };
  if (ext === ".mp3" && validMp3(data))
    return { extension: ext, mime: "audio/mpeg" };
  throw new ApiError(400, "সঠিক WAV, MP3 বা OGG অডিও ফাইল দিন।");
}
export async function createApp(options: {
  root: string;
  dataDirectory: string;
  testMode?: boolean;
  gameDirectory?: string;
  adminDirectory?: string;
}) {
  const root = resolve(options.root);
  const staticDirectory = (directory: string) => {
    const result = resolve(root, directory);
    if (!result.startsWith(root + sep))
      throw new Error(
        "Game build must remain inside this standalone workspace.",
      );
    return result;
  };
  const gameDirectory = staticDirectory(
      options.gameDirectory ?? "apps/game/dist",
    ),
    adminDirectory = staticDirectory(
      options.adminDirectory ?? "apps/admin/dist",
    ),
    dataDirectory = resolve(options.dataDirectory),
    store = new ContentStore(dataDirectory, root),
    spawns = new SpawnStore(dataDirectory);
  await store.init();
  await spawns.init();
  await mkdir(dataDirectory, { recursive: true });
  const authPath = join(dataDirectory, "admin.json");
  let admin: { salt: string; hash: string } | undefined;
  try {
    admin = JSON.parse(await readFile(authPath, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  let settingUp = false;
  const sessions = new Map<string, number>(),
    attempts = new Map<string, { count: number; until: number }>();
  const authenticated = (req: IncomingMessage) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("neta_admin="))
      ?.slice(11);
    return !!token && (sessions.get(token) ?? 0) > Date.now();
  };
  const reply = (res: ServerResponse, status: number, data: unknown) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  async function serve(
    req: IncomingMessage,
    res: ServerResponse,
    file: string,
    privatePreview = false,
  ) {
    let info;
    try {
      info = await stat(file);
    } catch {
      throw new ApiError(404, "ফাইল পাওয়া যায়নি।");
    }
    if (!info.isFile()) throw new ApiError(404, "ফাইল পাওয়া যায়নি।");
    const type = mime[extname(file)] ?? "application/octet-stream";
    const headers: Record<string, string | number> = {
      "Content-Type": type,
      "Content-Length": info.size,
      "Accept-Ranges": "bytes",
      "Cache-Control": privatePreview
        ? "private, no-store"
        : file.includes(`${sep}uploads${sep}`)
          ? "public, max-age=31536000, immutable"
          : "no-cache",
    };
    if (privatePreview) headers.Vary = "Cookie";
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    let start = 0,
      end = info.size - 1;
    if (range) {
      start = Number(range[1]);
      end = range[2] ? Math.min(Number(range[2]), end) : end;
      if (start > end || start >= info.size) {
        res.writeHead(416, { "Content-Range": `bytes */${info.size}` });
        res.end();
        return;
      }
      headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
      headers["Content-Length"] = end - start + 1;
    }
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === "HEAD") res.end();
    else createReadStream(file, { start, end }).pipe(res);
  }
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    try {
      const host = req.headers.host ?? "";
      if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host))
        throw new ApiError(403, "এই ঠিকানায় প্রবেশ অনুমোদিত নয়।");
      if (
        !["GET", "HEAD"].includes(req.method ?? "GET") &&
        req.headers.origin &&
        new URL(req.headers.origin).host !== host
      )
        throw new ApiError(403, "অন্য সাইট থেকে পরিবর্তন করা যাবে না।");
      const url = new URL(req.url ?? "/", `http://${host}`),
        path = url.pathname,
        method = req.method ?? "GET";
      if (path === "/api/health")
        return reply(res, 200, { ok: true, testMode: !!options.testMode });
      if (path === "/api/content" && method === "GET")
        return reply(res, 200, store.state.published);
      if (path === "/api/spawns" && method === "GET")
        return reply(res, 200, spawns.published());
      if (path === "/api/admin/session" && method === "GET")
        return reply(res, 200, {
          setupRequired: !admin,
          authenticated: authenticated(req),
          testMode: !!options.testMode,
        });
      if (
        ["/api/admin/setup", "/api/admin/login"].includes(path) &&
        method === "POST"
      ) {
        const key = req.socket.remoteAddress ?? "local",
          now = Date.now();
        let attempt = attempts.get(key);
        if (!attempt || attempt.until < now) {
          attempt = { count: 0, until: now + 15 * 60_000 };
          attempts.set(key, attempt);
        }
        if (++attempt.count > 12)
          throw new ApiError(
            429,
            "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে চেষ্টা করুন।",
          );
        const body = await json(req),
          password = body.password;
        if (
          typeof password !== "string" ||
          password.length < 12 ||
          password.length > 128
        )
          throw new ApiError(400, "পাসওয়ার্ড ১২ থেকে ১২৮ অক্ষরের রাখুন।");
        if (path.endsWith("setup")) {
          if (admin || settingUp)
            throw new ApiError(409, "প্রশাসক আগেই তৈরি হয়েছে।");
          settingUp = true;
          try {
            const salt = randomBytes(24).toString("hex"),
              hash = ((await derive(password, salt, 64)) as Buffer).toString(
                "hex",
              );
            await writeFile(authPath, JSON.stringify({ salt, hash }), {
              flag: "wx",
              mode: 0o600,
            });
            admin = { salt, hash };
          } finally {
            settingUp = false;
          }
        } else {
          if (!admin) throw new ApiError(409, "আগে প্রথম প্রশাসক তৈরি করুন।");
          const result = (await derive(password, admin.salt, 64)) as Buffer;
          if (!timingSafeEqual(result, Buffer.from(admin.hash, "hex")))
            throw new ApiError(401, "পাসওয়ার্ড মেলেনি।");
        }
        const token = randomBytes(32).toString("hex");
        sessions.set(token, Date.now() + 12 * 60 * 60_000);
        res.setHeader(
          "Set-Cookie",
          `neta_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`,
        );
        return reply(res, 200, { ok: true });
      }
      if (path.startsWith("/api/admin/")) {
        if (!authenticated(req))
          throw new ApiError(401, "প্রশাসক হিসেবে প্রবেশ করুন।");
        if (path === "/api/admin/logout" && method === "POST") {
          const token = req.headers.cookie?.match(/neta_admin=([^;]+)/)?.[1];
          if (token) sessions.delete(token);
          res.setHeader(
            "Set-Cookie",
            "neta_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
          );
          return reply(res, 200, { ok: true });
        }
        if (path === "/api/admin/content" && method === "GET")
          return reply(res, 200, {
            draft: store.state.draft,
            publishedRevision: store.state.published.revision,
            history: store.state.history.map((h) => ({
              id: h.id,
              at: h.at,
              revision: h.content.revision,
            })),
            draftSnapshots: store.state.draftSnapshots.map((snapshot) => ({
              id: snapshot.id,
              at: snapshot.at,
              revision: snapshot.content.revision,
              reason: snapshot.reason,
            })),
            audit: store.state.audit.slice(-100),
          });
        if (path === "/api/admin/content" && method === "PUT") {
          const body = await json(req);
          return reply(
            res,
            200,
            await store.save(body.content, Number(body.revision)),
          );
        }
        if (path === "/api/admin/publish" && method === "POST") {
          const body = await json(req);
          return reply(res, 200, await store.publish(Number(body.revision)));
        }
        if (path === "/api/admin/rollback" && method === "POST") {
          const body = await json(req);
          return reply(
            res,
            200,
            await store.rollback(
              String(body.id),
              body.revision === undefined ? undefined : Number(body.revision),
            ),
          );
        }
        if (path === "/api/admin/restore-draft" && method === "POST") {
          const body = await json(req);
          return reply(
            res,
            200,
            await store.restoreDraft(String(body.id), Number(body.revision)),
          );
        }
        if (path === "/api/admin/assets/import-bundled" && method === "POST")
          return reply(res, 200, await store.importBundle());
        if (path === "/api/admin/assets" && method === "POST") {
          if (req.headers["x-audio-rights"] !== "confirmed")
            throw new ApiError(400, "অডিও ব্যবহারের অনুমতি নিশ্চিত করুন।");
          const name = bengali(url.searchParams.get("name"), "অডিওর নাম"),
            license = bengali(
              url.searchParams.get("license"),
              "ব্যবহারের অনুমতি",
              300,
            ),
            attribution = bengali(
              url.searchParams.get("attribution"),
              "উৎসের বিবরণ",
              300,
            ),
            originalName = url.searchParams.get("filename") ?? "";
          const data = await bytes(req, 16 * 1024 * 1024),
            format = audioFormat(data, originalName),
            id = randomUUID(),
            filename = `${id}${format.extension}`;
          await writeFile(join(dataDirectory, "uploads", filename), data, {
            flag: "wx",
          });
          const asset: AudioAsset = {
            id,
            name,
            url: `/uploads/${filename}`,
            mime: format.mime,
            bytes: data.length,
            license,
            attribution,
            originalName,
          };
          await store.mutate(() => {
            store.state.draft.assets.push(asset);
            store.state.draft.revision++;
            store.state.audit.push({
              at: new Date().toISOString(),
              action: `অডিও যোগ: ${name}`,
            });
          });
          return reply(res, 201, asset);
        }
        throw new ApiError(404, "এই ব্যবস্থা পাওয়া যায়নি।");
      }
      if (!["GET", "HEAD"].includes(method))
        throw new ApiError(405, "এই পদ্ধতি অনুমোদিত নয়।");
      if (path.startsWith("/uploads/")) {
        const filename = decodeURIComponent(path.slice(9));
        if (!/^[a-f0-9-]{36}\.(wav|mp3|ogg)$/.test(filename))
          throw new ApiError(404, "ফাইল পাওয়া যায়নি।");
        const published = store.state.published.assets.some(
          (a) => a.url === path,
        );
        if (!authenticated(req) && !published)
          throw new ApiError(404, "প্রকাশিত ফাইল পাওয়া যায়নি।");
        return await serve(
          req,
          res,
          join(dataDirectory, "uploads", filename),
          !published,
        );
      }
      const isAdmin = path === "/admin" || path.startsWith("/admin/"),
        base = isAdmin ? adminDirectory : gameDirectory,
        relative = decodeURIComponent(
          isAdmin ? path.replace(/^\/admin\/?/, "") : path.slice(1),
        );
      const file = resolve(base, relative || "index.html");
      if (file !== base && !file.startsWith(base + sep))
        throw new ApiError(403, "এই ফাইল খোলা যাবে না।");
      try {
        return await serve(req, res, file);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404 && !extname(relative))
          return await serve(req, res, join(base, "index.html"));
        throw e;
      }
    } catch (e) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (!(e instanceof ApiError)) console.error(e);
      reply(res, e instanceof ApiError ? e.status : 500, {
        error:
          e instanceof ApiError
            ? e.message
            : "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।",
      });
    }
  });
  return { server, store };
}
