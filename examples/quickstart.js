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
