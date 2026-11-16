import fs from "node:fs";
const p = "apps/game/src/world.ts";
let s = fs.readFileSync(p, "utf8");
if (s.includes('from "./vehicles"')) {
  console.log("World v2 module split already applied.");
  process.exit(0);
}
const a = s.indexOf("function vehicleHelpers("),
  b = s.indexOf("export function disposeMeshes");
if (a < 0 || b < a) throw Error("Unexpected world layout");
s = s.slice(0, a) + s.slice(b);
s = s.replace("  rickshawArt,", "  surfaceMaterial,");
s =
  'import {createRickshaw,createCNG,createBus} from "./vehicles";\nimport {addDhakaDetails} from "./sceneDetails";\n' +
  s;
const c = s.indexOf("  // A partially visible local bus"),
  d = s.indexOf("  // Small potted palms", c);
if (c < 0 || d < c) throw Error("Bus boundary absent");
s =
  s.slice(0, c) +
  "  createBus(scene,shadow,new Vector3(3.1,0,21.5),Math.PI);\n  obstacles.push({x:3.1,z:21.5,w:2.6,d:8.3,h:3.25});\n" +
  s.slice(d);
s = s.replace(
  "  scene.fogMode = Scene.FOGMODE_EXP2;",
  "  addDhakaDetails(scene,shadow);\n  obstacles.push({x:-7.2,z:-13.5,w:.45,d:.45,h:6},{x:7.2,z:11.7,w:.45,d:.45,h:6},{x:-.2,z:18.5,w:.7,d:10,h:1.3});\n  scene.fogMode = Scene.FOGMODE_EXP2;",
);
fs.writeFileSync(p, s);
