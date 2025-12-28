// src/index.js

import { createHash } from "node:crypto";
import { applyPatch, createPatch } from "diff";

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
      if (!file || typeof file !== "string") {
        throw new Error("materialize(): 'file' must be a non-empty string");
      }

      const fs = await import("node:fs/promises");
      const path = await import("node:path");

      if (path.isAbsolute(file)) {
        throw new Error("materialize(): 'file' must be a relative path");
      }

      const entries = await readJournalEntries(fs, path, rootDir, file);
      const content = applyEntries(entries, file, "materialize()");

      const targetPath = path.resolve(rootDir, file);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, "utf8");
    },

    async rollback(file, { seq }) {
      if (!file || typeof file !== "string") {
        throw new Error("rollback(): 'file' must be a non-empty string");
      }

      if (!Number.isFinite(seq) || seq <= 0) {
        throw new Error("rollback(): 'seq' must be a positive number");
      }

      const fs = await import("node:fs/promises");
      const path = await import("node:path");

      if (path.isAbsolute(file)) {
        throw new Error("rollback(): 'file' must be a relative path");
      }

      const entries = await readJournalEntries(fs, path, rootDir, file);
      const content = applyEntries(entries, file, "rollback()", seq);

      const targetPath = path.resolve(rootDir, file);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, "utf8");
    }
  };
}

async function readJournalEntries(fs, path, rootDir, file) {
  const journalPath = path.resolve(rootDir, `${file}.log`);
  let data = "";

  try {
    data = await fs.readFile(journalPath, "utf8");
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      throw err;
    }
  }

  return parseJournalEntries(data);
}

function applyEntries(entries, file, caller, maxSeq = Infinity) {
  const ordered = entries
    .filter((entry) => entry.seq <= maxSeq)
    .sort((a, b) => a.seq - b.seq);
  let content = "";

  for (const entry of ordered) {
    const next = applyPatch(content, entry.diff);
    if (next === false) {
      throw new Error(
        `${caller}: failed to apply patch for ${file} seq ${entry.seq}`
      );
    }
    content = next;
  }

  return content;
}

function parseJournalEntries(data) {
  if (!data) {
    return [];
  }

  const lines = data.split("\n");
  const entries = [];

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const entry = JSON.parse(line);
    if (typeof entry.seq !== "number") {
      throw new Error("materialize(): journal entry missing seq");
    }
    if (typeof entry.diff !== "string") {
      throw new Error("materialize(): journal entry missing diff");
    }
    entries.push(entry);
  }

  return entries;
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
