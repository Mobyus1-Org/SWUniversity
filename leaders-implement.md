# Leader Implementation Status (all sets)

Goal: **leader complete** — every leader in a real set has BOTH sides implemented and tested,
the front (undeployed) ability and the deployed leader-unit ability.

> Covers 154 leaders across SOR, SHD, TWI, JTL, LOF, LAW, SEC, ASH, IBH and TS26.
> Promo and token printings are excluded — they duplicate a base-set leader.

## Summary

| Status | Count |
|--------|-------|
| Complete (both sides) | 84 |
| Needs work | 70 |
| — of those, no engine code at all | 48 |
| — of those, front `Action` not in ActionAbilities() | 52 |
| **Total** | **154** |

## How status was derived

- **Front side missing** — the leader has an `Action [...]` ability whose id is absent from
  `ActionAbilities()` in `src/server/engine/actions/action-ability.ts` (so the ability can never be
  offered), or a triggered front ability (`When …: You may exhaust this leader`) with no handler.
- **Deployed side missing** — `cardLeaderUnitText` has a clause beyond bare keywords, and the id
  appears in no trigger file (on-attack / when-defeated / when-deployed / when-played / dispatch-listener).

⚠️ **These per-side flags are triage, not gospel — they err in BOTH directions.**

- *Too pessimistic:* a deployed clause served by a keyword dictionary reads as missing. TWI_009 Maul
  is flagged `deployed`, but his "each other friendly unit gains Overwhelm" is fully implemented in
  `overwhelm.ts`.
- *Too optimistic:* batch 1 found that SOR_017, SHD_009 and SHD_017 — all flagged `deployed` only —
  had **broken front sides too**. Each was listed in `ActionAbilities()` (so the button rendered)
  with no execution case at all: using it paid the cost and did nothing. Being *offered* is not
  being *implemented*.

Verify both sides against the card text when you pick a leader up; the Definition-of-Done gate in
`implement-swu-card` is what settles it. `tests/unit/engine/ability-registry-consistency.test.ts`
catches the offered-but-unimplemented case automatically — check its `KNOWN_GAPS` list first.

## Traps specific to leaders

1. **Two ability texts.** `cardText` (front) and `cardLeaderUnitText` (deployed) are separate fields.
   A leader is not done with only one wired. Read both before starting.
2. **The cost-table ghost.** These ids sit in `ActionAbilityCost` but not in `ActionAbilities()` — a
   `grep` hits, so they look implemented while the ability cannot be used:

   `JTL_003` `JTL_007` `JTL_015` `JTL_016` `LOF_006` `SEC_001` `SEC_010` `SEC_014` `TWI_008` `TWI_010` `TWI_013`

3. **The UI registry.** A front `Action` also needs its id in `LEADERS_WITH_ACTION_ABILITY` in
   `src/containers/PuzzlesPage.tsx`, or no button renders and the engine tests still pass.
4. **Deployed-side `Action` abilities** (e.g. SHD_017 Lando) are the easiest to miss entirely —
   they are activated abilities on the leader *unit*, not the leader card.

## Batch plan

Six leaders per batch (≈12 sides). Same process as a QA card batch: `implement-swu-card` →
brainstorm all upfront → approve → TDD each → full suite once → Definition-of-Done per card.
Tests go in `tests/unit/<set>/<leader-name>-leader.test.ts`.

| Batch | Leaders | Milestone | Done |
|-------|---------|-----------|------|
| Batch 1 | SOR_017 SHD_005 SHD_009 SHD_017 LOF_004 LOF_011 | Closes SOR + SHD | ☑ done |
| Batch 2 | LOF_001 LOF_006 LOF_008 LOF_010 TWI_003 TWI_009 | — | ☐ |
| Batch 3 | TWI_010 TWI_013 TWI_015 TWI_017 | Closes LOF + TWI | ☐ |
| Batch 4 | JTL_001 JTL_003 JTL_006 JTL_007 JTL_008 | — | ☐ |
| Batch 5 | JTL_011 JTL_015 JTL_016 JTL_017 | Closes JTL | ☐ |
| Batch 6 | SEC_001 SEC_002 SEC_003 SEC_005 SEC_008 | — | ☐ |
| Batch 7 | SEC_009 SEC_010 SEC_011 SEC_012 SEC_013 | — | ☐ |
| Batch 8 | SEC_014 SEC_016 SEC_017 SEC_018 | Closes SEC | ☐ |
| Batch 9 | LAW_001 LAW_002 LAW_004 LAW_005 LAW_006 | — | ☐ |
| Batch 10 | LAW_007 LAW_009 LAW_011 LAW_012 LAW_014 | — | ☐ |
| Batch 11 | LAW_015 LAW_016 LAW_017 LAW_018 | Closes LAW | ☐ |
| Batch 12 | ASH_001 ASH_002 ASH_003 ASH_005 ASH_006 | — | ☐ |
| Batch 13 | ASH_007 ASH_008 ASH_010 ASH_011 ASH_012 | — | ☐ |
| Batch 14 | ASH_013 ASH_015 ASH_016 ASH_017 ASH_018 | Closes ASH | ☐ |
| Batch 15 | TS26_01 TS26_02 TS26_03 TS26_04 | — | ☐ |
| Batch 16 | TS26_05 TS26_06 TS26_07 TS26_08 | Closes TS26 | ☐ |

---

## Leaders needing work, by set

### ASH (15)

#### ASH_001 — The Armorer (Steel Shapes Us)

**Missing:** front + deployed · **Batch:** Batch 12 · **Existing refs:** none

**Front:** Action [Exhaust]: Play an upgrade from your resources on a unit that entered play this phase (paying its cost). If you do, resource the top card of your deck.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** When Attack Ends: You may play an upgrade from your resources on a friendly unit. If you do, resource the top card of your deck.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### ASH_002 — Fennec Shand (Ready for War)

**Missing:** front + deployed · **Batch:** Batch 12 · **Existing refs:** none

**Front:** Action [1 resource, Exhaust, exhaust a friendly unit]: Play a unit from your hand (paying its cost). It enters play ready.<br>Epic Action: If you control 4 or more resources, deploy this leader.

**Deployed:** Saboteur<br>Action [1 resource, exhaust a friendly unit]: Play a unit from your hand. It enters play ready.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### ASH_003 — Baylan Skoll (Power Beyond Dream)

**Missing:** front + deployed · **Batch:** Batch 12 · **Existing refs:** none

**Front:** Action [1 resource, Exhaust]: Give a friendly unit +2/+2 for this phase if it's the only unit you control in its arena.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** On Attack: You may give a friendly unit +2/+2 and Sentinel for this phase if it's the only non-leader unit you control in its arena. (Enemy units in its arena must attack a Sentinel when they attack you.)

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### ASH_005 — Luke Skywalker (I Can Save Him)

**Missing:** front + deployed · **Batch:** Batch 12 · **Existing refs:** none

**Front:** When a friendly unit's attack ends: You may exhaust this leader. If you do, heal 1 damage from that unit.<br>Epic Action: If you control 7 or more resources, deploy this leader.

**Deployed:** When a friendly unit's attack ends: Heal 2 damage from that unit or from your base.

#### ASH_006 — Sabine Wren (Bargaining on Belief)

**Missing:** front + deployed · **Batch:** Batch 12 · **Existing refs:** none

**Front:** Action [Exhaust]: An opponent gives 2 Advantage tokens to a unit they control. If they do, the next unit you play this phase gains Shielded for this phase. (When you play that unit, give a Shield token to it.)<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** On Attack: The next unit you play this phase gains Shielded for this phase.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### ASH_007 — Grand Admiral Sloane (Holding the Empire Together)

**Missing:** front + deployed · **Batch:** Batch 13 · **Existing refs:** none

**Front:** Action [Exhaust]: Choose one:<br>Give each ground unit Sentinel and Overwhelm for this phase.<br>Give each space unit Sentinel and Overwhelm for this phase.<br><br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** Overwhelm<br>Each other friendly unit gains Overwhelm and Sentinel.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### ASH_008 — Moff Gideon (Indomitable Warlord)

**Missing:** front + deployed · **Batch:** Batch 13 · **Existing refs:** none

**Front:** Action [Exhaust]: If a friendly Imperial unit was defeated this phase, play a unit from your hand. It costs 1 resource less.<br>Epic Action: If you control 7 or more resources, deploy this leader.

**Deployed:** This unit gains each of the following keywords if it is on an Imperial unit in your discard pile: Ambush, Grit, Hidden, Overwhelm, Saboteur, Sentinel, Shielded, Support.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### ASH_010 — Bo-Katan Kryze (Reclaiming Mandalore)

**Missing:** front + deployed · **Batch:** Batch 13 · **Existing refs:** none

**Front:** Action [2 resources, Exhaust]: If you control a unit in each arena, create a Mandalorian token.<br>Epic Action: If the number of resources you control plus the number of friendly Mandalorian units is 10 or more, deploy this leader.

**Deployed:** Other friendly Mandalorian units get +1/+0.<br>On Attack: If you control a unit in each arena, create a Mandalorian token.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### ASH_011 — Cad Bane (Still Faster than You)

**Missing:** front + deployed · **Batch:** Batch 13 · **Existing refs:** none

**Front:** Action [Exhaust]: Deal 1 damage to a unit with 2 or more remaining HP.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** Overwhelm (When attacking an enemy unit, deal excess damage to the opponent's base.)<br>On Attack: You may deal 1 damage to a unit with 2 or more remaining HP.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### ASH_012 — Vane (Quarrelsome Pirate)

**Missing:** front + deployed · **Batch:** Batch 13 · **Existing refs:** none

**Front:** Action [Exhaust, defeat a friendly upgrade]: Deal 2 damage to a base.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** On Attack: You may defeat a friendly upgrade. If you do, deal 2 damage to the defending unit or a base.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### ASH_013 — Ezra Bridger (It's Now or Never)

**Missing:** front + deployed · **Batch:** Batch 14 · **Existing refs:** none

**Front:** When a friendly unit's attack ends: If it dealt 3 or more combat damage to a base, you may exhaust this leader. If you do, give an Advantage token to a different unit.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** Saboteur (When this unit attacks, ignore Sentinel and defeat the defender's Shields.)<br>When a friendly unit's attack ends: If it dealt 3 or more combat damage to a base, you may give an Advantage token to a different unit.

#### ASH_015 — Emperor Palpatine (According to My Design)

**Missing:** front + deployed · **Batch:** Batch 14 · **Existing refs:** none

**Front:** Action [Exhaust]: Choose an exhausted friendly unit. Give an Advantage token to it for each other friendly unit.<br>Epic Action: If you control 7 or more resources, deploy this leader.

**Deployed:** On Attack: You may choose another exhausted friendly unit. If you do, give an Advantage token to it for each other friendly unit.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### ASH_016 — Shin Hati (Eager Adversary)

**Missing:** front + deployed · **Batch:** Batch 14 · **Existing refs:** none

**Front:** When a friendly unit's attack ends: You may exhaust this leader. If you do, exhaust a unit that costs less than the amount of combat damage dealt to a base this attack.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** When a friendly unit's attack ends: You may exhaust a unit that costs less than the amount of combat damage dealt to a base this attack. Use this ability only once each round.

#### ASH_017 — Greef Karga (Gracious Magistrate)

**Missing:** front + deployed · **Batch:** Batch 14 · **Existing refs:** none

**Front:** When you play or create a unit: You may exhaust this leader. If you do, give an Advantage token to that unit.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** When you play or create a unit: Give an Advantage token to that unit.

#### ASH_018 — Grogu (Charming Companion)

**Missing:** front + deployed · **Batch:** Batch 14 · **Existing refs:** none

**Front:** When you play a <uq> unit that costs 4 or more: If this leader is ready, you may deploy him.

**Deployed:** While another friendly unit is defending, it gets +1/+0.<br>While another friendly unit is attacking, the defending unit gets –1/–0.

---

### JTL (9)

#### JTL_001 — Asajj Ventress (I Work Alone)

**Missing:** front · **Batch:** Batch 4 · **Existing refs:** `grit.ts`, `leader-pilot-deploy.ts`, `core-functions.ts`

**Front:** Action [Exhaust]: Deal 1 damage to a friendly unit. If you do, deal 1 damage to an enemy unit in the same arena.<br>Epic Action: If you control 6 or more resources, choose one:<br>Deploy this leader.<br>Deploy this leader as an upgrade on a friendly Vehicle unit without a Pilot on it.

**Deployed:** Grit<br>Attached unit is a leader unit. It gains Grit and: “On Attack: You may deal 1 damage to a friendly unit. If you do, deal 1 damage to an enemy unit in the same arena.”

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### JTL_003 — Lando Calrissian (Buying Time)

**Missing:** front · **Batch:** Batch 4 · **Existing refs:** `sentinel.ts`, `core-functions.ts`, `action-ability.ts`

**Front:** Action [1 resource, Exhaust]: Play a unit from your hand (paying its cost). If you do and you control a ground unit and a space unit, give a Shield token to a unit.<br>Epic Action: If you control 7 or more resources, choose one:<br>Deploy this leader.<br>Deploy this leader as an upgrade on a friendly Vehicle unit without a Pilot on it.

**Deployed:** Sentinel<br>Attached unit is a leader unit. <br>Attached unit gains Sentinel.<br>When deployed as an upgrade: You may give a Shield token to a unit in a different arena.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### JTL_006 — Darth Vader (Victor Squadron Leader)

**Missing:** front · **Batch:** Batch 4 · **Existing refs:** `core-functions.ts`

**Front:** Action [Exhaust]: If you attacked with a non-token Vehicle unit this phase, create a TIE Fighter token.<br>Epic Action: If you control 6 or more resources, choose one:<br>Deploy this leader.<br>Deploy this leader as an upgrade on a friendly Vehicle unit without a Pilot on it.

**Deployed:** Attached unit is a leader unit.<br>When deployed as an upgrade: Create 2 TIE Fighter tokens.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### JTL_007 — Admiral Holdo (We're Not Alone)

**Missing:** front + deployed · **Batch:** Batch 4 · **Existing refs:** `action-ability.ts`

**Front:** Action [1 resource, Exhaust]: Give a Resistance unit or a unit with a Resistance upgrade on it +2/+2 for this phase.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** On Attack: You may give another Resistance unit or a unit with a Resistance upgrade on it +2/+2 for this phase.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### JTL_008 — Wedge Antilles (Leader of Red Squadron)

**Missing:** front · **Batch:** Batch 4 · **Existing refs:** `core-functions.ts`

**Front:** Action [Exhaust]: Play a card from your hand using Piloting. It costs 1 resource less.<br>Epic Action: If you control 5 or more resources, choose one:<br>Deploy this leader.<br>Deploy this leader as an upgrade on a friendly Vehicle unit without a Pilot on it.

**Deployed:** Attached unit is a leader unit. It gains: “On Attack: The next Pilot card you play this phase costs 1 resource less. (This includes Piloting costs.)”

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### JTL_011 — Major Vonreg (Red Baron)

**Missing:** front · **Batch:** Batch 5 · **Existing refs:** `core-functions.ts`

**Front:** Action [Exhaust]: Play a Vehicle unit from your hand (paying its cost). If you do, give another unit +1/+0 for this phase.<br>Epic Action: If you control 4 or more resources, choose one:<br>Deploy this leader.<br>Deploy this leader as an upgrade on a friendly Vehicle unit without a Pilot on it.

**Deployed:** Attached unit is a leader unit. It gains: “On Attack: You may give another unit in this arena +1/+0 for this phase.”

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### JTL_015 — Rio Durant (Wisecracking Wheelman)

**Missing:** front · **Batch:** Batch 5 · **Existing refs:** `saboteur.ts`, `core-functions.ts`, `action-ability.ts`

**Front:** Action [1 resource, Exhaust]: Attack with a space unit. It gets +1/+0 and gains Saboteur for this attack. (Ignore Sentinel and defeat the defender's Shields.)<br>Epic Action: If you control 5 or more resources, choose one:<br>Deploy this leader.<br>Deploy this leader as an upgrade on a friendly Vehicle unit without a Pilot on it.

**Deployed:** Saboteur (When this unit attacks, ignore Sentinel and defeat the defender’s Shields.)<br>Attached unit is a leader unit. It gains Saboteur. If it’s a Transport, it also gets +1/+0.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### JTL_016 — Admiral Ackbar (It's A Trap!)

**Missing:** front + deployed · **Batch:** Batch 5 · **Existing refs:** `action-ability.ts`

**Front:** Action [1 resource, Exhaust]: Exhaust a non-leader unit. If you do, its controller creates an X-Wing token.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** On Attack: You may exhaust a unit. If you do, its controller creates an X-Wing token.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### JTL_017 — Han Solo (Never Tell Me the Odds)

**Missing:** front · **Batch:** Batch 5 · **Existing refs:** `core-functions.ts`

**Front:** Action [Exhaust]: Reveal the top card of your deck, then attack with a unit. If the revealed card and that unit have different odd costs, that unit gets +1/+0 for this attack.<br>Epic Action: If you control 5 or more resources, choose one:<br>Deploy this leader.<br>Deploy this leader as an upgrade on a friendly Vehicle unit without a Pilot on it.

**Deployed:** Attached unit is a leader unit.<br>When deployed as an upgrade: For each friendly unit or upgrade that has an odd cost, ready a resource.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

---

### LAW (14)

#### LAW_001 — Saw Gerrera (Bring Down the Empire)

**Missing:** front + deployed · **Batch:** Batch 9 · **Existing refs:** none

**Front:** Action [Exhaust]: Attack with a unit. It gets +2/+0 and gains Overwhelm for this attack. After completing this attack, defeat it.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** When Attack Ends: If this unit survived, you may attack with another unit. It gets +2/+0 and gains Overwhelm for this attack. After completing this attack, defeat it.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### LAW_002 — Tobias Beckett (People are Predictable)

**Missing:** front + deployed · **Batch:** Batch 9 · **Existing refs:** none

**Front:** Action [Exhaust]: Choose a friendly unit. An opponent takes control of it. If they do, create a Credit token.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** When Deployed: Defeat any number of units you own but don't control. For each unit defeated this way, create a Credit token and draw a card.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### LAW_004 — Aurra Sing (Assassin)

**Missing:** front + deployed · **Batch:** Batch 9 · **Existing refs:** none

**Front:** Action [Exhaust]: Defeat a non‑leader unit with 1 or less remaining HP.<br>Epic Action: If you control 7 or more resources, deploy this leader.

**Deployed:** When Deployed: You may defeat a non‑leader unit with 5 or less remaining HP.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### LAW_005 — Jyn Erso (Time to Fight)

**Missing:** front + deployed · **Batch:** Batch 9 · **Existing refs:** none

**Front:** Action [1 resource, Exhaust]: If a friendly Rebel unit was defeated this phase, search the top 3 cards of your deck for a card and draw it. (Put the other cards on the bottom of your deck in a random order.)<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** On Attack: If a friendly Rebel unit was defeated this phase, search the top 3 cards of your deck for a card and draw it.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### LAW_006 — Vel Sartha (Aldhani Insurgent)

**Missing:** front + deployed · **Batch:** Batch 9 · **Existing refs:** none

**Front:** Action [Exhaust]: Give an Experience token to a unit. An opponent creates a Credit token.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** On Attack: You may give an Experience token to a unit. If you do, an opponent creates a Credit token.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### LAW_007 — Boba Fett (Krayt's Claw Commander)

**Missing:** front + deployed · **Batch:** Batch 10 · **Existing refs:** none

**Front:** When a friendly Bounty Hunter unit's attack ends: If the defending unit was defeated, you may exhaust this leader. If you do, create a Credit token.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** Raid 1 (This unit gets +1/+0 while attacking.)<br>When a friendly Bounty Hunter unit's attack ends: If the defending unit was defeated, create a Credit token.

#### LAW_009 — Hera Syndulla (Not Fighting Alone)

**Missing:** front + deployed · **Batch:** Batch 10 · **Existing refs:** none

**Front:** While you control 2 or more units, ignore the aspect penalties on Heroism units you play.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** Restore 1 (When this unit attacks, heal 1 damage from your base.)<br>While you control 2 or more units, ignore the aspect penalties on Heroism units you play.

#### LAW_011 — Darth Vader (Unstoppable)

**Missing:** front + deployed · **Batch:** Batch 10 · **Existing refs:** none

**Front:** Action [Exhaust, discard a card from your hand]: Deal 1 damage to a unit or base.<br>Epic Action: If you control 7 or more resources, deploy this leader.

**Deployed:** On Attack: Discard any number of cards from your hand. Deal damage to a unit or base equal to the number of cards discarded this way.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### LAW_012 — Sebulba (Especially Dangerous Dug)

**Missing:** front + deployed · **Batch:** Batch 10 · **Existing refs:** none

**Front:** Action [Exhaust, discard a card from your deck]: A friendly unit gains Raid 1 for this phase.<br>Epic Action: If you control 4 or more resources, deploy this leader.

**Deployed:** Raid 1<br>On Attack: Discard a card from your deck.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### LAW_014 — Enfys Nest (Until We Can Go No Higher)

**Missing:** front + deployed · **Batch:** Batch 10 · **Existing refs:** none

**Front:** When you use an “On Attack” ability: You may pay 2 resources and exhaust this leader. If you do, use that ability again.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** When you use an “On Attack” ability: You may use that ability again. Use this ability only once each round.

#### LAW_015 — Jabba the Hutt (Crime Boss)

**Missing:** front + deployed · **Batch:** Batch 11 · **Existing refs:** none

**Front:** Action [1 resource, Exhaust, return a friendly Underworld unit to its owner's hand]: Create a Credit token.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** Action: Play an Underworld unit from your hand. If you defeated a Credit while paying its cost, that unit gains Ambush for this phase.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### LAW_016 — The Client (Please Lower Your Blaster)

**Missing:** front + deployed · **Batch:** Batch 11 · **Existing refs:** none

**Front:** Action [Exhaust]: If you created a token this phase, exhaust an enemy unit.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** Shielded (When you deploy this leader, give him a Shield token.)<br>On Attack: If you created a token this phase, exhaust an enemy unit.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### LAW_017 — Han Solo (I Got a Really Good Feeling)

**Missing:** front + deployed · **Batch:** Batch 11 · **Existing refs:** none

**Front:** Action [Exhaust, defeat a friendly token]: Deal 1 damage to a unit.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** Saboteur (When this unit attacks, ignore Sentinel and defeat the defender's Shields.)<br>On Attack: Defeat any number of friendly tokens. Deal damage to a unit equal to the number of tokens defeated this way.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### LAW_018 — Lando Calrissian (Full Sabacc)

**Missing:** front + deployed · **Batch:** Batch 11 · **Existing refs:** none

**Front:** Action [1 resource, Exhaust]: Choose an aspect, then discard a card from a deck. If it has the chosen aspect, create a Credit token.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** When Deployed: You may defeat a friendly Credit token. If you do, create 3 Credit tokens.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

---

### LOF (4)

#### LOF_001 — Kylo Ren (We're Not Done Yet)

**Missing:** front + deployed · **Batch:** Batch 2 · **Existing refs:** `overwhelm.ts`, `sentinel.ts`

**Front:** Action [Exhaust]: Discard a card from your hand. If you discarded an upgrade this way, draw a card.<br>Epic Action: If you control 7 or more resources, deploy this leader.

**Deployed:** Sentinel<br>When Deployed: Play any number of upgrades from your discard pile on this unit (one at a time, paying their costs).

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### LOF_006 — Supreme Leader Snoke (In the Seat of Power)

**Missing:** front + deployed · **Batch:** Batch 2 · **Existing refs:** `action-ability.ts`

**Front:** Action [1 resource, Exhaust]: Give an Experience token to the unit with the most power among friendly Villainy units. (If multiple units are tied, choose one.)<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** On Attack: Give an Experience token to the unit with the most power among friendly Villainy units.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### LOF_008 — Obi-Wan Kenobi (Courage Makes Heroes)

**Missing:** front + deployed · **Batch:** Batch 2 · **Existing refs:** `sentinel.ts`

**Front:** Action [Exhaust, use the Force (lose your Force token)]: Give an Experience token to a unit without an Experience token on it.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** On Attack: You may give an Experience token to another unit without an Experience token on it.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### LOF_010 — Third Sister (Seething With Ambition)

**Missing:** front + deployed · **Batch:** Batch 2 · **Existing refs:** `hidden.ts`

**Front:** Action [Exhaust]: Play a unit from your hand. It gains Hidden for this phase. (It can't be attacked for this phase unless it has Sentinel.)<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** Hidden (This unit can't be attacked if she was deployed this phase.)<br>On Attack: The next unit you play this phase gains Hidden.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

---

### SEC (14)

#### SEC_001 — Chancellor Palpatine (How Liberty Dies)

**Missing:** front + deployed · **Batch:** Batch 6 · **Existing refs:** `action-ability.ts`

**Front:** Action [1 resource, Exhaust]: Search the top 5 cards of your deck for a card with Plot, reveal it, and draw it. (Put the other cards on the bottom of your deck in a random order.)<br>Epic Action: If you control 7 or more resources, deploy this leader.

**Deployed:** When Deployed: The next card you play using Plot this phase costs 3 resources less.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### SEC_002 — Jabba the Hutt (Wonderful Human Being)

**Missing:** front + deployed · **Batch:** Batch 6 · **Existing refs:** none

**Front:** Action [1 resource, Exhaust]: A friendly damaged unit deals 1 damage to an enemy unit. If the friendly unit has 3 or more damage on it, it deals 2 damage instead.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** When another friendly unit is dealt damage and survives: You may have that unit deal that much damage to an enemy unit. Use this ability only once each round.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### SEC_003 — Lama Su (We Modified Their Genetics)

**Missing:** front + deployed · **Batch:** Batch 6 · **Existing refs:** none

**Front:** Action [Exhaust]: Play an upgrade from your hand on a friendly non-Vehicle unit. It costs 1 resource less. If you do, deal 1 damage to that unit.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** When this unit completes an attack (and survives): You may play an upgrade from your discard pile on a friendly non-Vehicle unit. It costs 1 resource less.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### SEC_005 — Satine Kryze (Standing on Principles)

**Missing:** front · **Batch:** Batch 6 · **Existing refs:** `restore.ts`

**Front:** Action [Exhaust]: Heal up to 2 damage from a unit. If you do, deal that much damage to your base.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** Restore 4

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### SEC_008 — Bail Organa (Doing Everything He Can)

**Missing:** front + deployed · **Batch:** Batch 6 · **Existing refs:** none

**Front:** Action [1 resource, Exhaust]: If a friendly unit was defeated this phase, return a friendly resource to its owner's hand. If you do, put the top card of your deck into play as a resource.<br>Action [Exhaust, discard 2 cards from your hand]: If you control 4 or more resources, deploy this leader.

**Deployed:** When you play a card from your resources: Heal 1 damage from your base.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### SEC_009 — Mon Mothma (Forming a Coalition)

**Missing:** deployed · **Batch:** Batch 7 · **Existing refs:** none

**Front:** Ignore the aspect penalties on non-Villainy Official units you play.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** Ignore the aspect penalties on non‑Villainy Official units you play.<br>Each other friendly Official unit gets +0/+1.

#### SEC_010 — Dedra Meero (Not Wasting Time)

**Missing:** front + deployed · **Batch:** Batch 7 · **Existing refs:** `raid.ts`, `action-ability.ts`

**Front:** Action [1 resource, Exhaust]: Choose an enemy unit. Its controller may deal 2 damage to it. If they don't, draw a card.<br>Epic Action: If you control 4 or more resources, deploy this leader.

**Deployed:** While you have more cards in hand than an opponent, this unit gains Raid 2. (She gets +2/+0 while attacking.)

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### SEC_011 — Governor Pryce (Tyrant of Lothal)

**Missing:** front + deployed · **Batch:** Batch 7 · **Existing refs:** none

**Front:** Action [1 resource, Exhaust]: Ready a token unit.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** This unit gets +1/+0 for each ready friendly token unit.<br>On Attack: Create a Spy token.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### SEC_012 — Cassian Andor (Climb!)

**Missing:** deployed · **Batch:** Batch 7 · **Existing refs:** none

**Front:** Friendly units that have damaged an opponent's base this phase can't be attacked (unless they have Sentinel).<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** Overwhelm<br>While you have the initiative, this unit isn't defeated by having no remaining HP and can't be defeated by enemy card abilities.

#### SEC_013 — Luthen Rael (Don't You Want to Fight For Real?)

**Missing:** front + deployed · **Batch:** Batch 7 · **Existing refs:** none

**Front:** When a friendly unit is defeated while attacking: You may exhaust this leader. If you do, deal 1 damage to a unit or base.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** When a friendly unit is defeated while attacking: You may deal 2 damage to a unit or base.

#### SEC_014 — Sly Moore (Cipher in the Dark)

**Missing:** front + deployed · **Batch:** Batch 8 · **Existing refs:** `action-ability.ts`

**Front:** Action [1 resource, Exhaust]: If there are 4 or more exhausted units in play, create a Spy token.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** On Attack: You may deal 2 damage to an exhausted unit.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### SEC_016 — Padmé Amidala (What Do You Have to Hide?)

**Missing:** front + deployed · **Batch:** Batch 8 · **Existing refs:** none

**Front:** When you reveal or discard 1 or more cards from your hand: You may exhaust this leader. If you do, deal 1 damage to a unit.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** When you reveal or discard 1 or more cards from your hand: You may deal 1 damage to a unit.

#### SEC_017 — Sabé (Queen's Shadow)

**Missing:** front + deployed · **Batch:** Batch 8 · **Existing refs:** none

**Front:** When a friendly unit deals combat damage to a base: You may exhaust this leader. If you do, look at the top 2 cards of the defending player's deck. Discard 1 of those cards. (Put the other back on top.)<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** Raid 1<br>When this unit deals combat damage to a base: Look at the defending player's hand. You may discard a card from it. If you do, that player draws a card.

#### SEC_018 — DJ (Need a Lift?)

**Missing:** front + deployed · **Batch:** Batch 8 · **Existing refs:** none

**Front:** Action [Exhaust]: Choose a friendly unit. If you do, play a unit from your hand. It costs 1 resource less. The chosen unit captures it. (When Played abilities resolve after the unit is captured.)<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** Saboteur<br>Friendly units that are rescued enter play ready.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

---

### SHD (0 — complete)

---

### SOR (0 — complete)

---

### TS26 (8)

#### TS26_01 — Count Dooku (Offering Aid)

**Missing:** front + deployed · **Batch:** Batch 15 · **Existing refs:** none

**Front:** Action [Exhaust]: Choose 2 players. They each heal 1 damage from their base and create a Battle Droid token.<br>Epic Action: If you control 7 or more resources, deploy this leader.

**Deployed:** Restore 2 (When this unit attacks, heal 2 damage from your base.)<br>On Attack: Create 2 Battle Droid tokens.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### TS26_02 — Anakin Skywalker (Protect Her At All Costs)

**Missing:** front + deployed · **Batch:** Batch 15 · **Existing refs:** none

**Front:** Action [Exhaust]: If 2 or more friendly units entered play this phase (including tokens and leaders), give a Shield token to 1 of them.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** Sentinel (Enemy units in this arena must attack a Sentinel when they attack you.)<br>On Attack: Give a Shield token to another friendly unit that entered play this phase.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### TS26_03 — Maul (Collective Ambition)

**Missing:** front + deployed · **Batch:** Batch 15 · **Existing refs:** none

**Front:** Action [Exhaust]: Choose a unit. If it has more different keywords than it has Experience tokens on it, give an Experience token to it and deal 1 damage to it.<br>Epic Action: If you control 7 or more resources, deploy this leader.

**Deployed:** When Deployed/On Attack: Choose a unit. If it has more different keywords than it has Experience tokens on it, give an Experience token to it and deal 1 damage to it.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### TS26_04 — Padmé Amidala (Follow My Lead)

**Missing:** front + deployed · **Batch:** Batch 15 · **Existing refs:** none

**Front:** Action [Exhaust]: If 2 or more friendly units entered play this phase (including tokens and leaders) , attack with 1 of them, even if it's exhausted. It can't attack bases for this attack.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** When Attack Ends: You may attack with another friendly unit that entered play this phase, even if it's exhausted. It can't attack bases for this attack.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### TS26_05 — Savage Opress (You Must Have Your Revenge)

**Missing:** deployed · **Batch:** Batch 16 · **Existing refs:** none

**Front:** Each friendly unit with the most power among friendly units gains Overwhelm. (When attacking an enemy unit, deal excess damage to the opponent's base.)<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** Raid 3 (This unit gets +3/+0 while attacking.)<br>Overwhelm<br>Each other friendly unit gains Overwhelm.

#### TS26_06 — Rex (No Other Option)

**Missing:** front + deployed · **Batch:** Batch 16 · **Existing refs:** none

**Front:** Action [Exhaust, ready an exhausted enemy unit]: The next event you play this phase costs 1 resource less.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** On Attack: You may ready an exhausted enemy unit. If you do, the next event you play this phase costs 2 resources less.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### TS26_07 — Asajj Ventress (Ambitious Apprentice)

**Missing:** front + deployed · **Batch:** Batch 16 · **Existing refs:** none

**Front:** Action [Exhaust]: Attack with a token unit. It gets +1/+0 for this attack.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** Hidden (This unit can't be attacked if she was deployed this phase.) <br>While you've attacked with a token unit this phase, this unit gets +2/+0.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### TS26_08 — Ahsoka Tano (I Have an Idea)

**Missing:** front + deployed · **Batch:** Batch 16 · **Existing refs:** none

**Front:** When you play an event: You may exhaust this leader. If you do, look at the top card of your deck. You may play it (paying its cost), discard it, or leave it on top of your deck.<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** Raid 1 (This unit gets +1/+0 while attacking.)<br>When Attack Ends: Look at the top card of your deck. You may play it, discard it, or leave it on top of your deck. If you play it, it costs 1 resource less.

---

### TWI (6)

#### TWI_003 — Obi-Wan Kenobi (Patient Mentor)

**Missing:** front + deployed · **Batch:** Batch 2 · **Existing refs:** `sentinel.ts`

**Front:** Action [Exhaust]: Heal 1 damage from a unit.<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** Sentinel (Units in this arena can’t attack your non-Sentinel units or your base.)<br>On Attack: Heal 1 damage from a unit. If you do, deal 1 damage to a different unit.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### TWI_009 — Maul (A Rival in Darkness)

**Missing:** front + deployed · **Batch:** Batch 2 · **Existing refs:** `overwhelm.ts`

**Front:** Action [Exhaust]: Attack with a unit. It gains Overwhelm for this attack. (When attacking an enemy unit, deal excess damage to the opponent's base.)<br>Epic Action: If you control 6 or more resources, deploy this leader.

**Deployed:** Overwhelm<br>Each other friendly unit gains Overwhelm.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### TWI_010 — Pre Vizsla (Pursuing the Throne)

**Missing:** front + deployed · **Batch:** Batch 3 · **Existing refs:** `saboteur.ts`, `action-ability.ts`

**Front:** Action [1 resource, Exhaust]: Deal damage to a unit equal to the number of cards you've drawn this phase. (This doesn't include cards drawn in the regroup phase.)<br>Epic Action: If you control 5 or more resources, deploy this leader.

**Deployed:** While you have 3 or more cards in your hand, this unit gains Saboteur.<br>While you have 6 or more cards in your hand, this unit gets +2/+0.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### TWI_013 — Mace Windu (Vaapad Form Master)

**Missing:** front + deployed · **Batch:** Batch 3 · **Existing refs:** `action-ability.ts`

**Front:** Action [1 resource, Exhaust]: Deal 1 damage to a damaged enemy unit. Then, if it has 5 or more damage on it, deal 1 damage to it.<br>Epic Action: If you control 7 or more resources, deploy this leader.

**Deployed:** When Deployed: Deal 2 damage to each damaged enemy unit.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### TWI_015 — General Grievous (General of the Droid Armies)

**Missing:** front + deployed · **Batch:** Batch 3 · **Existing refs:** `sentinel.ts`

**Front:** Action [Exhaust]: Give a Droid unit Sentinel for this phase. (Units in its arena can't attack your non-Sentinel units or your base.)<br>Epic Action: If you control 6 or more resources, deploy this leader. (Flip him, ready him, and move him to the ground arena.)

**Deployed:** On Attack: You may give a Droid unit +1/+0 and Sentinel for this phase.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

#### TWI_017 — Chancellor Palpatine (Playing Both Sides)

**Missing:** front + deployed · **Batch:** Batch 3 · **Existing refs:** none

**Front:** This leader starts the game with this side faceup.<br>Action [Exhaust]: If a friendly Heroism unit was defeated this phase, draw a card, heal 2 damage from your base, then flip this leader.

**Deployed:** Action [Exhaust]: If you played a Villainy card this phase, create a Clone Trooper token, deal 2 damage to each enemy base, then flip this leader.

> Needs a `LEADERS_WITH_ACTION_ABILITY` entry in `PuzzlesPage.tsx` when implemented.

---

## Complete (both sides)

| ID | Leader | Set |
|----|--------|-----|
| LOF_004 | Kanan Jarrus — Help Us Survive | LOF |
| LOF_011 | Kit Fisto — Focused Jedi Master | LOF |
| SHD_005 | Hondo Ohnaka — That's Good Business | SHD |
| SHD_009 | Hunter — Outcast Sergeant | SHD |
| SHD_017 | Lando Calrissian — With Impeccable Taste | SHD |
| SOR_017 | Han Solo — Audacious Smuggler | SOR |
| ASH_004 | Grand Admiral Thrawn — Victory is Mine | ASH |
| ASH_009 | Ahsoka Tano — Trust in the Force | ASH |
| ASH_014 | The Mandalorian — We Can't Keep Running | ASH |
| IBH_001 | Leia Organa — Get to Your Transports! | IBH |
| IBH_053 | Darth Vader — Don't Fail Me Again | IBH |
| JTL_002 | Grand Admiral Thrawn — ...How Unfortunate | JTL |
| JTL_004 | Rose Tico — Saving What We Love | JTL |
| JTL_005 | Admiral Piett — Commanding the Armada | JTL |
| JTL_009 | Boba Fett — Any Methods Necessary | JTL |
| JTL_010 | Captain Phasma — Chrome Dome | JTL |
| JTL_012 | Luke Skywalker — Hero of Yavin | JTL |
| JTL_013 | Poe Dameron — I Can Fly Anything | JTL |
| JTL_014 | Admiral Trench — Chk-chk-chk-chk | JTL |
| JTL_018 | Kazuda Xiono — Best Pilot in the Galaxy | JTL |
| LAW_003 | Agent Kallus — Reconsider Your Allegiance | LAW |
| LAW_008 | Director Krennic — Amidst My Achievement | LAW |
| LAW_010 | Leia Organa — Someone Who Loves You | LAW |
| LAW_013 | Chewbacca — Hero of Kessel | LAW |
| LOF_002 | Mother Talzin — Power Through Magick | LOF |
| LOF_003 | Ahsoka Tano — Fighting For Peace | LOF |
| LOF_005 | Morgan Elsbeth — Following the Call | LOF |
| LOF_007 | Avar Kriss — Marshal of Starlight | LOF |
| LOF_009 | Darth Maul — Sith Revealed | LOF |
| LOF_012 | Rey — Nobody | LOF |
| LOF_013 | Barriss Offee — We Have Become Villains | LOF |
| LOF_014 | Grand Inquisitor — Stories Travel Quickly | LOF |
| LOF_015 | Cal Kestis — I Can't Keep Hiding | LOF |
| LOF_016 | Qui-Gon Jinn — Student of the Living Force | LOF |
| LOF_017 | Darth Revan — Scourge of the Old Republic | LOF |
| LOF_018 | Anakin Skywalker — Tempted by the Dark Side | LOF |
| SEC_004 | Leia Organa — Of A Secret Bloodline | SEC |
| SEC_006 | Colonel Yularen — This Is Why We Plan | SEC |
| SEC_007 | Dryden Vos — I Never Ask Twice | SEC |
| SEC_015 | C-3PO — Human-Cyborg Relations | SEC |
| SHD_001 | Gar Saxon — Viceroy of Mandalore | SHD |
| SHD_002 | Qi'ra — I Alone Survived | SHD |
| SHD_003 | Finn — This is a Rescue | SHD |
| SHD_004 | Rey — More Than a Scavenger | SHD |
| SHD_006 | Jabba the Hutt — His High Exaltedness | SHD |
| SHD_007 | Moff Gideon — Formidable Commander | SHD |
| SHD_008 | Boba Fett — Daimyo | SHD |
| SHD_010 | Bossk — Hunting His Prey | SHD |
| SHD_011 | Kylo Ren — Rash and Deadly | SHD |
| SHD_012 | Bo-Katan Kryze — Princess in Exile | SHD |
| SHD_013 | Han Solo — Worth the Risk | SHD |
| SHD_014 | Cad Bane — He Who Needs No Introduction | SHD |
| SHD_015 | Doctor Aphra — Rapacious Archaeologist | SHD |
| SHD_016 | Fennec Shand — Honoring the Deal | SHD |
| SHD_018 | The Mandalorian — Sworn To The Creed | SHD |
| SOR_001 | Director Krennic — Aspiring to Authority | SOR |
| SOR_002 | Iden Versio — Inferno Squad Commander | SOR |
| SOR_003 | Chewbacca — Walking Carpet | SOR |
| SOR_004 | Chirrut Îmwe — One With The Force | SOR |
| SOR_005 | Luke Skywalker — Faithful Friend | SOR |
| SOR_006 | Emperor Palpatine — Galactic Ruler | SOR |
| SOR_007 | Grand Moff Tarkin — Oversector Governor | SOR |
| SOR_008 | Hera Syndulla — Spectre Two | SOR |
| SOR_009 | Leia Organa — Alliance General | SOR |
| SOR_010 | Darth Vader — Dark Lord of the Sith | SOR |
| SOR_011 | Grand Inquisitor — Hunting the Jedi | SOR |
| SOR_012 | IG-88 — Ruthless Bounty Hunter | SOR |
| SOR_013 | Cassian Andor — Dedicated to the Rebellion | SOR |
| SOR_014 | Sabine Wren — Galvanized Revolutionary | SOR |
| SOR_015 | Boba Fett — Collecting the Bounty | SOR |
| SOR_016 | Grand Admiral Thrawn — Patient and Insightful | SOR |
| SOR_018 | Jyn Erso — Resisting Oppression | SOR |
| TWI_001 | Nala Se — Clone Engineer | TWI |
| TWI_002 | Nute Gunray — Vindictive Viceroy | TWI |
| TWI_004 | Yoda — Sensing Darkness | TWI |
| TWI_005 | Count Dooku — Face of the Confederacy | TWI |
| TWI_006 | Wat Tambor — Techno Union Foreman | TWI |
| TWI_007 | Captain Rex — Fighting For His Brothers | TWI |
| TWI_008 | Padmé Amidala — Serving the Republic | TWI |
| TWI_011 | Ahsoka Tano — Snips | TWI |
| TWI_012 | Anakin Skywalker — What it Takes to Win | TWI |
| TWI_014 | Asajj Ventress — Unparalleled Adversary | TWI |
| TWI_016 | Jango Fett — Concealing the Conspiracy | TWI |
| TWI_018 | Quinlan Vos — Sticking the Landing | TWI |
