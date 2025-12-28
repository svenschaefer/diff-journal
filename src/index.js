// src/index.js

import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { applyPatch, createPatch } from "diff";

class InvalidInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidInputError";
  }
}

class CorruptedJournalError extends Error {
  constructor(message) {
    super(message);
    this.name = "CorruptedJournalError";
  }
}

class PatchApplicationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PatchApplicationError";
  }
}

class StrictReplayMismatchError extends Error {
  constructor(message) {
    super(message);
    this.name = "StrictReplayMismatchError";
  }
}

export function openDiffJournal(options = {}) {
  const {
    rootDir,
    journalDir = ".journal",
    strictReplay = false,
    snapshots = false
  } = options;

  if (!rootDir) {
    throw new InvalidInputError("openDiffJournal(): rootDir is required");
  }

  if (!journalDir || typeof journalDir !== "string") {
    throw new InvalidInputError(
      "openDiffJournal(): journalDir must be a non-empty string"
    );
  }

  if (typeof strictReplay !== "boolean") {
    throw new InvalidInputError(
      "openDiffJournal(): strictReplay must be a boolean"
    );
  }

  if (typeof snapshots !== "boolean") {
    throw new InvalidInputError(
      "openDiffJournal(): snapshots must be a boolean"
    );
  }

  const journalRoot = resolveJournalRoot(rootDir, journalDir);

  return {
    /**
     * Journal entry fields: seq, ts, file, actor, intent, base_hash, diff.
     */
    async append(change) {
      if (!change || typeof change !== "object") {
        throw new InvalidInputError("append(): change object is required");
      }

      const { file, actor, intent, before, after } = change;

      if (!file || typeof file !== "string") {
        throw new InvalidInputError("append(): file must be a non-empty string");
      }

      if (typeof actor !== "string" || actor.length === 0) {
        throw new InvalidInputError("append(): actor must be a non-empty string");
      }

      if (typeof intent !== "string" || intent.length === 0) {
        throw new InvalidInputError(
          "append(): intent must be a non-empty string"
        );
      }

      if (typeof before !== "string") {
        throw new InvalidInputError("append(): before must be a string");
      }

      if (typeof after !== "string") {
        throw new InvalidInputError("append(): after must be a string");
      }

      assertSafeFilePath(rootDir, journalRoot, file, "append()");

      const journalPath = path.join(journalRoot, `${file}.log`);
      const journalDirPath = path.dirname(journalPath);
      try {
        await fs.mkdir(journalDirPath, { recursive: true });
      } catch (err) {
        throw new InvalidInputError(
          `append(): failed to create journal directory for ${file}`
        );
      }

      const lockPath = `${journalPath}.lock`;
      const lockHandle = await acquireLock(
        lockPath,
        50,
        50,
        file,
        journalPath
      );

      let appendError;
      try {
        const diff = createPatch(file, before, after, "", "");
        const baseHash = createHash("sha256").update(before).digest("hex");
        const seq = await nextSeq(journalPath);
        const entry = {
          seq,
          ts: new Date().toISOString(),
          file,
          actor,
          intent,
          base_hash: baseHash,
          diff
        };

        await fs.appendFile(journalPath, `${JSON.stringify(entry)}\n`, "utf8");
        await updateSeqCache(journalPath, seq);
      } catch (err) {
        appendError = err;
        throw err;
      } finally {
        try {
          await releaseLock(lockHandle, lockPath);
        } catch (err) {
          if (!appendError) {
            throw err;
          }
        }
      }
    },

    async materialize(file) {
      if (!file || typeof file !== "string") {
        throw new InvalidInputError(
          "materialize(): file must be a non-empty string"
        );
      }

      assertSafeFilePath(rootDir, journalRoot, file, "materialize()");

      const journalPath = path.join(journalRoot, `${file}.log`);
      await assertNoAppendLock("materialize()", file, journalPath);
      const entries = await readJournalEntries(journalRoot, file, "materialize()");
      const content = applyEntries(entries, file, "materialize()", Infinity, {
        strictReplay
      });

      const targetPath = path.resolve(rootDir, file);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      if (snapshots) {
        await writeSnapshotIfNeeded(targetPath, file, "materialize()");
      }
      await fs.writeFile(targetPath, content, "utf8");
    },

    async rollback(file, { seq }) {
      if (!file || typeof file !== "string") {
        throw new InvalidInputError("rollback(): file must be a non-empty string");
      }

      if (!Number.isFinite(seq) || seq <= 0) {
        throw new InvalidInputError("rollback(): seq must be a positive number");
      }

      assertSafeFilePath(rootDir, journalRoot, file, "rollback()");

      const journalPath = path.join(journalRoot, `${file}.log`);
      await assertNoAppendLock("rollback()", file, journalPath);
      const entries = await readJournalEntries(journalRoot, file, "rollback()");
      const content = applyEntries(entries, file, "rollback()", seq, {
        strictReplay
      });

      const targetPath = path.resolve(rootDir, file);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      if (snapshots) {
        await writeSnapshotIfNeeded(targetPath, file, "rollback()");
      }
      await fs.writeFile(targetPath, content, "utf8");
    },

    async exists(file) {
      if (!file || typeof file !== "string") {
        throw new InvalidInputError("exists(): file must be a non-empty string");
      }

      assertSafeFilePath(rootDir, journalRoot, file, "exists()");

      const journalPath = path.join(journalRoot, `${file}.log`);
      try {
        await fs.access(journalPath);
        return true;
      } catch (err) {
        if (err && err.code === "ENOENT") {
          return false;
        }
        throw new CorruptedJournalError(
          `exists(): failed to access journal for ${file}`
        );
      }
    },

    async inspect(file) {
      if (!file || typeof file !== "string") {
        throw new InvalidInputError("inspect(): file must be a non-empty string");
      }

      assertSafeFilePath(rootDir, journalRoot, file, "inspect()");

      const journalPath = path.join(journalRoot, `${file}.log`);
      let data;
      try {
        data = await fs.readFile(journalPath, "utf8");
      } catch (err) {
        if (err && err.code === "ENOENT") {
          return { exists: false, count: 0, minSeq: null, maxSeq: null };
        }
        throw new CorruptedJournalError(
          `inspect(): failed to read journal for ${file}`
        );
      }

      const lines = data.split("\n");
      let count = 0;
      let minSeq = null;
      let maxSeq = null;

      for (const line of lines) {
        if (!line) {
          continue;
        }
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }
        const seq = entry && entry.seq;
        if (!Number.isInteger(seq) || seq <= 0) {
          continue;
        }
        count += 1;
        if (minSeq === null || seq < minSeq) {
          minSeq = seq;
        }
        if (maxSeq === null || seq > maxSeq) {
          maxSeq = seq;
        }
      }

      return { exists: true, count, minSeq, maxSeq };
    }
  };
}

function resolveJournalRoot(rootDir, journalDir) {
  if (path.isAbsolute(journalDir)) {
    throw new InvalidInputError(
      "openDiffJournal(): journalDir must be a relative path"
    );
  }

  if (hasDotDotSegment(journalDir)) {
    throw new InvalidInputError(
      "openDiffJournal(): journalDir must not contain '..'"
    );
  }

  return path.resolve(rootDir, journalDir);
}

function assertSafeFilePath(rootDir, journalRoot, file, caller) {
  if (path.isAbsolute(file)) {
    throw new InvalidInputError(`${caller}: file must be a relative path`);
  }

  if (hasDotDotSegment(file)) {
    throw new InvalidInputError(`${caller}: file must not contain '..'`);
  }

  const materializedPath = path.resolve(rootDir, file);
  if (isWithinDir(journalRoot, materializedPath)) {
    throw new InvalidInputError(
      `${caller}: file must not be under the journal directory`
    );
  }
}

function hasDotDotSegment(value) {
  return value.split(/[\\/]+/).includes("..");
}

function isWithinDir(parent, target) {
  const rel = path.relative(parent, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

async function readJournalEntries(journalRoot, file, caller) {
  const journalPath = path.join(journalRoot, `${file}.log`);
  let data = "";

  try {
    data = await fs.readFile(journalPath, "utf8");
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      throw err;
    }
  }

  return parseJournalEntries(data, file, caller);
}

function applyEntries(entries, file, caller, maxSeq = Infinity, options = {}) {
  const { strictReplay = false } = options;
  const filtered = entries.filter((entry) => entry.seq <= maxSeq);
  validateSeqs(filtered, file, caller);
  const ordered = filtered.sort((a, b) => a.seq - b.seq);
  validateOrderedSeqs(ordered, file, caller);
  let content = "";

  for (const entry of ordered) {
    if (strictReplay) {
      const actualHash = createHash("sha256").update(content).digest("hex");
      if (actualHash !== entry.base_hash) {
        throw new StrictReplayMismatchError(
          `${caller}: base_hash mismatch for ${file} seq ${entry.seq} expected ${entry.base_hash} actual ${actualHash}`
        );
      }
    }

    const next = applyPatch(content, entry.diff);
    if (next === false) {
      throw new PatchApplicationError(
        `${caller}: failed to apply patch for ${file} seq ${entry.seq}`
      );
    }
    content = next;
  }

  return content;
}

function validateSeqs(entries, file, caller) {
  const seen = new Set();

  for (const entry of entries) {
    const seq = entry.seq;
    if (!Number.isFinite(seq) || !Number.isInteger(seq) || seq <= 0) {
      throw new CorruptedJournalError(
        `${caller}: invalid seq for ${file} value ${String(seq)}`
      );
    }

    if (seen.has(seq)) {
      throw new CorruptedJournalError(
        `${caller}: duplicate seq for ${file} value ${seq}`
      );
    }
    seen.add(seq);
  }
}

function validateOrderedSeqs(ordered, file, caller) {
  if (ordered.length === 0) {
    return;
  }

  let expected = 1;
  for (const entry of ordered) {
    if (entry.seq !== expected) {
      throw new CorruptedJournalError(
        `${caller}: expected seq ${expected} for ${file} but got ${entry.seq}`
      );
    }
    expected += 1;
  }
}

function parseJournalEntries(data, file, caller) {
  if (!data) {
    return [];
  }

  const lines = data.split("\n");
  const entries = [];

  for (const line of lines) {
    if (!line) {
      continue;
    }

    let entry;
    try {
      entry = JSON.parse(line);
    } catch (err) {
      throw new CorruptedJournalError(
        `${caller}: malformed journal entry for ${file}`
      );
    }
    if (typeof entry.seq !== "number") {
      throw new CorruptedJournalError(
        `${caller}: journal entry missing seq for ${file}`
      );
    }
    if (typeof entry.diff !== "string") {
      throw new CorruptedJournalError(
        `${caller}: journal entry missing diff for ${file}`
      );
    }
    entries.push(entry);
  }

  return entries;
}

async function nextSeq(journalPath) {
  const seqCachePath = `${journalPath}.seq`;
  const cached = await readSeqCache(seqCachePath);
  if (cached !== null) {
    return cached + 1;
  }

  const maxSeq = await computeMaxSeqFromJournal(journalPath);
  await writeSeqCache(seqCachePath, maxSeq);
  return maxSeq + 1;
}

async function acquireLock(lockPath, retries, delayMs, file, journalPath) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fs.open(lockPath, "wx");
    } catch (err) {
      if (err && err.code === "EEXIST") {
        if (attempt === retries) {
          break;
        }
        await delay(delayMs);
        continue;
      }

      throw new CorruptedJournalError(
        `append(): failed to acquire lock for ${file} journal ${journalPath} lock ${lockPath} retries ${attempt - 1}`
      );
    }
  }

  throw new CorruptedJournalError(
    `append(): failed to acquire lock for ${file} journal ${journalPath} lock ${lockPath} retries ${retries}`
  );
}

async function assertNoAppendLock(caller, file, journalPath) {
  const lockPath = `${journalPath}.lock`;
  try {
    await fs.access(lockPath);
    throw new CorruptedJournalError(
      `${caller}: append in progress for ${file} journal ${journalPath} lock ${lockPath}`
    );
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return;
    }
    if (err instanceof CorruptedJournalError) {
      throw err;
    }
    throw new CorruptedJournalError(
      `${caller}: append in progress for ${file} journal ${journalPath} lock ${lockPath}`
    );
  }
}

async function releaseLock(lockHandle, lockPath) {
  try {
    if (lockHandle) {
      await lockHandle.close();
    }
  } finally {
    try {
      await fs.unlink(lockPath);
    } catch (err) {
      if (err && err.code !== "ENOENT") {
        throw new CorruptedJournalError(
          `append(): failed to release lock ${lockPath}`
        );
      }
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeSnapshotIfNeeded(targetPath, file, caller) {
  let existingContent;
  try {
    existingContent = await fs.readFile(targetPath, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return;
    }
    throw new CorruptedJournalError(
      `${caller}: failed to create snapshot for ${file} path ${targetPath}`
    );
  }

  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const snapshotPath = `${targetPath}.${timestamp}.bak`;
  try {
    await fs.writeFile(snapshotPath, existingContent, "utf8");
  } catch (err) {
    throw new CorruptedJournalError(
      `${caller}: failed to create snapshot for ${file} path ${snapshotPath}`
    );
  }
}

async function readSeqCache(seqCachePath) {
  try {
    const data = await fs.readFile(seqCachePath, "utf8");
    const value = data.trim();
    if (!/^[0-9]+$/.test(value)) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  } catch (err) {
    return null;
  }
}

async function writeSeqCache(seqCachePath, seq) {
  try {
    await fs.writeFile(seqCachePath, `${seq}\n`, "utf8");
  } catch (err) {
    return;
  }
}

async function updateSeqCache(journalPath, seq) {
  await writeSeqCache(`${journalPath}.seq`, seq);
}

async function computeMaxSeqFromJournal(journalPath) {
  try {
    const data = await fs.readFile(journalPath, "utf8");
    if (!data) {
      return 0;
    }

    const lines = data.split("\n");
    let maxSeq = 0;
    for (const line of lines) {
      if (!line) {
        continue;
      }
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const seq = entry && entry.seq;
      if (Number.isInteger(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }

    return maxSeq;
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return 0;
    }
    throw err;
  }
}
