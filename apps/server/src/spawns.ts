import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  factorySpawnRegistry,
  parseSpawnRegistry,
  type SpawnRegistry,
} from "../../../packages/shared/src/spawns.ts";
import { ApiError } from "./content.ts";

/** Reserved independent namespace for G's future authenticated publication/history. */
export class SpawnStore {
  private registry?: SpawnRegistry;
  readonly directory: string;
  constructor(dataDirectory: string) {
    this.directory = join(dataDirectory, "spawn-content");
  }
  async init() {
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, "published.json");
    try {
      await readFile(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // Fully write a unique file, then atomically create the published name.
      // link() refuses an existing name: restart/concurrent startup never resets it.
      const temporary = join(this.directory, `seed-${randomUUID()}.json`);
      try {
        await writeFile(
          temporary,
          JSON.stringify(factorySpawnRegistry, null, 2),
          { flag: "wx", mode: 0o600 },
        );
        try {
          await link(temporary, path);
        } catch (linkError) {
          if ((linkError as NodeJS.ErrnoException).code !== "EEXIST")
            throw linkError;
        }
      } finally {
        await unlink(temporary).catch((cleanupError: NodeJS.ErrnoException) => {
          if (cleanupError.code !== "ENOENT") throw cleanupError;
        });
      }
    }
    try {
      this.registry = parseSpawnRegistry(
        JSON.parse(await readFile(path, "utf8")),
      );
    } catch {
      // Preserve invalid content for repair and keep unrelated audio service usable.
      this.registry = undefined;
    }
  }
  published(): SpawnRegistry {
    if (!this.registry)
      throw new ApiError(
        503,
        "নিরাপদ স্থানের প্রকাশনা পড়া যায়নি। আবার চেষ্টা করুন।",
      );
    return structuredClone(this.registry);
  }
}
