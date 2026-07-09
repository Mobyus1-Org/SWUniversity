---
name: implement-puzzle-gaps
description: Use when the user names a puzzle and wants its unimplemented cards built — e.g. "implement puzzle gaps for [puzzle name]", "fill the card gaps in [puzzle]", "make [puzzle] work". Puzzle mode is single-player (P1 solves in one action phase).
---

# Implement Puzzle Gaps

## Overview

A puzzle only needs the cards that can actually fire during P1's single action phase. `dev-tools/review-puzzle.py` already computes that set. This skill turns a puzzle name into implemented cards: get the reachable batch from the tool, then build exactly that batch via `implement-swu-card`.

**REQUIRED SUB-SKILL:** hand the batch to `implement-swu-card` (it brainstorms per card, then TDD). Do not implement cards by hand here.

## Workflow

1. **Get the batch.** Run:
   ```bash
   python3 dev-tools/review-puzzle.py "<puzzle name>" --no-json
   ```
   (Reads MONGO_CONNECTION_STRING from `.env`; needs `pymongo`+`certifi` in the venv. Pass the puzzle name exactly; if unknown, the tool prints the available names.)

2. **The batch is BOTH `⚠` sections: `TO IMPLEMENT` and `PARTIALLY IMPLEMENTED`.** The tool already filtered to cards reachable in P1's turn — trust it; don't re-derive relevance. Ignore the `skip` list and the `implemented/vanilla` counts.
   - `TO IMPLEMENT` = cards with no engine code yet.
   - `PARTIALLY IMPLEMENTED` = cards with only a keyword wired; the listed clauses still need code (often the P1 leader). `implement-swu-card` re-reads each card and its Definition-of-Done gate fills the missing clauses — for a leader, both the front and back sides.
   - **P2 over-surface filter:** the tool can list a P2 card as partial merely because it *grants* a keyword. If every clause shown for a P2 card is an activated / On-Attack / deploy ability (lines starting `Action [`, `On Attack:`, or `Epic Action:`), P2 can never use it in a 1-player puzzle — drop that card from the batch.
   - If both `⚠` sections are empty after that filter → the puzzle is covered. Report and stop.

3. **Implement the batch via `implement-swu-card`.** Pass the kept ids (from both sections) as "implement SWU cards X, Y, Z". Let that skill drive brainstorming + TDD.
   - **5-card cap:** `implement-swu-card` does at most 5 per session. If the combined batch is >5, pass the first 5 and tell the user the rest continue in a new session (a re-run of this skill will surface them again).

4. **Verify by re-running the tool** for the same puzzle. Success = the previously-flagged ids now appear under `implemented/referenced`, and both `⚠` sections are empty (except any >5 overflow or a P2 card you intentionally dropped).

## Quick Reference

| Section of tool output | Action |
|---|---|
| `⚠ TO IMPLEMENT` | implement these ids |
| `⚠ PARTIALLY IMPLEMENTED` | implement these too — build the listed missing clauses (EXCEPT a P2 card whose clauses are all `Action [`/`On Attack:`/`Epic Action:`) |
| `skip` (P1 resources/deck, P2 hand/deck, P2 attacker/on-play) | ignore — out of scope for 1-player mode |
| `implemented/referenced`, `vanilla` | ignore — already handled |

## Common Mistakes

- Reading only `TO IMPLEMENT` and ignoring `PARTIALLY IMPLEMENTED` — the partial bucket is where the P1 leader's missing clauses hide; it's in scope too.
- Implementing a P2 partial whose clauses are all P2-activated (`Action [`/`On Attack:`/`Epic Action:`) — P2 never acts; drop it.
- Implementing cards from the `skip` list, or every card on the board.
- Re-deriving reachability by hand instead of trusting the tool's filter.
- Passing more than 5 cards to `implement-swu-card` — cap at 5, overflow next session.
- Skipping the final re-run — always confirm the batch moved to `implemented/referenced`.
