import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import sharp from "sharp";
test("photo-led materials ship complete local PBR sets within the mobile download budget", async () => {
  let bytes = 0;
  for (const name of ["asphalt", "plaster", "cng-enamel", "rickshaw-art"])
    for (const kind of ["color", "normal", "orm"]) {
      const path = new URL(
          `../public/assets/textures/${name}-${kind}.webp`,
          import.meta.url,
        ),
        meta = await sharp(await readFile(path)).metadata(),
        size = kind === "color" ? 1024 : 512;
      assert.equal(meta.width, size);
      assert.equal(meta.height, size);
      assert.equal(meta.format, "webp");
      bytes += (await stat(path)).size;
    }
  assert.ok(bytes < 4_000_000, "local material maps must remain below 4 MB");
  const sky = await readFile(
    new URL(
      "../public/assets/environment/dhaka-daylight-sky-1k.hdr",
      import.meta.url,
    ),
  );
  assert.ok(sky.subarray(0, 20).toString().startsWith("#?RADIANCE"));
  assert.ok(sky.length < 2_000_000);
});
