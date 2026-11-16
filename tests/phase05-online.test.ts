import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { Client, type Room } from "@colyseus/sdk";
import { createApp } from "../apps/server/src/http.ts";
import { OnlineProfiles } from "../apps/server/src/onlineProfiles.ts";
import { StreetMatch } from "../apps/server/src/streetMatch.ts";
import { onlinePickups, roomType, streetHeight, type OnlineProfile, type StreetSnapshot } from "../packages/shared/src/online.ts";

const move = (seq: number) => ({ seq, x: 0, z: 1, yaw: 0, run: false });
const matchWithPair = () => {
  const match = new StreetMatch("TEST23");
  match.add("a", "আয়োজক", 0, false);
  assert.equal(match.start("a"), false);
  match.add("b", "বন্ধু", 1, false);
  assert.equal(match.start("b"), false);
  assert.equal(match.start("a"), true);
  return match;
};

test("authority ignores forged movement and score; one contested pickup and projectile hit", () => {
  const match = matchWithPair();
  const a = match.state.players.a, b = match.state.players.b;
  const z = a.z;
  match.input("a", { ...move(1), z: 1000 });
  match.tick();
  assert.equal(a.z, z);
  for (let i = 1; i <= 60; i++) match.input("a", { ...move(i), score: 99999 });
  match.tick();
  assert.ok(a.z > z && a.z - z < 0.12);
  assert.equal(a.ack, 60);
  assert.equal(match.state.score, 0);
  assert.equal(match.pickup("a"), undefined, "distant pickup");
  for (let i = 0; i < 7; i++) match.tick();
  Object.assign(a, onlinePickups.egg);
  Object.assign(b, onlinePickups.egg);
  assert.equal(match.pickup("a"), "egg");
  assert.equal(match.pickup("b"), undefined);
  assert.equal(match.state.pickups.egg, false);
  assert.equal(b.inventory.egg, 0);
  Object.assign(a, { x: 1.8, z: 8.5, y: streetHeight(1.8, 8.5), yaw: 0 });
  Object.assign(b, { x: 1.8, z: 9.4, y: streetHeight(1.8, 9.4) });
  assert.equal(match.use("a", "egg"), true);
  assert.equal(Object.keys(match.state.projectiles).length, 1);
  assert.equal(match.use("a", "egg"), false, "throw cooldown");
  for (let i = 0; i < 12; i++) match.tick();
  assert.equal(b.health, 100);
  assert.ok(match.state.targets.leader.health < 100);
  assert.ok(match.state.score > 0);
  assert.equal(match.state.score, a.score);
  assert.equal(match.state.score, a.score + b.score);
  match.remove("a");
  assert.equal(match.state.host, "b");
});

test("referral binds on registration and unlocks only once for two qualified profiles", async () => {
  const directory = await mkdtemp(join(tmpdir(), "neta-online-profiles-"));
  const profiles = new OnlineProfiles(directory);
  await profiles.init();
  const inviter = await profiles.profile(undefined, undefined, "one");
  const guest = await profiles.profile(undefined, inviter.code, "two");
  const a = profiles.find(inviter.token)!, b = profiles.find(guest.token)!;
  assert.equal(guest.pending, true);
  assert.equal(await profiles.reward([a.id, a.id]), undefined);
  assert.equal(await profiles.reward([b.id]), undefined);
  assert.deepEqual(await profiles.reward([a.id, b.id]), new Set([a.id, b.id]));
  assert.equal(await profiles.reward([a.id, b.id]), undefined);
  const reopened = new OnlineProfiles(directory);
  await reopened.init();
  assert.equal((await reopened.profile(inviter.token, undefined, "one")).scarf, true);
  assert.deepEqual(await reopened.profile(guest.token, undefined, "two"), { ...guest, scarf: true, pending: false });
});

test("private Colyseus seats, host authority, convergence at 120 ms, and socket reconnection", { timeout: 20000 }, async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "neta-online-ws-"));
  const { server, rooms } = await createApp({ root: process.cwd(), dataDirectory, testMode: true, online: true });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const client = new Client(url);
  const seats: Room[] = [];
  const current = new Map<Room, StreetSnapshot>();
  const waitFor = async (condition: () => unknown, detail: string) => {
    for (let i = 0; i < 150; i++) { if (condition()) return; await delay(30); }
    assert.fail(detail);
  };
  const track = (room: Room) => {
    seats.push(room);
    room.reconnection.minUptime = 0;
    room.onMessage("notice", () => {});
    room.onMessage("street", (value: StreetSnapshot) => current.set(room, value));
    return room;
  };
  const profile = async () => {
    const response = await fetch(url + "/api/online/profile", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    assert.equal(response.status, 200);
    return (await response.json() as OnlineProfile).token;
  };
  try {
    const token = await profile();
    const host = track(await client.create(roomType, { token, name: "আয়োজক", look: 0 }));
    await assert.rejects(client.joinById(host.roomId, { token, name: "একই পরিচয়", look: 1 }));
    const names = ["বন্ধু এক", "বন্ধু দুই", "বন্ধু তিন", "বন্ধু চার", "বন্ধু পাঁচ"];
    for (let i = 0; i < names.length; i++)
      track(await client.joinById(host.roomId, { token: await profile(), name: names[i], look: i + 1 }));
    await assert.rejects(client.joinById(host.roomId, { token: await profile(), name: "বন্ধু ছয়", look: 0 }));
    const guest = seats[1], guestId = guest.sessionId;
    await waitFor(() => Object.keys(current.get(host)?.players ?? {}).length === 6, "roster cap");
    guest.send("start");
    guest.send("friendly", true);
    await delay(300);
    assert.equal(current.get(host)?.phase, "lobby");
    assert.equal(current.get(host)?.friendly, false);
    host.send("start");
    await waitFor(() => current.get(guest)?.phase === "playing", "match start");
    rooms!.simulateLatency(120);
    const original = current.get(host)!.players[guestId].z;
    for (let seq = 1; seq <= 27; seq++) { guest.send("input", move(seq)); await delay(50); }
    await waitFor(() => current.get(host)?.players[guestId]?.ack === 27 && current.get(guest)?.players[guestId]?.ack === 27, "movement acknowledgement");
    assert.equal(current.get(host)?.players[guestId].z, current.get(guest)?.players[guestId].z);
    assert.ok(current.get(host)!.players[guestId].z > original + 2);
    guest.send("pickup");
    await waitFor(() => current.get(host)?.pickups.egg === false && current.get(guest)?.pickups.egg === false, "shared pickup");
    assert.ok(current.get(host)!.players[guestId].inventory.egg > 0);
    let disconnected = false;
    host.onMessage("street", (value: StreetSnapshot) => {
      current.set(host, value);
      disconnected ||= value.players[guestId]?.connected === false;
    });
    guest.connection.close(4010);
    await waitFor(() => disconnected, "server kept dropped seat");
    await waitFor(() => current.get(host)?.players[guestId]?.connected && current.get(guest)?.players[guestId]?.ack === 27, "same seat reconnected");
    await host.leave();
    seats.shift();
    await waitFor(() => current.get(guest)?.host === guestId, "host transferred");
  } finally {
    await Promise.race([Promise.allSettled(seats.map((room) => room.leave())), delay(1000, undefined, { ref: false })]);
    await rooms?.gracefullyShutdown(false);
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
