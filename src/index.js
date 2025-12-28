// src/index.js

import { createHash } from "node:crypto";
import { createPatch } from "diff";

export function openDiffJournal(options = {}) {
  const { rootDir } = options;

  if (!rootDir) {
    throw new Error("openDiffJournal: 'rootDir' is required");
  }

  return {
    /**
     * Journal entry fields: seq, ts, file, actor, intent, base_hash, diff.
     */
    async append(change) {
      if (!change || typeof change !== "object") {
        throw new Error("append(): change object is required");
      }

      const { file, actor, intent, before, after } = change;

      if (!file || typeof file !== "string") {
        throw new Error("append(): 'file' must be a non-empty string");
      }

      if (typeof actor !== "string" || actor.length === 0) {
        throw new Error("append(): 'actor' must be a non-empty string");
      }

      if (typeof intent !== "string" || intent.length === 0) {
        throw new Error("append(): 'intent' must be a non-empty string");
      }

      if (typeof before !== "string") {
        throw new Error("append(): 'before' must be a string");
      }

      if (typeof after !== "string") {
        throw new Error("append(): 'after' must be a string");
      }

      const fs = await import("node:fs/promises");
      const path = await import("node:path");

      if (path.isAbsolute(file)) {
        throw new Error("append(): 'file' must be a relative path");
      }

      const journalPath = path.resolve(rootDir, `${file}.log`);
      const diff = createPatch(file, before, after, "", "");
      const baseHash = createHash("sha256").update(before).digest("hex");
      const seq = await nextSeq(fs, journalPath);
      const entry = {
        seq,
        ts: new Date().toISOString(),
        file,
        actor,
        intent,
        base_hash: baseHash,
        diff
      };

      await fs.mkdir(path.dirname(journalPath), { recursive: true });
      await fs.appendFile(journalPath, `${JSON.stringify(entry)}\n`, "utf8");
    },

    async materialize(file) {
      throw new Error("materialize() not implemented yet");
    },

    async rollback(file, { seq }) {
      throw new Error("rollback() not implemented yet");
    }
  };
}

async function nextSeq(fs, journalPath) {
  try {
    const data = await fs.readFile(journalPath, "utf8");
    if (!data) {
      return 1;
    }

    let count = 0;
    for (let i = 0; i < data.length; i += 1) {
      if (data[i] === "\n") {
        count += 1;
      }
    }

    return count + 1;
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return 1;
    }

    throw err;
  }
}
