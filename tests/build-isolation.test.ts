import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../apps/server/src/http.ts";

test("accepted build stays isolated from new preview writes and cannot expose outside files", async () => {
  const root = await mkdtemp(join(tmpdir(), "neta-build-isolation-"));
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    await assert.rejects(() =>
      createApp({
        root,
        dataDirectory: join(root, "data"),
        gameDirectory: "../",
      }),
    );
    await mkdir(join(root, "accepted"));
    await mkdir(join(root, "apps/game/dist"), { recursive: true });
    await writeFile(join(root, "accepted/index.html"), "যাচাই করা গেম");
    await writeFile(join(root, "apps/game/dist/index.html"), "নতুন পরীক্ষা");
    await mkdir(join(root, "public/assets/audio"), { recursive: true });
    await writeFile(
      join(root, "public/assets/audio/catalog.json"),
      await readFile(
        new URL("../public/assets/audio/catalog.json", import.meta.url),
      ),
    );
    app = await createApp({
      root,
      dataDirectory: join(root, "data"),
      gameDirectory: "accepted",
    });
    await new Promise<void>((done) => app!.server.listen(0, "127.0.0.1", done));
    const address = app.server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    assert.equal(await (await fetch(base)).text(), "যাচাই করা গেম");
    await writeFile(join(root, "apps/game/dist/index.html"), "পরের সংস্করণ");
    assert.equal(await (await fetch(base)).text(), "যাচাই করা গেম");
    assert.equal((await fetch(base + "/package.json")).status, 404);
    assert.equal((await fetch(base + "/api/content")).status, 200);
  } finally {
    if (app)
      await new Promise<void>((done, reject) =>
        app!.server.close((e) => (e ? reject(e) : done())),
      );
    await rm(root, { recursive: true, force: true });
  }
});
