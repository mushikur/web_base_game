import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "@colyseus/sdk";

const origin = "http://127.0.0.1:4320";
const profile = async (body) => {
  const response = await fetch(origin + "/api/online/profile", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  return response.json();
};
const register = async (room) => {
  const seat = { room, current: undefined, sequence: 0, reward: false };
  room.onMessage("street", (state) => { seat.current = state; });
  room.onMessage("notice", () => {});
  room.onMessage("reward", () => { seat.reward = true; });
  return seat;
};
const until = async (condition, description, attempts = 100) => {
  for (let i = 0; i < attempts; i++) {
    if (condition()) return;
    await delay(55);
  }
  assert.fail(description);
};
const player = (seat) => seat.current?.players[seat.room.sessionId];
const pose = (seat, x, z, yaw = 0) => {
  seat.room.send("input", { seq: ++seat.sequence, x, z, yaw, run: true });
};
async function walk(seat, x, z) {
  await until(() => {
    const p = player(seat);
    if (!p) return false;
    const dx = x - p.x, dz = z - p.z;
    if (Math.hypot(dx, dz) < 0.18) return true;
    const scale = Math.max(0.25, Math.hypot(dx, dz));
    pose(seat, dx / scale, dz / scale);
  }, `walking to ${x},${z}`, 220);
}
async function fire(seat, item) {
  const leader = seat.current.targets.leader, p = player(seat);
  pose(seat, 0, 0, Math.atan2(leader.x - p.x, leader.z - p.z));
  await until(() => player(seat).ack === seat.sequence, "aim");
  const score = player(seat).score;
  seat.room.send("use", item);
  await until(() => player(seat).score > score, "server-confirmed hit");
  await delay(550);
}

const inviter = await profile({});
const invitee = await profile({ referral: inviter.code });
assert.equal(invitee.pending, true);
const client = new Client(origin);
const host = await register(await client.create("dhaka-street", { token: inviter.token, look: 0, name: "পথের আয়োজক" }));
const friend = await register(await client.joinById(host.room.roomId, { token: invitee.token, look: 1, name: "পথের বন্ধু" }));
try {
  host.room.send("start");
  await until(() => friend.current?.phase === "playing", "playing");
  await Promise.all([walk(host, -1.4, -6.3), walk(friend, 1.25, -4)]);
  host.room.send("pickup");
  friend.room.send("pickup");
  await until(() => player(host).inventory.egg === 6 && player(friend).inventory.sandal === 6, "shared items");
  await Promise.all([walk(host, 1.75, 8.5), walk(friend, 2.05, 8.65)]);
  // Exercise the minimum participation gate with time to spare on a busy QA host.
  await delay(8500);
  await fire(host, "egg");
  await fire(friend, "sandal");
  await fire(host, "egg");
  await fire(friend, "sandal");
  await until(() => host.current?.phase === "won" && friend.current?.phase === "won", "shared victory");
  await until(() => host.reward && friend.reward, "both reward notices");
  const [afterHost, afterFriend] = await Promise.all([profile({ token: inviter.token }), profile({ token: invitee.token })]);
  assert.equal(afterHost.scarf, true);
  assert.equal(afterFriend.scarf, true);
  assert.equal(afterFriend.pending, false);
  assert.equal(host.current.score, friend.current.score);
  assert.equal(host.current.score, player(host).score + player(friend).score);
  console.log(JSON.stringify({
    phase: host.current.phase,
    hostScore: player(host).score,
    friendScore: player(friend).score,
    teamScore: host.current.score,
    bestCombo: host.current.bestCombo,
    bothRewardNotices: host.reward && friend.reward,
    bothRewardsStored: afterHost.scarf && afterFriend.scarf,
  }, null, 2));
} finally {
  await Promise.allSettled([host.room.leave(), friend.room.leave()]);
}
