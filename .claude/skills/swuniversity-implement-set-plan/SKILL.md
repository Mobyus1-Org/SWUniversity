---
name: swuniversity-implement-set-plan
description: Use when the user wants to implement a whole SWU set in this repo — "plan out <SET>", "start implementing <SET>", "work through the rest of <SET>". Inventories the set, schedules any new engine mechanics first, writes/maintains a plan doc, then drives it batch-by-batch through implement-swu-card. Works for released sets and preview (mocked) sets alike. Pass --iterative to do ONE CARD PER PASS and stop for review after each. Only for THIS repo, not other SWU-named projects.
---

# SWUniversity Implement Set-Plan

Orchestrator for taking a set from "nothing implemented" to card-complete. It **inventories** the
set, **schedules** the work (new engine mechanics first, then cards easiest-to-hardest), writes a
plan doc, and then **loops** — handing every card to `implement-swu-card`, which owns the actual
brainstorm → TDD → Definition-of-Done work. This skill writes no card logic itself.

Sets are addressed by their `SET_NNN` ids, so a preview set becomes an official set with **no code
change** — the mocks are deleted and the same ids resolve to official data. The only difference
this skill cares about is the preflight in Step 1.

## Modes

**Default (batch):** the loop unit is a batch of up to 20 cards. One "go" covers the whole scope
and the run proceeds unattended.

**`--iterative`:** the loop unit is a **single card**, and the run **stops after each one** for
review. Use it for preview sets, for anything with genuinely novel mechanics, or whenever the user
says "one at a time". A leader is one card — **both sides in the same pass**.

| | default | `--iterative` |
|---|---|---|
| loop unit | batch (≤20) | one card |
| approval | one "go" for the scope | stop after **every** card |
| ambiguous card | note it, keep going | raise it at that card's review |
| green gate | per batch | per card |

Same quality bar either way. `--iterative` changes review granularity, never scope or rigour.

## Step 1 — Preflight: is the set actually usable?

**Do this before planning anything.** Every failure below has happened, and all three are silent —
the card looks fine in the JSON and simply does not work.

```bash
node tests/tools/card-info.mjs --set <SET> --limit 100   # what the ENGINE can see
```

1. **Is the set in `generated.ts` at all?** `card-info.mjs` reads the generated dictionaries, which
   is what the engine reads. If the set returns nothing, no card in it can be implemented or
   tested.
2. **For a preview set, does every mock appear?** Compare `card-mocks.json` against the generated
   output and diff them — do not trust "the generator ran":

   ```bash
   node --input-type=module -e '
   import fs from "node:fs";
   const {loadCards} = await import("./tests/tools/card-db.mjs");
   const inDb = new Set(loadCards().filter(c => c.set === "<SET>").map(c => c.id));
   const mocks = JSON.parse(fs.readFileSync("src/server/engine/card-db/card-mocks.json","utf8"));
   const ids = Object.entries(mocks).filter(([,c]) => c.set === "<SET>").map(([id]) => id);
   console.log("MISSING:", ids.filter(i => !inDb.has(i)));'
   ```

   A mock that is missing from `generated.ts` fails **twice over**: the card cannot be played from
   hand at all, and if a test places it via the builder it is **swept as a 0-HP unit** (its HP is
   undefined), which reads exactly like an unrelated engine bug. If anything is missing, the user
   must re-run **Fetch SWU Cards + Images** in `/internal/zzCardCodeGenerator`.
3. **Is the set in `CATALOG_SETS`?** (`pages/api/internal/card-catalog.ts`.) A set missing from
   that allowlist is invisible in the **puzzle editor** — the cards exist and play fine, but no one
   can build a puzzle with them, with no error to explain it. `tests/unit/puzzle/card-catalog-sets.test.ts`
   fails when a set is in neither list; if it is red for your set, add it before doing anything else.

Report any preflight failure and **stop** — planning against data the engine cannot see wastes the
whole run.

## Step 2 — Inventory and classify

Build the card list from the engine's own view, not from a spoiler site.

```bash
node tests/tools/card-info.mjs --set <SET> --type Leader
node tests/tools/card-info.mjs --set <SET> --no-text     # vanilla — verify-only, not "implement"
node tests/tools/card-info.mjs --set <SET> --grep "<keyword>"
```

Cross-reference `cards-remaining.md` (the authoritative "zero engine references" list) — but treat
it as a **floor, not a ceiling**, exactly as its own header says. A half-wired card does not appear
there, so a card being absent from it does not mean it is done. Confirm with a grep of the id
across `src/server/engine` before classifying anything as complete.

Sort every card into one of four buckets:

| Bucket | What it means | Handling |
|---|---|---|
| **Vanilla** | no card text at all | verify only — no work, no test file |
| **Keyword-only** | text is nothing but keywords | register in each keyword dictionary; keywords are **hand-written switch lists**, never inferred from text, so an unregistered card silently has no keywords |
| **Card work** | ordinary abilities on existing engine primitives | the normal batch flow |
| **New mechanic** | needs engine infrastructure that does not exist | **Phase 0** — see Step 3 |

**Leaders count once but are two cards' worth of work.** `cardText` (front) and
`cardLeaderUnitText` (deployed) are separate fields and separate ability sets; a leader with a
finished front Action and an unimplemented deployed side is **not done**.

## Step 3 — Schedule new mechanics FIRST

Scan the set's text for anything the engine has no primitive for, and make it **Phase 0**, before
any card that needs it. Implementing a card on top of missing infrastructure means writing the
infrastructure badly, inline, under time pressure.

Signals a mechanic is new: a keyword with no file in `keyword-dictionaries.ts/`; a zone or host
that does not exist (HMW's **Fortify** needed the base to host upgrades at all); a trigger type
absent from `src/lib/engine/trigger-types.ts` (Trap Field needed `unit-entered-play`); a state
field that has to be added to `core-models.ts`.

Two rules that come out of doing this before:

- **A new state field must be added to every hand-written mirror in the same change** — the puzzle
  hydrator (`puzzle-runtime.ts`), the builder (`puzzle-builder-state.ts` `toRaw`/`parseRawPlayer`),
  and `StaticBoard.tsx`. None is compiler-enforced, and an **optional** field omitted from a mirror
  typechecks clean and silently vanishes in every puzzle. Add a round-trip test with the field.
- **A new trigger type must be wired end to end in one go** — declared, queued, dispatched, and
  resolved. A declared-but-never-dispatched trigger is dead code that nothing catches.

## Step 4 — Write the plan doc

Write `<set>-implement.md` in the repo root, matching the shape of `sor-implement.md`: a summary
count table at the top, then a section per phase with a checkbox per batch.

```markdown
# <SET> Implementation Status

| Status | Count |
|--------|-------|
| Implemented | 0 |
| Vanilla / keyword-only (verify) | 0 |
| Remaining | 0 |

## Phase 0 — Engine mechanics
- [ ] **Fortify** — upgrades hosted on the base (blocks HMW_081, HMW_171)

## Phase 1 — Cards (simple)
- [ ] **Batch 1.1** — SET_001 SET_002 …
```

Order batches **simplest first** unless the user says otherwise, and keep each ≤20 cards
(`implement-swu-card`'s cap). State the order at the start of the run.

## Step 5 — State the contract, then wait for "go"

Lay it out once so the user can amend it before anything runs:

> For this run I'll: work through <scope> without pausing per batch; hold every card to the
> Definition-of-Done gate (every clause → code + test); run `npm test` green before moving on;
> update the plan doc and trackers as I go; and never commit. Flagging as I go, not stopping for:
> ambiguous rulings and self-contained design calls.

`--iterative` skips most of this — every card stops by construction. State the ordered card list
and start the first one.

**For a preview set, say plainly that there are no official rulings.** Read from the Comprehensive
Rules plus the closest released analogue, and **flag every assumption in the card's review** — the
user is the ruling authority and will often have a specific reading in mind.

## Step 6 — The loop

Per batch (or per card in `--iterative`):

1. **Invoke `implement-swu-card`** with the ids. It owns the real work.
2. **Green-gate**: `npm test` (this is `vitest run tests/unit` — *not* `npm run test:run`, which
   picks up the server-dependent integration test) plus `npx tsc --noEmit`. Lint has a **known
   baseline of 40 problems**; clean means *no new* ones, not zero.
3. **Update the trackers** — both, every time:
   - `cards-remaining.md`: delete the card's line, decrement the per-set header count **and** the
     grand total.
   - `leaders-implement.md`: for a leader, remove its entry, add it to the Complete table, and fix
     the summary counts.
   - The plan doc: flip the batch checkbox and add a one-line note.
4. **Run one card at a time inline.** Do not spawn subagents to parallelise — each batch's green
   suite gates the next.

## Step 7 — Finish

Report: cards done by bucket, new mechanics built, test count start → end, and anything left
unresolved (ambiguous rulings, deferred cards) as one consolidated list. The set is **not**
card-complete while that list is non-empty — say so plainly.

Remind the user the tree is **uncommitted**; they commit manually. If they are wrapping up, invoke
`swuniversity-session-close`.

## Common mistakes

| Mistake | Fix |
|---|---|
| Planning before the preflight | A set that is not in `generated.ts`, or a preview mock that failed to generate, cannot be implemented OR tested. Check first — the failure is silent. |
| Trusting "the generator ran" | Diff `card-mocks.json` against the generated set. One mock silently missing is the normal failure, and it looks like an engine bug when the card is swept at 0 HP. |
| Forgetting `CATALOG_SETS` on a preview set | The cards work but are invisible in the puzzle editor. QA reports it as "the previews are missing". |
| Building cards before their mechanic | Phase 0 exists for this. A new keyword, zone, trigger type or state field is infrastructure — do it once, deliberately, not inline inside the first card that needs it. |
| Marking a leader done on its front side | `cardText` AND `cardLeaderUnitText` are separate ability sets. Both, or it is not done. |
| Forgetting the UI registration gate | A Leader with an Action needs its id in `LEADERS_WITH_ACTION_ABILITY`; a unit with an `Action [...]` needs `UNITS_WITH_ACTION_ABILITY`. Both live in `PuzzlesPage.tsx`, the engine tests never render it, and `npm test` passes without them. |
| Treating `cards-remaining.md` as the full picture | It lists cards with ZERO engine references. A half-wired card is absent from it and still broken. Grep the id before calling it done. |
| Assuming a keyword works because the card prints it | Keyword dictionaries are hand-written switches. An unregistered card has no keywords and nothing warns you. |
| Adding a state field to `core-models.ts` and stopping | Three hand-written mirrors must change with it, and an optional field's omission typechecks clean. |
| Copying the nearest analogue without reading it | The obvious template is sometimes the wrong one — Bombing Run's AoE used a raw `damage +=` that skipped Shields and never swept. Read what the analogue actually does before cloning it. |
| Running `npm run test:run` | That includes the DB-backed integration test and will fail. `npm test` is the gate. |
| Chasing lint to zero | 40 problems is the standing baseline. Judge by "no new ones". |
| Committing | Never. The user commits manually. |
