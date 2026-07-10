---
name: implement-qa-card-batch
description: Use when the user pastes a list of card names or ability descriptions from the QA team to implement as a batch — loose free-text lines like "LAW Krennic Leader's ability", "Haymaker", "Zeb (LAW)", often with set hints in parentheses or "(if it's not already)" notes.
---

# Implement QA Card Batch

## Overview

QA sends card requests in loose human language — one card per line, with informal name/set/side hints. This skill turns that text into exact card IDs, then hands the batch to the `implement-swu-card` skill.

**This skill only parses and resolves. It does not implement cards** — `implement-swu-card` does that, and it is the approval gate.

## Workflow

1. **Split** the QA text into entries — one card per line/bullet. Keep parenthetical notes attached.
2. **Resolve** each entry to a card ID (see Resolution recipe).
3. **Leaders → both sides** (see below).
4. **Overflow:** if more than 5 cards resolve, ask the user which 5 to run this session; list the rest.
5. **Hand off:** invoke `implement-swu-card` with the resolved ID list (≤5). Add no confirmation step of your own, and do NOT pre-check whether a card is already implemented — `implement-swu-card`'s per-card brainstorm is the gate that decides.

## Resolution recipe (per entry)

Data source: the maps in `src/server/engine/card-db/generated.ts`, all keyed by card ID — `cardTitle`, `cardSubtitle`, `cardSet`, `cardType`.

1. Extract the **name** and any **hints**: a set code (`LAW`, `ASH`, `SEC`, `(LAW)`…), the word "Leader"/"Leader's ability", a subtitle, or stats.
2. grep `cardTitle` (and `cardSubtitle`) for the name. **Match loosely** — spellings vary: "Zeb" matches both "Zeb Orellios" and "Zeb Orrelios".
3. Disambiguate multiple hits, in this order:
   1. **Set hint** → keep the ID whose `cardSet` matches.
   2. **Type hint** ("Leader"/"Leader's ability") → keep the ID whose `cardType` is `Leader`.
   3. Subtitle / stats / card text, if the entry mentions them.
4. **Prefer the base-set printing.** Ignore promo/token duplicates (IDs like `LAWP_*`, `P25_*`, `*_T0*`) unless a hint names one.
5. Commit to the educated guess when hints resolve it. **Only ask the user** when an entry stays genuinely ambiguous or matches nothing.

## Leaders = both sides

When an entry names a leader or "Leader's ability", the batch implements **BOTH** the leader (front/undeployed) side **AND** the leader-unit (deployed) side. A leader is not done with only one side wired.

- Do **not** implement only the front ability.
- Do **not** treat the deployed side as optional or defer it back to QA.
- A leader still counts as **one card** toward the 5-card cap.

## Handoff

Invoke the `implement-swu-card` skill with the resolved IDs as its card list. That skill brainstorms an approach per card, then TDDs each — and it is the approval gate. This skill adds no separate confirmation.

## Worked example

QA text:

```
LAW Krennic Leader's ability
Haymaker
Ant Droid (if it's not already)
GNK Power Droid (if it's not already)
Zeb (LAW)
```

Resolves to:

| QA line | ID | Title | How resolved |
|---|---|---|---|
| LAW Krennic Leader's ability | **LAW_008** | Director Krennic | 7 "Director Krennic" printings; `cardSet`=LAW + Leader hint pin it. **Both sides.** |
| Haymaker | **LAW_168** | Haymaker | Single base printing (ignore `LAWP_*` promo). |
| Ant Droid (if it's not already) | **ASH_116** | Ant Droid | Unique title. Pass through — don't pre-check impl status. |
| GNK Power Droid (if it's not already) | **SEC_110** | GNK Power Droid | Unique title. Pass through. |
| Zeb (LAW) | **LAW_045** | Zeb Orellios | Fuzzy "Zeb" → two spellings; `(LAW)` picks LAW_045 over SOR_146. |

Then invoke `implement-swu-card` on `LAW_008 LAW_168 ASH_116 SEC_110 LAW_045` (LAW_008 = both sides). 5 cards, within cap — no overflow prompt.

## Red flags

- Implementing only a leader's **front side** → both sides are required.
- **Pre-checking or skipping** a card because it "might already be implemented" → pass it through; `implement-swu-card` decides.
- Asking the user to **confirm the whole mapping** when the hints already resolve it → only ask on genuine ambiguity.
- Picking a **promo/token ID** (`LAWP_*`, `P25_*`, `*_T0*`) when a base-set printing exists.
- More than 5 cards and you **silently drop** the extras → ask which 5, and list the deferred IDs.
