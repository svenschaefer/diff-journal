# TODO – diff-journal

This document tracks open work items for the `diff-journal` project.  
The focus is on correctness, auditability, and long-term maintainability.  
Items are grouped by priority.

---

## Should (next iteration)

### Snapshots / checkpoints (timestamped backups)

* [ ] Define retention strategy
  * max count per file and/or max age
  * deletion policy must never affect journals

### Performance improvements

* [ ] Stream journal replay instead of loading full file into memory

### API ergonomics

* [x] Add `journal.inspect(file)` helper
  * list entries
  * show seq range
  * basic metadata only (no patch apply)

* [x] Add `exists(file)` helper
  * detect whether a journal exists for a file

---

## Could (nice-to-have / future)

### Tooling & UX

* [ ] CLI wrapper for common operations
  * append
  * materialize
  * rollback
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
