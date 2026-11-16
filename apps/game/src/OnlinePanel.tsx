import { useEffect, useState } from "react";
import { bn } from "@neta/shared";
import { onlineLooks, type OnlineProfile } from "../../../packages/shared/src/online";
import { onlineProfile, PartyClient, readOnlineOption, storedSeat } from "./onlineClient";
import type { DhakaGame } from "./game";

function shareLink(parameter: "room" | "ref", code: string) {
  const url = new URL("/", location.origin);
  url.searchParams.set(parameter, code);
  return url.toString();
}
function friendlyError(error: unknown) {
  return error instanceof Error && /\p{Script=Bengali}/u.test(error.message)
    ? error.message : "সার্ভারের সঙ্গে যোগাযোগ করা যায়নি। আবার চেষ্টা করুন।";
}
export function OnlinePanel({ game, playing, close }: { game: DhakaGame; playing: boolean; close(): void }) {
  const [party, setParty] = useState<PartyClient>();
  const [profile, setProfile] = useState<OnlineProfile>();
  const [name, setName] = useState("");
  const [look, setLook] = useState(0);
  const [scarf, setScarf] = useState(false);
  const [code, setCode] = useState(() => readOnlineOption("room"));
  const [referral, setReferral] = useState(() => readOnlineOption("ref"));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [, paint] = useState(0);
  useEffect(() => {
    if (!party) return;
    const update = () => {
      paint((value) => value + 1);
      if (party.status === "closed") game.endOnline(party);
      else if (party.snapshot && party.snapshot.phase !== "lobby") game.startOnline(party);
    };
    const unsubscribe = party.subscribe(update);
    update();
    return unsubscribe;
  }, [game, party]);
  async function connect(mode?: "create" | "join" | "reconnect") {
    setBusy(true);
    setNotice("");
    try {
      const current = await onlineProfile(referral || undefined);
      setProfile(current);
      if (mode) {
        setParty(await PartyClient.enter(mode, { name, look, scarf, code, profile: current }));
        setCode("");
      }
    } catch (error) { setNotice(friendlyError(error)); }
    finally { setBusy(false); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice("লিংক কপি হয়েছে।"); }
    catch { setNotice("নিচের লিংকটি নির্বাচন করে কপি করুন।"); }
  }
  if (playing) return null;
  const snapshot = party?.status !== "closed" ? party?.snapshot : undefined;
  const players = Object.entries(snapshot?.players ?? {});
  const host = snapshot?.host === party?.id;
  return <div className="modal-backdrop">
    <section className="dialog online-dialog" role="dialog" aria-modal="true" aria-labelledby="online-title">
      <header className="online-header">
        <div><p className="eyebrow">দুই থেকে ছয়জন • ব্যক্তিগত ঘর</p><h2 id="online-title">{snapshot ? "বন্ধুদের অপেক্ষায়" : "বন্ধুদের সঙ্গে খেলুন"}</h2></div>
        <button className="text-button" disabled={busy} onClick={() => { party?.leave(); close(); }}>বন্ধ করুন</button>
      </header>
      {(notice || party?.notice) && <p className="online-notice" role="status">{notice || party?.notice}</p>}
      {party?.status === "reconnecting" && <p role="status">আবার সংযোগ হচ্ছে… আপনার আসন রাখা আছে।</p>}
      {!snapshot ? <>
        {storedSeat() && !party && <button disabled={busy} onClick={() => void connect("reconnect")}>আগের ঘরে ফিরুন</button>}
        <div className="online-fields">
          <label>আপনার বাংলা নাম<input autoFocus value={name} maxLength={28} onChange={(e) => setName(e.target.value)} /></label>
          <label>পোশাক বাছুন<select value={look} onChange={(e) => setLook(Number(e.target.value))}>{onlineLooks.map((item, i) =>
            <option key={item.name} value={i}>{item.name}</option>)}</select></label>
          <label>ঘরের পরিচয়<input autoCapitalize="characters" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></label>
          {!profile && <label>বন্ধুর আমন্ত্রণ পরিচয় (ঐচ্ছিক)<input autoCapitalize="characters" maxLength={6}
            value={referral} onChange={(e) => setReferral(e.target.value.toUpperCase())} /></label>}
        </div>
        {profile?.scarf && <label className="online-check"><input type="checkbox" checked={scarf} onChange={(e) => setScarf(e.target.checked)} /> নকশাদার গামছা পরুন</label>}
        <div className="online-actions">
          <button className="primary" disabled={busy || !name.trim()} onClick={() => void connect("create")}>ঘর তৈরি করুন</button>
          <button disabled={busy || !name.trim() || code.length !== 6} onClick={() => void connect("join")}>ঘরে যোগ দিন</button>
          {!profile && <button disabled={busy} onClick={() => void connect()}>আমার আমন্ত্রণ পরিচয়</button>}
        </div>
      </> : <>
        <div className="online-code"><span>ঘরের পরিচয়</span><strong>{snapshot.code}</strong></div>
        <div className="online-share">
          <input readOnly aria-label="ঘরে যোগ দেওয়ার লিংক" value={shareLink("room", snapshot.code)} />
          <button onClick={() => void copy(shareLink("room", snapshot.code))}>ঘরের লিংক কপি করুন</button>
        </div>
        <h3>খেলোয়াড় • {bn(players.length)} / ৬</h3>
        <ul className="online-players">{players.map(([id, player]) => <li key={id}>
          <span><i style={{ background: onlineLooks[player.look].color }} />{player.name}</span>
          <small>{id === snapshot.host ? "আয়োজক" : onlineLooks[player.look].name}{!player.connected && " • সংযোগ ফিরছে"}</small>
        </li>)}</ul>
        {host ? <>
          <label className="online-check"><input type="checkbox" checked={snapshot.friendly} onChange={(e) => party?.friendly(e.target.checked)} /> বন্ধুদের গায়ে লাগতে পারে</label>
          <button className="primary" disabled={players.filter(([, p]) => p.connected).length < 2} onClick={() => party?.start()}>দলের খেলা শুরু করুন</button>
        </> : <p>আয়োজক খেলা শুরু করলে সবাই গলিতে নামবেন।</p>}
      </>}
      {profile && <div className="online-referral">
        <strong>আমার আমন্ত্রণ পরিচয় • {profile.code}</strong>
        <p>{profile.scarf ? "নকশাদার গামছা খুলেছে।" : "নতুন বন্ধুর সঙ্গে অভিযান জিতুন। দুজন সক্রিয়ভাবে খেললে নকশাদার গামছা খুলবে।"}</p>
        <div className="online-share">
          <input readOnly aria-label="বন্ধুকে আমন্ত্রণের লিংক" value={shareLink("ref", profile.code)} />
          <button onClick={() => void copy(shareLink("ref", profile.code))}>আমন্ত্রণের লিংক কপি করুন</button>
        </div>
      </div>}
    </section>
  </div>;
}
