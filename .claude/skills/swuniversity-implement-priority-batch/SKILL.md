---
name: swuniversity-implement-priority-batch
description: Use when the user wants to work the card implementation board's Priority queue in this repo — "do the priority cards", "what's queued / next on the board", "work the priority lane", "implement what's in priority". Reads the queue from MongoDB rather than taking a pasted list. Only for THIS repo (swuniversity), not other SWU-named projects.
---

# SWUniversity Implement Priority Batch

Takes the **Priority lane** of `/admin/cards-impl` and runs it as an implementation batch. Unlike
`implement-qa-card-batch`, the card list is not pasted by the user — it is read from the board, so
whatever the team queued in the UI is what gets built.

The board only stays useful if it reflects reality. You do not update it — **the batch summary is
the handoff**, and the user flips the lanes in the admin UI from it.

## Reading the queue needs nothing but `.env`

```bash
node tests/tools/card-impl-board.mjs --lane priority
```

No dev server, no cookie. Statuses are **reported back to the user**, who sets them in the local
admin UI — the batch never depends on a write path being available.

## The loop

1. **Fetch the queue, in rank order.**
   ```bash
   node tests/tools/card-impl-board.mjs --lane priority
   ```
   Priority is ranked — `#1` is genuinely first. Work in that order unless the user says otherwise.

2. **Confirm scope.** More than 20 cards: ask which 20, and list the deferred ids. Report the
   queue back to the user before starting so they can reorder or drop entries.

3. **Implement.** REQUIRED SUB-SKILL: use `implement-swu-card` with the resolved ids. It
   brainstorms an approach per card, then TDDs each. It is the approval gate; this skill adds no
   separate confirmation.

4. **Finish with the batch summary — this IS the handoff.** Produce the Discord-pasteable
   summary exactly as `implement-qa-card-batch` specifies (`Added:` / `Was Already Done:` /
   `Mechanics:`, grouped Leaders → Bases → Units → Events → Upgrades).

   The `Added:` list is what the user flips to Done. The board's search matches **title as well as
   `SET_NNN`**, so the summary's `- Card Title (SET) Type` lines are directly actionable — no
   separate list of ids needed.

5. **Add a `Needs Work:` section for anything unfinished. REQUIRED whenever a card did not land.**
   The standard summary format has no slot for failure, so a card that stalled would otherwise
   vanish from the report entirely — and from the board, since it stays in Priority looking
   untouched.

   ```
   Needs Work:
   - Wing Leader (HMW) Upgrade — Action on a base-attached upgrade; ActionAbilities only walks units
   ```

   One line, one concrete reason. "Didn't work" tells the next person nothing; name the thing that
   blocked it.

6. **Optional — write the statuses yourself.** Only if the user has already set up the write path
   (`CARD_IMPL_COOKIE` plus a running `npm run dev`). Otherwise skip it; the summary stands.

   ```bash
   node tests/tools/card-impl.mjs --card <ID> --status done
   node tests/tools/card-impl.mjs --card <ID> --status needs-work --note "<what is wrong>"
   ```

## Lane rules the engine enforces

Priority can move to **To Do, Needs Work, or Done**. Needs Work and Done can only swap with each
other — neither routes back to To Do. A card wrongly sent to Needs Work is stuck between those
two, so read the card before moving it.

The rules live in `src/server/cards-impl/status-board.ts`; the API rejects an illegal move, so a
failed write is a signal to re-read, not to retry.

## Common mistakes

| Mistake | What happens |
|---|---|
| Ending a batch without the summary | It is the only handoff; the board silently rots and the work is invisible |
| Omitting a card that went badly | Silence reads as "never started". An unfinished card needs a `Needs Work:` line naming what blocked it |
| Assuming the lane emptied itself | You do not move cards. Priority still shows them until the user flips them |
| Marking `done` because tests pass | `implement-swu-card` is the gate. Green tests on a half-wired card are still half-wired — see the KNOWN_GAPS list in `tests/unit/engine/ability-registry-consistency.test.ts` |
| `needs-work` with no note | The lane fills with cards nobody remembers the problem with |
| Reading the queue alphabetically | Priority is RANKED; `--lane priority` prints it in rank order for a reason |
| Editing the collection directly | Writes go through `card-impl.mjs` and the admin endpoint. `card-impl-board.mjs` is read-only — see rule 1 in `tests/tools/README.md` |

## Related

- `implement-swu-card` — the per-card engine (REQUIRED)
- `implement-qa-card-batch` — same shape, but for a pasted list; owns the summary format
- `swuniversity-implement-set-plan` — when working a whole set rather than the queue
