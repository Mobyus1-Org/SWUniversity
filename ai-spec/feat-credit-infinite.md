# Overview
Build the **Credit token mechanic**, then implement enough cards to produce the funny
interaction where the player generates *infinite* Credit tokens — and finally a card that
*consumes* Credits to win.

# Background: what a Credit token is
From the LAW set / SWU site article. A Credit token reads:
```
While paying resources, you may defeat this token. If you do, pay {1R} less.
```
> "These special tokens can almost be thought of as 'temporary resources,' though they do
> not actually count toward the number of resources you control (so they can't be used to
> deploy your leader faster). Instead, whenever you would pay resources — such as to play a
> card or use an ability — you can defeat any number of Credit tokens you control to grant
> yourself a 1-resource discount for that card/ability for each Credit you defeat."

Key properties:
- Credits do **not** count as resources you control (no leader-deploy acceleration).
- When paying resources, you may defeat any number of your Credits; each defeated Credit
  reduces the resources to pay by 1 (a `{1R}` discount each).

# Phase 1 — Credit mechanic (build first)
This is the prerequisite. Today only a display counter exists
(`supplemental.creditTokens?: number` in `src/lib/engine/game.ts:42`, rendered in
`PuzzlesPage.tsx`). There is **no** create or consume logic.

State:
- Credits live in `PlayerState.supplemental.creditTokens` (already declared).

Creation:
- A `createCreditToken(game, player)` helper that increments the counter.

Consumption (the discount):
- When paying resources, the player may defeat N Credits to reduce the resources exhausted
  by N. Payment currently flows through `exhaustResources(game, player, count)` with
  `effectiveCost = Math.max(0, playCost(...) + costModifier)`
  (`src/server/engine/dispatch-listener.ts:407`). There are ~8 `exhaustResources` call
  sites, so this must be a **shared** payment helper, not a per-call patch: subtract
  defeated Credits from the cost (a negative `costModifier`) and decrement the counter,
  floored at 0 resources.
- Credits do not contribute to "resources controlled" checks (leader deploy, etc.).

Payment UX (the "Use Credits?" prompt):
- Fires whenever the player is about to pay resources for a card/ability, **only if** they
  control ≥1 Credit and the cost being paid is ≥1. Insert it before `exhaustResources`
  runs, as a pending resolution in the resolution chain.
- Model it on the existing **Exploit** two-step flow (`exploit-option` →
  `exploit-target`, "defeat up to N") — i.e. a Yes/No option pending followed by an amount
  pending — and reuse `AbilityOptionPending` for the Yes/No step.
- Let `maxUseful = min(creditsControlled, costRemaining)`. Defeating more Credits than the
  cost gives no extra discount, so the picker caps at `maxUseful`.
- **General case (`maxUseful` ≥ 2):**
  1. Ask "Use Credits?" — Yes / No.
  2. On **No**: pay the full resource cost.
  3. On **Yes**: choose a number between **1 and `maxUseful`**; defeat that many Credits,
     reduce the cost paid by that many, then exhaust the remaining resources.
- **Single-Credit case (`maxUseful` == 1):** collapse to one prompt "Use 1 Credit?" —
  Yes / No. On Yes, auto-defeat the 1 Credit (no amount step) and pay 1 less.
- The looped-test harness answers these prompts programmatically (e.g. always "Yes /
  max" when spending, or "No" while stockpiling).

## Phase 1 cards (credit generators — minimal fixtures to validate the mechanic)
- **LAW_244** Unmarked Credits (Event, cost 1) — "Create a Credit token."
  - Minimal create case.
- **LAW_247** Backed by the Hutts (Event, cost 3) — "Create a Credit token. You may deal
  damage to a unit equal to the number of friendly Credit tokens."
  - Exercises *reading* the friendly Credit count.

# Phase 2 — Infinite Credit loop
Cards to implement:
- **LAW_238** Scavenging Sandcrawler (Unit, Ground, cost 4, power 1, hp 7, *not unique*) —
  "On Attack: You may put a card from your discard pile on the bottom of your deck. If you
  do, create a Credit token."
- **ASH_229** Camtono (Upgrade/Item, cost 2) — Attached unit gains "When Attack Ends: Look
  at the top card of your deck. If it costs 2 or less, you may play it for free."
- **JTL_206** Fly Casual (Event, cost 1) — "Ready a Vehicle unit. It can't attack bases for
  this phase." (NOTE: spec previously said `JRL_206`/cost 3 — both wrong; it's `JTL_206`,
  cost 1, +aspect penalty when off-aspect.)
- **LAW_233** Galen Erso — *Destroying His Creation* (Unit, Ground, cost 3, power 0, hp 5,
  unique) — "When Played: You may have an opponent take control of this unit. Enemy units
  gain Raid 1 and Saboteur."
- **ASH_198** Nowhere to Hide (Upgrade/Condition, cost 2, **−2 power**) — Attached unit
  gains Sentinel.

## Setup
Assumes empty deck. Opponent already claimed initiative and has no units.
1. Play **Galen Erso** (LAW_233), choose YES to give him to the opponent. Galen is power 0
   and now an enemy unit — the Sandcrawler's punching bag. His text also grants *your* units
   Raid 1 and Saboteur.
2. Play **Scavenging Sandcrawler** (LAW_238). Attach **Camtono** (ASH_229) and
   **Nowhere to Hide** (ASH_198) to it.
   - Effective Sandcrawler power while attacking: 1 (base) + 1 (Galen's Raid) − 2 (Nowhere
     to Hide) = **0**. So it never kills Galen → loop never breaks. Both units sit at 0
     effective power and harmlessly trade swings.

## The loop (each iteration = +1 Credit)
1. Sandcrawler attacks Galen (can't attack bases due to Fly Casual; Galen is the only legal
   target).
2. **On Attack** (LAW_238): move Fly Casual from discard to the bottom of the deck. Deck is
   otherwise empty, so bottom == top. Create a **Credit**.
3. **When Attack Ends** (Camtono): top card is Fly Casual (cost 1 ≤ 2) → play it for **free**.
4. **Fly Casual** (JTL_206): ready the Sandcrawler → it can swing again. Fly Casual goes to
   discard. Go to 1.

Kickoff: play Fly Casual once from hand (paying its cost incl. aspect penalty) to ready the
Sandcrawler and start the first swing.

# Phase 3 — Win-con (consume Credits) + second test
- **SEC_264** Clandestine Connections (Upgrade/Supply, cost 2, +1/+1) — Attached unit gains
  "On Attack: You may pay 2 resources. If you do, deal 2 damage to a base."
  - With a stockpile of Credits, each attack can pay the 2 by defeating 2 Credits → 2 base
    damage per swing → close out the game. This validates *consuming* Credits via the
    payment-discount path (not just generating them).
  - Implement and test this **only after** Phase 2's infinite-credit test passes.

# Verify
- **Test 1 (Phase 2):** drive the loop and assert we can reach 100 Credits. Use a `for` loop
  in the test for the repeated swing/replay action code.
- **Test 2 (Phase 3):** attach SEC_264 to the looping Sandcrawler; generate a stockpile,
  then spend Credits via SEC_264's "pay 2" each swing to deal base damage and reach the win
  condition.

# Open questions
- Galen also grants your units **Saboteur** (bundled with his text, can't be opted out). It
  isn't required by the loop but is harmless — confirm no interaction breaks the combo.
