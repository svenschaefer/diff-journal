# diff-journal

A lightweight Node.js library for **append-only, diff-based journaling** of file changes with **deterministic replay**, **rollback**, and **auditability**.

- **Append-only**: every change becomes an immutable journal entry
- **Deterministic replay**: rebuild state by applying entries in strict order
- **Rollback**: materialize the file at any prior sequence number
- **Auditable**: unified diffs + optional metadata (actor/intent)

---

## Quickstart

### Install

From npm (if available in your environment):

```bash
npm i diff-journal
```

From a local checkout:

```bash
npm i /path/to/your/clone/of/diff-journal
```

### Try it (ESM JS)

```js
import { readFile } from "node:fs/promises";
import { join as pathJoin } from "node:path";
import { openDiffJournal } from "diff-journal";

const WORKSPACE_DIR = ".";
const JOURNAL_DIR = ".journal";
const FILE = "example.txt";
const ACTOR = "quickstart";

const journal = openDiffJournal({
  rootDir: WORKSPACE_DIR,
  journalDir: JOURNAL_DIR,
  strictReplay: true,
  snapshots: true
});

async function appendChange(current, intent, computeNext) {
  const before = current;
  const after = computeNext(before);

  await journal.append({
    file: FILE,
    actor: ACTOR,
    intent,
    before,
    after
  });

  return after;
}

let current = "";
current = await appendChange(current, "initial content", () => "Hello world\n");
current = await appendChange(current, "add a second line", (t) => `${t}Nice to meet you.\n`);

await journal.materialize(FILE);

console.log("=== CURRENT ===");
console.log(await readFile(pathJoin(WORKSPACE_DIR, FILE), "utf8"));

await journal.rollback(FILE, { seq: 1 });

console.log("=== ROLLBACK (seq=1) ===");
console.log(await readFile(pathJoin(WORKSPACE_DIR, FILE), "utf8"));

console.log("=== INSPECT ===");
console.log(await journal.inspect(FILE));
```

### Run the example from this repository

This repo includes the same example at `examples/quickstart.js`:

```bash
cd examples
node quickstart.js
```

You should end up with:

- `example.txt` (materialized file)
- `.journal/` (append-only journal + optional snapshots)

---

## Motivation

When file changes are produced automatically (tools, pipelines, AI systems), version control alone is often not sufficient:

- changes should be **logged automatically**
- every modification must be **auditable**
- any previous state must be **reconstructable**
- rollback must be **deterministic**, not heuristic

`diff-journal` introduces a **diff-based, append-only change journal per file**, without replacing native filesystem operations or Git.

---

## How it works

### Append-only journal (source of truth)

For every tracked file, a corresponding journal is maintained:

- the journal is **append-only**
- each entry represents **one concrete change**
- entries are **ordered, immutable, and auditable**

The journal is the **single source of truth**.

### Unified diffs (portable deltas)

Changes are stored as **unified diffs**:

- minimal, human-readable deltas
- compatible with standard diff / patch tooling
- replayed strictly in sequence order

### Materialized file (derived artifact)

The file on disk is a **materialization** derived from the journal:

- it can always be rebuilt from the journal
- it may be snapshotted for safety or performance
- it is **never authoritative**

### Deterministic replay & rollback

- replay = apply journal entries in strict order
- rollback = replay up to a given sequence number
- no undo logic, no heuristics, no best-effort behavior

Failures are **fail-fast and explicit**.

---

## Guarantees

`diff-journal` is built around these guarantees:

- **Append-only** journal semantics (no in-place history edits)
- **Deterministic** replay order (sequence is authoritative)
- **Strict** behavior: no heuristic patching or "best effort" rollback
- Clear separation between:
  - **journal** (authoritative history)
  - **materialization** (derived file on disk)
  - **snapshots** (optional safety copies)

---

## Snapshots

Snapshots are **best-effort safety copies** stored under the journal directory.

They can help with:

- debugging
- fast recovery / warm starts
- external retention policies

Important:

- snapshots are **never authoritative**
- deletion/retention policies must **never** touch journal files

---

## Minimal API (practical view)

```js
import { openDiffJournal } from "diff-journal";

const journal = openDiffJournal({
  rootDir: "./workspace",
  journalDir: ".journal",
  strictReplay: true,
  snapshots: true
});

await journal.append({ file, actor, intent, before, after });
await journal.materialize(file);
await journal.rollback(file, { seq });
const info = await journal.inspect(file);
```

---

## Non-goals

`diff-journal` intentionally does **not**:

- replace native filesystem APIs
- hook into or monkey-patch `fs`
- act as a version control system
- manage branches or merges
- integrate with Git automatically
- run background watchers or daemons
- maintain hidden state outside journal files
  (except explicitly derived artifacts like snapshots or caches)

Git remains a **separate, higher-level concern**.

---

## Intended use cases

- automated file transformations
- AI-assisted code or config generation
- contract or specification evolution
- audit-sensitive pipelines
- deterministic tooling workflows
- safe experimentation with snapshots and recovery

---

## Project status

- core semantics are implemented and stable
- APIs may still evolve
- backward compatibility is not yet guaranteed

---

## License

MIT
