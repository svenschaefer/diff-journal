# TODO – diff-journal

This document tracks open work items for the `diff-journal` project.  
The focus is on correctness, auditability, and long-term maintainability.  
Items are grouped by priority.

---

## Must (before first stable release)

### Journal integrity & validation

* [x] Add optional **strict replay mode**
  * verify that `base_hash` matches the current materialized content before applying each diff
  * fail fast on drift or corruption

* [x] Validate journal ordering
  * detect duplicate `seq` values
  * detect missing `seq` values (gaps)
  * detect non-monotonic sequences
  * fail fast on invalid ordering (no repair logic)

### Concurrency safety

* [x] Add file-level locking for `append()`
  * prevent concurrent writers corrupting the journal
  * exclusive lock per journal file via lock file
  * deterministic retry and fail-fast semantics

* [x] Define behavior for concurrent `materialize()` / `rollback()`
  * materialize / rollback fail fast if an append lock is active
  * no waiting, retrying, or reader-side locking
  * concurrent materialize/rollback calls are allowed

### Error semantics

* [x] Normalize error messages and error types
* [x] Clearly distinguish:
  * invalid input (`InvalidInputError`)
  * corrupted journal (`CorruptedJournalError`)
  * patch application failures (`PatchApplicationError`)
  * strict replay base-hash mismatches (`StrictReplayMismatchError`)

---

## Should (next iteration)

### Snapshots / checkpoints (timestamped backups)

* [x] Introduce optional snapshot (`.bak`) files
  * full materialized content at a given point in time
  * created immediately before overwriting materialized files
  * **timestamped naming**: `x.txt.<timestamp>.bak`
  * snapshots written directly next to the materialized file

* [x] Define snapshot triggers (“write-through”)
  * snapshots created for `materialize()` and `rollback()`
  * controlled by a boolean `snapshots` option
  * no snapshots during `append()`

* [ ] Define retention strategy
  * max count per file and/or max age
  * deletion policy must never affect journals

* [x] Ensure snapshots are **derived artifacts**, never authoritative
  * snapshots are never read, replayed, or consulted by the system

### Performance improvements

* [ ] Optimize `seq` calculation
  * avoid full file scan on every append
  * consider lightweight index or cached last-seq

* [ ] Stream journal replay instead of loading full file into memory

### API ergonomics

* [ ] Add `journal.inspect(file)` helper
  * list entries
  * show seq range
  * basic metadata only (no patch apply)

* [ ] Add `exists(file)` helper
  * detect whether a journal exists for a file

---

## Could (nice-to-have / future)

### Tooling & UX

* [ ] CLI wrapper for common operations
  * append
  * materialize
  * rollback (library function exists; CLI still missing)
  * inspect

* [ ] Pretty-print journal entries for humans
* [ ] Optional JSON Schema for journal entries

### Advanced integrity

* [ ] Hash chaining (`prev_hash`)
* [ ] Tamper-evident journal mode
* [ ] Signed journal entries (out of scope for v1)

### Documentation

* [ ] Add minimal usage example to README
* [ ] Add “Journal Format” reference section
* [ ] Add architecture diagram (conceptual)
* [ ] Add “Storage Layout” section (rootDir vs journalDir; snapshot strategy)
* [ ] Document snapshot and concurrency semantics

---

## Explicit non-goals (to keep scope tight)

* No filesystem monkey-patching
* No automatic Git integration
* No branching or merging semantics
* No background watchers or daemons
* No hidden state outside journal files (except derived snapshots/checkpoints)

---

## Notes

* Correctness and auditability take precedence over performance.
* Simplicity is preferred over completeness.
* All new features should preserve:
  * append-only semantics
  * deterministic replay
  * clear separation between journal and materialization
