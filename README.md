# diff-journal

A lightweight Node.js library for **append-only, diff-based journaling** of file changes
with **deterministic replay**, **rollback**, and **auditability**.

---

## Motivation

When file changes are produced automatically (e.g. by tools, pipelines, or AI systems),
traditional version control alone is often not sufficient:

- changes should be **logged automatically**
- every modification must be **auditable**
- any previous state must be **reconstructable**
- rollback must be **deterministic**, not heuristic

`diff-journal` addresses this by introducing a **diff-based, append-only change journal per file**,
without replacing native filesystem operations or Git.

---

## Core Concepts

### Append-only Journal

For every tracked file, a corresponding journal is maintained:

- the journal is **append-only**
- each entry represents **one concrete change**
- entries are **ordered, immutable, and auditable**

The journal is the **single source of truth**.

---

### Diff-based Changes

Changes are stored as **unified diffs**:

- minimal, human-readable deltas
- compatible with standard diff / patch tooling
- replayed strictly in sequence order

---

### Materialized Files

The actual file on disk is a **materialization** derived from the journal:

- it can always be rebuilt from the journal
- it may be snapshotted for performance or safety
- it is **never authoritative**

---

### Deterministic Replay & Rollback

- replay = apply journal entries in strict order
- rollback = replay up to a given sequence number
- no undo logic, no heuristics, no best-effort behavior

Failures are **fail-fast and explicit**.

---

## Design Principles

`diff-journal` is built around the following principles:

- **Correctness over performance**
- **Auditability over convenience**
- **Determinism over heuristics**
- **Explicit behavior over hidden magic**

All features preserve:

- append-only semantics
- deterministic replay
- clear separation between journal and materialization

---

## Non-Goals

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

## Intended Use Cases

- automated file transformations
- AI-assisted code or config generation
- contract or specification evolution
- audit-sensitive pipelines
- deterministic tooling workflows

---

## Project Status

This project is currently in a **productive but evolving state**:

- core semantics are implemented and stable
- APIs may still evolve
- backward compatibility is not yet guaranteed
- feedback and iteration are expected

---

## License

MIT
