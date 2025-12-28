# TODO – diff-journal

This document tracks **post-MVP / expansion** work items for the `diff-journal` project.  
The core system is **complete, correct, and production-usable**.  
All remaining items are **optional enhancements** and **non-blocking**.

The focus going forward is on **operability, performance, and usability**, without
compromising the established guarantees:
append-only semantics, deterministic replay, and auditability.

---

## Expansion (optional, non-blocking)

### Snapshots / checkpoints

* [ ] Define snapshot retention strategy
  * max snapshot count per file and/or max age
  * deletion policy must **never** affect journals
  * snapshot cleanup must be best-effort and failure-tolerant

---

### Performance

* [ ] Stream journal replay instead of loading full file into memory
  * line-by-line replay
  * preserve strict replay and ordering guarantees
  * no buffering-based reordering or heuristics

---

### API ergonomics

* [x] `journal.inspect(file)`
  * list entry count
  * min/max seq
  * metadata only (no patch application)

* [x] `journal.exists(file)`
  * detect whether a journal exists for a file

* [ ] Optional structured inspect output
  * timestamps
  * actor / intent summaries
  * strictly read-only

---

## Nice-to-have / Future

### Tooling & UX

* [ ] CLI wrapper
  * append
  * materialize
  * rollback
  * inspect

* [ ] Pretty-print journal entries for humans
* [ ] Optional JSON Schema for journal entries

---

### Advanced integrity

* [ ] Hash chaining (`prev_hash`)
* [ ] Tamper-evident journal mode
* [ ] Signed journal entries (explicitly out of scope for v1)

---

### Documentation

* [ ] Minimal usage example in README
* [ ] “Journal Format” reference section
* [ ] Conceptual architecture diagram
* [ ] “Storage Layout” section (rootDir vs journalDir; snapshots)
* [ ] Document snapshot and concurrency semantics

---

