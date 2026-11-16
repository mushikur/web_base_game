import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createApp } from "./http.ts";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const directory = resolve(root, process.env.NETA_DATA_DIRECTORY ?? "var/game");
if (
  !directory.startsWith(resolve(root) + "\\") &&
  !directory.startsWith(resolve(root) + "/")
)
  throw new Error("Game data must remain inside this standalone workspace.");
const { server } = await createApp({
  root,
  dataDirectory: directory,
  testMode: process.env.NETA_TEST_MODE === "1",
  gameDirectory: process.env.NETA_GAME_DIRECTORY,
  adminDirectory: process.env.NETA_ADMIN_DIRECTORY,
  catalogMongo: process.env.NETA_CATALOG_MONGO,
  online: true,
});
const port = Number(process.env.NETA_PORT ?? 4300);
server.listen(port, "127.0.0.1", () =>
  console.log(
    `নেতা উঠছে! http://127.0.0.1:${port}/ — প্রশাসন http://127.0.0.1:${port}/admin/`,
  ),
);
server.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
