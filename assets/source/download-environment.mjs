import { mkdir, writeFile } from "node:fs/promises";
const name = "kloofendal_48d_partly_cloudy_puresky";
const headers = {
  "User-Agent": "Neta-Uthche-Art-Study/0.2 (local browser game)",
};
const response = await globalThis.fetch(
  `https://api.polyhaven.com/files/${name}`,
  {
    headers,
  },
);
if (!response.ok) throw new Error(`Poly Haven metadata ${response.status}`);
const files = await response.json();
const hdr = files.hdri?.["1k"]?.hdr ?? files.hdr?.["1k"]?.hdr;
if (!hdr?.url)
  throw new Error(`No 1k HDR entry; metadata keys ${Object.keys(files)}`);
const data = await globalThis.fetch(hdr.url, { headers });
if (!data.ok) throw new Error(`HDR download ${data.status}`);
await mkdir("public/assets/environment", { recursive: true });
await writeFile(
  "public/assets/environment/dhaka-daylight-sky-1k.hdr",
  Buffer.from(await data.arrayBuffer()),
);
await writeFile(
  "assets/source/generated/environment-provenance.json",
  JSON.stringify(
    {
      asset: name,
      authors: ["Greg Zaal", "Jarod Guest"],
      license: "CC0-1.0",
      source: `https://polyhaven.com/a/${name}`,
      licenseUrl: "https://polyhaven.com/license",
      download: hdr.url,
      metadata: hdr,
    },
    null,
    2,
  ),
);
console.log("Downloaded locally bundled CC0 1k HDR sky.");
