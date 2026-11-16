// This page is served only on the isolated Phase 02 test origin.
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { missionCheckpointKey, newMatchMissions, reduceMission } from "../../../packages/shared/src/missions.ts";
import { worldAreas } from "../../../packages/shared/src/world-layout.ts";
import { newCombatRecord } from "../../../packages/shared/src/combat.ts";
import { tutorialPreferenceKey, tutorialVersion } from "../../../packages/shared/src/tutorial.ts";

const previewNews = process.argv.includes("--newspaper");
let state = newMatchMissions();
function send(area, event) {
  const result = reduceMission(state, { ...event, missionId: area.id, seq: state.sequence + 1 });
  if (!result.accepted) throw new Error(result.error);
  state = result.state;
}
for (const area of previewNews ? worldAreas : worldAreas.slice(1)) {
  send(area, { type: "select", routeReady: true });
  send(area, { type: "enter", position: area.entrance, sectorReady: true, tutorialSafe: false });
  for (let i = 0; i < 3; i++) {
    send(area, { type: "impact", projectileId: `fixture-${area.id}-${i}`,
      item: "sandal", target: "leader", observed: true, tutorialSafe: false });
  }
  send(area, { type: "ambulance-loaded", leaderLoaded: true, personnelSafe: true });
  send(area, { type: "ambulance-exited", position: area.ambulance.exit, doorsClosed: true });
}
if (!previewNews) send(worldAreas[0], { type: "select", routeReady: true });
const record = previewNews
  ? JSON.parse(readFileSync(new URL("./evacuation-start.json", import.meta.url), "utf8")).combat
  : newCombatRecord();
const checkpoint = {
  ...state,
  combat: { record, inventory: { egg: 12, sandal: 12, baton: 8, sound: 8, spark: 8 } },
};
const output = new URL(previewNews ? "./qa-news-dist/" : "./qa-dist/", import.meta.url);
cpSync(new URL("./game-dist/", import.meta.url), output, { recursive: true });
writeFileSync(new URL(previewNews ? "news-check.html" : "last-mission.html", output), `<!DOCTYPE html>
<html lang="bn-BD"><meta charset="utf-8"><title>শেষ এলাকার পরীক্ষার খেলা</title>
<p>${previewNews ? "সংবাদপত্রের লেআউট পরীক্ষার জন্য এই আলাদা সেভে পাঁচটি এলাকা শেষ করা আছে।" : "এই আলাদা পরীক্ষার খেলায় চারটি এলাকা আগে শেষ করা আছে। শেষ এলাকার কাজ খেলেই শেষ করতে হবে।"}</p>
<button id="start">পরীক্ষার খেলা প্রস্তুত করুন</button>
<script>
document.querySelector("#start").onclick = () => {
  localStorage.setItem(${JSON.stringify(missionCheckpointKey)}, ${JSON.stringify(JSON.stringify(checkpoint))});
  localStorage.setItem(${JSON.stringify(tutorialPreferenceKey)}, ${JSON.stringify(JSON.stringify({ version: tutorialVersion, completed: true, dontShowAgain: true }))});
  location.href = "/?qa=1&check=phase02-final-mission";
};
</script></html>`);
