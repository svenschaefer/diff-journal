# diff-journal

A lightweight Node.js library for append-only, diff-based journaling of file changes with deterministic replay and rollback.

## Motivation

When file changes are produced automatically (e.g. by tools, pipelines, or AI systems), traditional version control alone is often not sufficient:

- changes should be **logged automatically**
- every modification must be **auditable**
- any previous state must be **reconstructable**
- rollback must be **deterministic**, not heuristic

`diff-journal` addresses this by introducing a **diff-based, append-only change journal per file**, without replacing native filesystem operations or Git.

---

## Core Concepts

### Append-only Journal

For every tracked file, a corresponding journal is maintained:

- the journal is **append-only**
- each entry represents a **single change**
- entries are ordered and immutable

The journal is the **source of truth**.

### Diff-based Changes

Changes are stored as **unified diffs**:

- minimal, human-readable deltas
- compatible with standard diff / patch tooling
- replayable in strict sequence

### Materialized Files

The actual file on disk is a **materialization** derived from the journal:

- it can always be rebuilt from the journal
- it may be snapshotted for performance or safety
- it is never authoritative

### Deterministic Replay & Rollback

- replay = apply journal entries in order
- rollback = replay up to a given sequence number
- no undo logic, no heuristics

---

## Non-Goals

`diff-journal` intentionally does **not**:

- replace native filesystem APIs
- hook into or monkey-patch `fs`
- act as a version control system
- manage branches or merges
- integrate with Git automatically

Git remains a **separate, higher-level concern**.

---

## Intended Use Cases

- automated file transformations
- AI-assisted code or config generation
- contract or specification evolution
- audit-sensitive pipelines
- deterministic tooling workflows

---

## Status

This project is in an **early stage**.

- API is not yet stable
- no guarantees on backward compatibility
- feedback and iteration expected

---

## License

MIT
