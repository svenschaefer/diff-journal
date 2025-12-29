# TODO – diff-journal

---

## Expansion (optional, non-blocking)

### Snapshots / checkpoints

* [ ] Define snapshot retention strategy

  * max snapshot count per file and/or max age
  * deletion policy must **never** affect journals
  * snapshot cleanup must be best-effort and failure-tolerant
* [ ] Define snapshot/journal consistency rules

  * behavior when snapshot exists but journal is truncated or partially corrupt
  * snapshot must never mask journal corruption
* [ ] Explicit snapshot format/version marker

---

## Performance

* [ ] Stream journal replay instead of loading full file into memory

  * line-by-line replay
  * preserve strict replay and ordering guarantees
  * no buffering-based reordering or heuristics
* [ ] Early-abort on malformed entry during streaming replay

  * deterministic failure position
  * consistent behavior vs full-file replay

---

## API ergonomics

* [ ] Optional structured inspect output

  * timestamps
  * actor / intent summaries
  * strictly read-only
* [ ] Input validation hardening

  * explicit type checks for all public API parameters
  * fail fast with consistent `InvalidInputError`
* [ ] Normalize journal line parsing

  * tolerate trailing `\r` (CRLF)
  * trim-only parsing without altering hashes
* [ ] Consistent error mapping

  * ensure fs / IO errors are mapped into journal-domain errors
  * avoid leaking raw `fs` exceptions

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
* [ ] Journal validation command

  * structural validation (seq, hashes, ordering)
  * no mutation, read-only

---

### Advanced integrity

* [ ] Hash chaining (`prev_hash`)
* [ ] Tamper-evident journal mode
* [ ] Signed journal entries (explicitly out of scope for v1)
* [ ] Explicit handling of `base_hash` semantics

  * defined behavior for missing / legacy entries
  * strict vs permissive replay modes

---

### Concurrency & locking (non-blocking hardening)

* [ ] Stale lock detection / recovery strategy

  * age-based or PID-based heuristics
  * never auto-delete without opt-in
* [ ] Distinguish lock-present vs lock-inaccessible

  * permission / IO errors must not masquerade as “append in progress”
* [ ] Idempotent append semantics (optional)

  * detect duplicate logical writes after partial failure

---

### Storage layout & robustness

* [ ] Define behavior for missing / desynced `.seq` cache

  * authoritative source (journal vs cache)
  * recovery rules
* [ ] Explicit handling when target path is a directory
* [ ] Document filesystem assumptions

  * supported characters
  * atomicity expectations
  * crash consistency model

---

### Documentation

* [ ] Minimal usage example in README
* [ ] “Journal Format” reference section
* [ ] Conceptual architecture diagram
* [ ] “Storage Layout” section (rootDir vs journalDir; snapshots)
* [ ] Document snapshot and concurrency semantics
* [ ] Failure modes & guarantees section

  * what is detected
  * what is tolerated
  * what intentionally hard-fails

---
