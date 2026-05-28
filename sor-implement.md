# SOR Implementation Status (SOR_031 – SOR_252)

> Analysis covers 214 cards (SOR_031–SOR_252). Some IDs may be absent if they do not exist in the set.

## Summary

| Status | Count |
|--------|-------|
| Implemented | 99 |
| Partially Implemented | 41 |
| Keywords Only (auto-handled) | 23 |
| Unimplemented – Simple | 2 |
| Unimplemented – Complex | 70 |
| **Total** | **214** |

---

## Unimplemented – SIMPLE (agent can tackle without human help)

These cards can be implemented with existing engine mechanics.

### SOR_043 — Superlaser Blast (Event)
**Card Text:** Defeat all units.

**Notes:** Needs implementation: Defeat all units.

### SOR_172 — Open Fire (Event)
**Card Text:** Deal 4 damage to a unit.

**Notes:** Needs implementation: Deal 4 damage to a unit.

---

## Unimplemented – COMPLEX (requires senior dev consultation)

These cards need new engine features or unusual interactions.

### SOR_031 — Inferno Four (Unit)
**Card Text:** When Played/When Defeated: Look at the top 2 cards of your deck. Put any number of them on the bottom of your deck and the rest on top in any order.

**Notes:** Needs implementation: When Played/When Defeated: Look at the top 2 cards of your deck. Put any number of them on the botto

### SOR_036 — Gideon Hask (Unit)
**Card Text:** When an enemy unit is defeated: Give an Experience token to a friendly unit.

**Notes:** Needs implementation: When an enemy unit is defeated: Give an Experience token to a friendly unit.

### SOR_074 — Repair (Event)
**Card Text:** Heal 3 damage from a unit or base.

**Notes:** Needs base-targeting support — engine's ability-target only handles unit playIds. The target can be any unit OR either player's base, which requires a new targeting mode or a multi-step choice flow.

### SOR_040 — Avenger (Unit)
**Card Text:** When Played/On Attack: An opponent chooses a non‑leader unit they control. Defeat that unit.

**Notes:** Needs implementation: When Played/On Attack: An opponent chooses a non‑leader unit they control. Defeat that unit.

### SOR_041 — Power of the Dark Side (Event)
**Card Text:** An opponent chooses a unit they control. Defeat that unit.

**Notes:** Needs implementation: An opponent chooses a unit they control. Defeat that unit.

### SOR_042 — Search Your Feelings (Event)
**Card Text:** Search your deck for a card and draw it. (Then, shuffle your deck.)

**Notes:** Needs implementation: Search your deck for a card and draw it. (Then, shuffle your deck.)

### SOR_047 — Kanan Jarrus (Unit)
**Card Text:** On Attack: You may discard 1 card from the defending player's deck for each friendly SPECTRE unit. Heal 1 damage from your base for each different aspect among the discarded cards.

**Notes:** Needs implementation: On Attack: You may discard 1 card from the defending player's deck for each friendly SPECTRE unit. Hea

### SOR_055 — The Force Is With Me (Event)
**Card Text:** Choose a friendly unit and give 2 Experience tokens to it. If you control a FORCE unit, also give a Shield token to the chosen unit. You may attack with the chosen unit.

**Notes:** Needs implementation: Choose a friendly unit and give 2 Experience tokens to it. If you control a FORCE unit, also give a S

### SOR_058 — Vigilance (Event)
**Card Text:** Choose two, in any order:

Discard 6 cards from an opponent's deck.
Heal 5 damage from a base.
Defeat a unit with 3 or less remaining HP.
Give a Shield token to a unit.

**Notes:** Needs implementation: Choose two, in any order:

Discard 6 cards from an opponent's deck.
Heal 5 damage from a base.
Defe

### SOR_061 — Guardian of the Whills (Unit)
**Card Text:** The first upgrade you play on this unit each round costs [1 resource] less.

**Notes:** Needs implementation: The first upgrade you play on this unit each round costs [1 resource] less.

### SOR_062 — Regional Governor (Unit)
**Card Text:** When Played: Name a card. While this unit is in play, opponents can't play the named card.

**Notes:** Needs implementation: When Played: Name a card. While this unit is in play, opponents can't play the named card.

### SOR_075 — It Binds All Things (Event)
**Card Text:** Heal up to 3 damage from a unit. If you control a FORCE unit, you may deal that much damage to another unit.

**Notes:** Needs implementation: Heal up to 3 damage from a unit. If you control a FORCE unit, you may deal that much damage to anoth

### SOR_081 — Seasoned Shoretrooper (Unit)
**Card Text:** While you control 6 or more resources, this unit gets +2/+0.

**Notes:** Needs implementation: While you control 6 or more resources, this unit gets +2/+0.

### SOR_084 — Grand Moff Tarkin (Unit)
**Card Text:** When Played: Search the top 5 cards of your deck for up to 2 Imperial cards, reveal them, and draw them. (Put the other cards on the bottom of your deck in a random order.)

**Notes:** Needs implementation: When Played: Search the top 5 cards of your deck for up to 2 Imperial cards, reveal them, and draw the

### SOR_088 — Blizzard Assault AT-AT (Unit)
**Card Text:** When this unit attacks and defeats a unit: You may deal the excess damage from this attack to an enemy ground unit.

**Notes:** Needs implementation: When this unit attacks and defeats a unit: You may deal the excess damage from this attack to an ene

### SOR_089 — Relentless (Unit)
**Card Text:** The first event played by each opponent each round loses all abilities.

**Notes:** Needs implementation: The first event played by each opponent each round loses all abilities.

### SOR_091 — The Emperor's Legion (Event)
**Card Text:** Return each unit in your discard pile that was defeated this phase to your hand.

**Notes:** Needs implementation: Return each unit in your discard pile that was defeated this phase to your hand.

### SOR_093 — Alliance Dispatcher (Unit)
**Card Text:** Action [exhaust]: Play a unit from your hand. It costs [1 resource] less.

**Notes:** Needs implementation: Action [exhaust]: Play a unit from your hand. It costs [1 resource] less.

### SOR_094 — Bail Organa (Unit)
**Card Text:** Action [Exhaust]: Give an Experience token to another friendly unit.

**Notes:** Needs implementation: Action [Exhaust]: Give an Experience token to another friendly unit.

### SOR_096 — Mon Mothma (Unit)
**Card Text:** When Played: Search the top 5 cards of your deck for a REBEL card, reveal it, and draw it. (Put the other cards on the bottom of your deck in a random order.)

**Notes:** Needs implementation: When Played: Search the top 5 cards of your deck for a REBEL card, reveal it, and draw it. (Put the 

### SOR_105 — General Krell (Unit)
**Card Text:** Each other friendly unit gains: "When Defeated: You may draw a card."

**Notes:** Needs implementation: Each other friendly unit gains: "When Defeated: You may draw a card."

### SOR_109 — Colonel Yularen (Unit)
**Card Text:** When you play a [Command] unit (including this one): Heal 1 damage from your base.

**Notes:** Needs implementation: When you play a [Command] unit (including this one): Heal 1 damage from your base.

### SOR_110 — Frontline Shuttle (Unit)
**Card Text:** Action [defeat this unit]: Attack with a unit, even if it's exhausted. It can't attack bases for this attack.

**Notes:** Needs implementation: Action [defeat this unit]: Attack with a unit, even if it's exhausted. It can't attack bases for thi

### SOR_113 — Homestead Militia (Unit)
**Card Text:** While you control 6 or more resources, this unit gains Sentinel. (Units in this arena can't attack your non-Sentinel units or your base.)

**Notes:** Needs implementation: While you control 6 or more resources, this unit gains Sentinel. (Units in this arena can't attack y

### SOR_118 — 97th Legion (Unit)
**Card Text:** This unit gets +1/+1 for each resource you control.

**Notes:** Needs implementation: This unit gets +1/+1 for each resource you control.

### SOR_119 — Reinforcement Walker (Unit)
**Card Text:** When Played/On Attack: Look at the top card of your deck. Either draw that card or discard it and heal 3 damage from your base.

**Notes:** Needs implementation: When Played/On Attack: Look at the top card of your deck. Either draw that card or discard it and he

### SOR_125 — Prepare for Takeoff (Event)
**Card Text:** Search the top 8 cards of your deck for up to 2 Vehicle units, reveal them, and draw them. (Put the other cards on the bottom of your deck in a random order.)

**Notes:** Needs implementation: Search the top 8 cards of your deck for up to 2 Vehicle units, reveal them, and draw them. (Put the 

### SOR_126 — Resupply (Event)
**Card Text:** Put this event into play as a resource.

**Notes:** Needs implementation: Put this event into play as a resource.

### SOR_129 — Admiral Ozzel (Unit)
**Card Text:** Action [exhaust]: Play an Imperial unit from your hand (paying its cost). It enters play ready. Each opponent may ready a unit.

**Notes:** Needs implementation: Action [exhaust]: Play an Imperial unit from your hand (paying its cost). It enters play ready. Each

### SOR_139 — Force Choke (Event)
**Card Text:** If you control a FORCE unit, this event costs [1 resource] less to play. 

Deal 5 damage to a non-VEHICLE unit. That unit's controller draws a card.

**Notes:** Needs implementation: If you control a FORCE unit, this event costs [1 resource] less to play. 

Deal 5 damage to a non-

### SOR_142 — Sabine Wren (Unit)
**Card Text:** While there are at least 3 aspects among other friendly units, this unit can't be attacked (unless she gains Sentinel).

On Attack: You may deal 1 damage to the defender or to a base.

**Notes:** Needs implementation: While there are at least 3 aspects among other friendly units, this unit can't be attacked (unless s

### SOR_146 — Zeb Orrelios (Unit)
**Card Text:** When this unit completes an attack: If the defender was defeated, you may deal 4 damage to a ground unit.

**Notes:** Needs implementation: When this unit completes an attack: If the defender was defeated, you may deal 4 damage to a ground 

### SOR_147 — Black One (Unit)
**Card Text:** When Played/When Defeated: You may discard your hand. If you do, draw 3 cards.

**Notes:** Needs implementation: When Played/When Defeated: You may discard your hand. If you do, draw 3 cards.

### SOR_152 — For a Cause I Believe In (Event)
**Card Text:** Reveal the top 4 cards of your deck. For each [Heroism] card revealed this way, deal 1 damage to an enemy base. You may discard any of the revealed cards and put the rest back on top of your deck in any order.

**Notes:** Needs implementation: Reveal the top 4 cards of your deck. For each [Heroism] card revealed this way, deal 1 damage to an

### SOR_153 — Saw Gerrera (Unit)
**Card Text:** As an additional cost for each opponent to play an event, they must deal 2 damage to their base.

**Notes:** Needs implementation: As an additional cost for each opponent to play an event, they must deal 2 damage to their base.

### SOR_155 — Aggression (Event)
**Card Text:** Choose two, in any order:

Draw a card.
Defeat up to 2 upgrades.
Ready a unit with 3 or less power.
Deal 4 damage to a unit.

**Notes:** Needs implementation: Choose two, in any order:

Draw a card.
Defeat up to 2 upgrades.
Ready a unit with 3 or less power.
De

### SOR_161 — Ardent Sympathizer (Unit)
**Card Text:** While you have the initiative, this unit gets +2/+0.

**Notes:** Needs implementation: While you have the initiative, this unit gets +2/+0.

### SOR_167 — Force Throw (Event)
**Card Text:** Choose a player. That player discards a card from their hand. Then, if you control a FORCE unit, you may deal damage to a unit equal to the cost of the discarded card.

**Notes:** Needs implementation: Choose a player. That player discards a card from their hand. Then, if you control a FORCE unit, yo

### SOR_174 — Smoke and Cinders (Event)
**Card Text:** Each player discards all but 2 cards (of their choice) from their hand.

**Notes:** Needs implementation: Each player discards all but 2 cards (of their choice) from their hand.

### SOR_175 — Forced Surrender (Event)
**Card Text:** Draw 2 cards. Each opponent whose base you've damaged this phase discards 2 cards from their hand.

**Notes:** Needs implementation: Draw 2 cards. Each opponent whose base you've damaged this phase discards 2 cards from their hand.

### SOR_178 — Cartel Spacer (Unit)
**Card Text:** When Played: If you control another [Cunning] unit, exhaust an enemy unit that costs 4 or less.

**Notes:** Needs implementation: When Played: If you control another [Cunning] unit, exhaust an enemy unit that costs 4 or less.

### SOR_179 — Boba Fett (Unit)
**Card Text:** On Attack: If this unit is attacking an exhausted unit that didn't enter play this round, deal 3 damage to the defender.

**Notes:** Needs implementation: On Attack: If this unit is attacking an exhausted unit that didn't enter play this round, deal 3 dam

### SOR_181 — Jabba the Hutt (Unit)
**Card Text:** Each TRICK event you play costs [1 resource] less. 

When Played: Search the top 8 cards of your deck for a TRICK event, reveal it, and draw it. (Put the other cards on the bottom of your deck in a random order.)

**Notes:** Needs implementation: Each TRICK event you play costs [1 resource] less. 

When Played: Search the top 8 cards of your d

### SOR_186 — No Good to Me Dead (Event)
**Card Text:** Exhaust a unit. That unit can't ready this round (including during the regroup phase).

**Notes:** Needs implementation: Exhaust a unit. That unit can't ready this round (including during the regroup phase).

### SOR_187 — I Had No Choice (Event)
**Card Text:** Choose up to 2 non-leader units. An opponent chooses 1 of those units. Return that unit to its owner's hand and put the other on the bottom of its owner's deck.

**Notes:** Needs implementation: Choose up to 2 non-leader units. An opponent chooses 1 of those units. Return that unit to its owne

### SOR_188 — Chopper (Unit)
**Card Text:** While you control another SPECTRE unit, this unit gains Raid 1.

On Attack: Discard a card from the defending player's deck. If it's an event, exhaust a resource that player controls.

**Notes:** Needs implementation: While you control another SPECTRE unit, this unit gains Raid 1.

On Attack: Discard a card from th

### SOR_190 — Lothal Insurgent (Unit)
**Card Text:** When Played: If you played another card this phase, each opponent draws a card then discards a random card from their hand.

**Notes:** Needs implementation: When Played: If you played another card this phase, each opponent draws a card then discards a rando

### SOR_191 — Vanguard Ace (Unit)
**Card Text:** When Played: For each other card you played this phase, give an Experience token to this unit.

**Notes:** Needs implementation: When Played: For each other card you played this phase, give an Experience token to this unit.

### SOR_192 — Ezra Bridger (Unit)
**Card Text:** When this unit completes an attack: Look at the top card of your deck. You may play it, discard it, or leave it on top of your deck.

**Notes:** Needs implementation: When this unit completes an attack: Look at the top card of your deck. You may play it, discard it,

### SOR_193 — Millennium Falcon (Unit)
**Card Text:** This unit enters play ready.

When you ready cards during the regroup phase: Either pay [1 resource] or return this unit to her owner's hand.

**Notes:** Needs implementation: This unit enters play ready.

When you ready cards during the regroup phase: Either pay [1 resource]

### SOR_199 — Bamboozle (Event)
**Card Text:** You may discard a [Cunning] card from your hand instead of paying this event's cost. 
Exhaust a unit and return each upgrade on it to its owner's hand.

**Notes:** Needs implementation: You may discard a [Cunning] card from your hand instead of paying this event's cost. 
Exhaust a uni

### SOR_200 — Spark of Rebellion (Event)
**Card Text:** Look at an opponent's hand and discard a card from it.

**Notes:** Needs implementation: Look at an opponent's hand and discard a card from it.

### SOR_201 — Bodhi Rook (Unit)
**Card Text:** When Played: Look at an opponent's hand and discard a non-unit card from it.

**Notes:** Needs implementation: When Played: Look at an opponent's hand and discard a non-unit card from it.

### SOR_204 — Greedo (Unit)
**Card Text:** When Defeated: You may discard a card from your deck. If it's not a unit, deal 2 damage to a ground unit.

**Notes:** Needs implementation: When Defeated: You may discard a card from your deck. If it's not a unit, deal 2 damage to a ground 

### SOR_212 — Strafing Gunship (Unit)
**Card Text:** This unit can attack units in the ground arena. While this unit is attacking a ground unit, the defender gets –2/–0.

**Notes:** Needs implementation: This unit can attack units in the ground arena. While this unit is attacking a ground unit, the defe

### SOR_214 — Smuggling Compartment (Upgrade)
**Card Text:** Attach to a VEHICLE unit.

Attached unit gains: 'On Attack: Ready a resource.'

**Notes:** Needs implementation: Attach to a VEHICLE unit.

Attached unit gains: 'On Attack: Ready a resource.'

### SOR_217 — Shoot First (Event)
**Card Text:** Attack with a unit. It gets +1/+0 for this attack and deals its combat damage before the defender. (If the defender is defeated, it deals no combat damage.)

**Notes:** Needs implementation: Attack with a unit. It gets +1/+0 for this attack and deals its combat damage before the defender. (

### SOR_218 — Asteroid Sanctuary (Event)
**Card Text:** Exhaust an enemy unit.

Give a Shield token to a friendly unit that costs 3 or less.

**Notes:** Needs implementation: Exhaust an enemy unit.

Give a Shield token to a friendly unit that costs 3 or less.

### SOR_223 — Don't Get Cocky (Event)
**Card Text:** Choose a unit. One at a time, reveal cards from your deck until you choose to stop or have revealed 7 cards. If the combined cost of the revealed cards is 7 or less, deal that much damage to the chosen unit. Put the revealed cards on the bottom of your deck in a random order.

**Notes:** Needs implementation: Choose a unit. One at a time, reveal cards from your deck until you choose to stop or have revealed 

### SOR_228 — Viper Probe Droid (Unit)
**Card Text:** When Played: Look at an opponent's hand.

**Notes:** Needs implementation: When Played: Look at an opponent's hand.

### SOR_230 — General Veers (Unit)
**Card Text:** Other friendly Imperial units get +1/+1.

**Notes:** Needs implementation: Other friendly Imperial units get +1/+1.

### SOR_231 — TIE Advanced (Unit)
**Card Text:** When Played: Give 2 Experience tokens to another friendly IMPERIAL unit.

**Notes:** Needs implementation: When Played: Give 2 Experience tokens to another friendly IMPERIAL unit.

### SOR_233 — I Am Your Father (Event)
**Card Text:** Deal 7 damage to an enemy unit unless its controller says 'no.' If they do, draw 3 cards.

**Notes:** Needs implementation: Deal 7 damage to an enemy unit unless its controller says 'no.' If they do, draw 3 cards.

### SOR_234 — Maximum Firepower (Event)
**Card Text:** A friendly Imperial unit deals damage equal to its power to a unit.

Then, another friendly Imperial unit deals damage equal to its power to the same unit.

**Notes:** Needs implementation: A friendly Imperial unit deals damage equal to its power to a unit.

Then, another friendly Imperi

### SOR_235 — Galactic Ambition (Event)
**Card Text:** Play a non-[Heroism] unit from your hand for free. Deal damage to your base equal to its cost.

**Notes:** Needs implementation: Play a non-[Heroism] unit from your hand for free. Deal damage to your base equal to its cost.

### SOR_236 — R2-D2 (Unit)
**Card Text:** When Played/On Attack: Look at the top card of your deck. You may put it on the bottom of your deck. (Otherwise, leave it on top of your deck.)

**Notes:** Needs implementation: When Played/On Attack: Look at the top card of your deck. You may put it on the bottom of your deck

### SOR_238 — C-3PO (Unit)
**Card Text:** When Played/On Attack: Choose a number, then look at the top card of your deck. If its cost is the chosen number, you may reveal and draw it. (Otherwise, leave it on top of your deck.)

**Notes:** Needs implementation: When Played/On Attack: Choose a number, then look at the top card of your deck. If its cost is the 

### SOR_242 — General Dodonna (Unit)
**Card Text:** Other friendly Rebel units get +1/+1.

**Notes:** Needs implementation: Other friendly Rebel units get +1/+1.

### SOR_245 — Medal Ceremony (Event)
**Card Text:** Give an Experience token to each of up to 3 REBEL units that attacked this phase.

**Notes:** Needs implementation: Give an Experience token to each of up to 3 REBEL units that attacked this phase.

### SOR_246 — You're My Only Hope (Event)
**Card Text:** Look at the top card of your deck. You may play it. It costs [5 resources] less. If your base has 5 or less remaining HP, you may play it for free instead.

**Notes:** Needs implementation: Look at the top card of your deck. You may play it. It costs [5 resources] less. If your base has 5

---

## Partially Implemented (keyword wired; at least one ability missing)

These cards have some engine coverage but one or more abilities are not yet implemented.

### SOR_035 — Lieutenant Childsen (Unit) [COMPLEX]
**Card Text:** Sentinel (Units in this arena can't attack your non-Sentinel units or your base.)

When Played: Reveal up to 4 [Vigilance] cards from your hand. For each card revealed this way, give an Experience token to this unit.

**Notes:** Sentinel implemented; 'When Played: Reveal up to 4 [Vigilance] cards from hand, give Experience for each revealed' NOT implemented

### SOR_037 — Academy Defense Walker (Unit) [SIMPLE]
**Card Text:** Sentinel (Units in this arena can't attack your non-Sentinel units or your base.)

When Played: Give an Experience token to each friendly damaged unit.

**Notes:** Sentinel implemented; 'When Played: Give an Experience token to each friendly damaged unit' NOT implemented

### SOR_038 — Count Dooku (Unit) [SIMPLE]
**Card Text:** Shielded (When you play this unit, give him a Shield token.)

When Played: You may defeat a unit with 4 or less remaining HP.

**Notes:** Shielded implemented; 'When Played: You may defeat a unit with 4 or less remaining HP' NOT implemented

### SOR_045 — Yoda (Unit) [SIMPLE]
**Card Text:** Restore 2 (When this unit attacks, heal 2 damage from your base.)

When Defeated: Choose any number of players. They each draw a card.

**Notes:** Restore 2 implemented; 'When Defeated: Choose any number of players. They each draw a card' NOT implemented

### SOR_049 — Obi-Wan Kenobi (Unit) [SIMPLE]
**Card Text:** Sentinel (Units in this arena can't attack your non-Sentinel units or your base.)

When Defeated: Give 2 Experience tokens to another friendly unit. If it's a Force unit, draw a card.

**Notes:** Sentinel implemented; 'When Defeated: Give 2 Experience tokens to another friendly unit; if FORCE unit, also deal 2 damage to a unit' NOT implemented

### SOR_050 — The Ghost (Unit) [SIMPLE]
**Card Text:** Shielded (When you play this unit, give a Shield token to it.)

When Played/On Attack: You may give a Shield token to another SPECTRE unit.

**Notes:** Shielded implemented; 'When Played/On Attack: You may give a Shield token to another SPECTRE unit' NOT implemented

### SOR_051 — Luke Skywalker (Unit) [COMPLEX]
**Card Text:** Restore 3

When Played: Give an enemy unit –3/–3 for this phase. If a friendly unit was defeated this phase, give that enemy unit –6/–6 for this phase instead.

**Notes:** Restore 3 implemented; 'When Played: Give an enemy unit -3/-3; if a friendly unit was defeated this phase, give that unit an Experience token' NOT implemented

### SOR_052 — Redemption (Unit) [COMPLEX]
**Card Text:** Sentinel (Units in this arena can't attack your non-Sentinel units or your base.)

When Played: Heal up to 8 total damage from any number of units and/or bases. Deal that much damage to this unit.

**Notes:** Sentinel implemented; 'When Played: Heal up to 8 total damage from any number of units and/or bases' (distributed choice) NOT implemented

### SOR_053 — Luke's Lightsaber (Upgrade) [SIMPLE]
**Card Text:** Attach to a non-Vehicle unit.

When Played: If attached unit is Luke Skywalker, heal all damage from him and give a Shield token to him.

**Notes:** Attach restriction implemented (non-Vehicle); When Played Luke Skywalker heal+shield NOT implemented

### SOR_054 — Jedi Lightsaber (Upgrade) [COMPLEX]
**Card Text:** Attach to a non-VEHICLE unit.

If attached unit is a FORCE unit, it gains: "On Attack: Give the defender –2/–2 for this phase."

**Notes:** Attach restriction implemented (non-Vehicle); conditional FORCE On Attack -2/-2 ability NOT implemented

### SOR_056 — Bendu (Unit) [COMPLEX]
**Card Text:** Sentinel (Units in this arena can't attack your non-Sentinel units or your base.)

On Attack: The next non-[Heroism], non-[Villainy] card you play this phase costs [2 resources] less.

**Notes:** Sentinel implemented; 'On Attack: Next non-[Heroism] non-[Villainy] card you play this phase costs 0' NOT implemented

### SOR_067 — Wampa (Unit) [COMPLEX]
**Card Text:** Grit (This unit gets +1/+0 for each damage on it.)

On Attack: If you control a leader unit, you may draw a card.

**Notes:** Grit implemented; On Attack 'if you control a leader, deal 4 damage to non-leader unit' NOT implemented

### SOR_068 — Lom Pyke (Unit) [SIMPLE]
**Card Text:** Shielded (When you play this unit, give a Shield token to it.)
When Played: If you control another [Vigilance] unit, heal 4 damage from your base.

**Notes:** Shielded implemented; 'When Played: If you control another [Vigilance] unit, heal 4 damage from your base' NOT implemented

### SOR_071 — Electrostaff (Upgrade) [COMPLEX]
**Card Text:** Attach to a non-VEHICLE unit. 

While attached unit is defending, the attacker gets –1/–0.

**Notes:** Attach restriction implemented (non-Vehicle); 'While defending, attacker gets -1/-0' NOT implemented

### SOR_085 — Death Star Stormtrooper (Unit) [COMPLEX]
**Card Text:** Shielded (When you play this unit, give a Shield token to it.)

When this unit deals combat damage to a non-leader unit while attacking: Defeat that unit.

**Notes:** Shielded implemented; 'When this unit deals combat damage to a non-leader unit while attacking: Defeat the defender' NOT implemented

### SOR_086 — Gladiator Star Destroyer (Unit) [COMPLEX]
**Card Text:** When Played: Give a unit Sentinel for this phase. (Units in this arena can't attack your non-Sentinel units or your base.)

**Notes:** Gives itself Sentinel in sentinel.ts; 'When Played: Give a unit Sentinel for this phase' (targeting another unit) NOT fully implemented

### SOR_090 — Devastator (Unit) [SIMPLE]
**Card Text:** Sentinel

Overwhelm

When Played: You may deal damage to a unit equal to the number of resources you control.

**Notes:** Sentinel + Overwhelm implemented; 'When Played: You may deal damage to a unit equal to the number of resources you control' NOT implemented

### SOR_099 — Home One (Unit) [SIMPLE]
**Card Text:** Sentinel (Units in this arena can't attack your non-Sentinel units or your base.)

When Played: You may return a friendly non-leader ground unit to its owner's hand. If you do, draw a card.

**Notes:** Sentinel implemented; 'When Played: You may return a friendly non-leader ground unit to its owner's hand' NOT implemented

### SOR_100 — Wedge Antilles (Unit) [COMPLEX]
**Card Text:** Each friendly VEHICLE unit gets +1/+1 and gains Ambush. (After you play that unit, it may ready and attack an enemy unit.)

**Notes:** Ambush-granting for VEHICLE units implemented; '+1/+1 for all friendly VEHICLE units' stat buff NOT implemented

### SOR_101 — Restored ARC-170 (Unit) [SIMPLE]
**Card Text:** Ambush (After you play this unit, it may ready and attack an enemy unit.)

When Played: Return a unit that costs 2 or less from your discard pile to your hand.

**Notes:** Ambush implemented; 'When Played: Return a unit that costs 2 or less from your discard pile to your hand' NOT implemented

### SOR_102 — Redemption (Unit) [COMPLEX]
**Card Text:** Restore 2

Each other friendly unit gains Restore 1.

When Played: Play a [Heroism] unit from your discard pile. It costs [3 resources] less.

**Notes:** Restore 2 implemented; 'Each other friendly unit gains Restore 1' and 'When Played: Play a [Heroism] unit from your discard pile' NOT implemented

### SOR_116 — General Grievous (Unit) [SIMPLE]
**Card Text:** Overwhelm (When attacking an enemy unit, deal excess damage to the opponent's base.)

On Attack: If you control a leader unit, give a friendly unit +2/+2 for this phase.

**Notes:** Overwhelm implemented; 'On Attack: If you control a leader unit, give a friendly unit +2/+2 for this phase' NOT implemented

### SOR_133 — Inferno Four (Unit) [COMPLEX]
**Card Text:** Saboteur (When this unit attacks, ignore Sentinel and defeat the defender's Shields.)

When this unit deals combat damage to an opponent's base: You may deal 3 damage to a ground unit that opponent controls.

**Notes:** Saboteur implemented; 'When this unit deals combat damage to an opponent's base: You may deal 3 damage to a unit' NOT implemented

### SOR_136 — Vader's Lightsaber (Upgrade) [SIMPLE]
**Card Text:** Attach to a non-Vehicle unit.

When Played: If attached unit is Darth Vader, you may deal 4 damage to a ground unit.

**Notes:** Attach restriction implemented (non-Vehicle); When Played Darth Vader deal 4 damage NOT implemented

### SOR_137 — Fallen Lightsaber (Upgrade) [COMPLEX]
**Card Text:** Attach to a non-Vehicle unit. 

If attached unit is a Force unit, it gains: 'On Attack: Deal 1 damage to each ground unit the defending player controls.'

**Notes:** Attach restriction implemented (non-Vehicle); conditional FORCE On Attack deal 1 damage ability NOT implemented

### SOR_140 — SpecForce Soldier (Unit) [SIMPLE]
**Card Text:** When Played: A unit loses Sentinel for this phase.

**Notes:** Marked as not-having-sentinel in sentinel.ts; 'When Played: A unit loses Sentinel for this phase' NOT implemented

### SOR_143 — Sabine Wren (Unit) [COMPLEX]
**Card Text:** Saboteur (When this unit attacks, ignore Sentinel and defeat the defender's Shields.)

When you play another [Aggression] card: You may deal 1 damage to a base.

**Notes:** Saboteur implemented; 'When you play another [Aggression] card: You may deal 1 damage to a base' NOT implemented

### SOR_144 — Saw's Renegades (Unit) [COMPLEX]
**Card Text:** Raid 1 (This unit gets +1/+0 while attacking.)

Each other friendly [Heroism] unit gains Raid 1.

**Notes:** Raid 1 implemented; 'Each other friendly [Heroism] unit gains Raid 1' (dynamic keyword grant) NOT implemented

### SOR_148 — Chewbacca (Unit) [SIMPLE]
**Card Text:** Grit (This unit gets +1/+0 for each damage on it.)  

When Played: If a base has 15 or more damage on it, ready this unit.

**Notes:** Grit implemented; 'When Played: If a base has 15 or more damage on it, ready this unit' NOT implemented

### SOR_149 — Darth Maul (Unit) [COMPLEX]
**Card Text:** Ambush

When this unit attacks and defeats a unit: Ready him.

**Notes:** Ambush implemented; 'When this unit attacks and defeats a unit: Ready him' NOT implemented

### SOR_158 — Cassian Andor (Unit) [SIMPLE]
**Card Text:** Saboteur (When this unit attacks, ignore Sentinel and defeat the defender's Shields.)

On Attack: If you control a leader unit, deal 2 damage to a ground unit or a base.

**Notes:** Saboteur implemented; 'On Attack: If you control a leader unit, deal 2 damage to a ground unit or base' NOT implemented

### SOR_160 — Concord Dawn Interceptors (Unit) [COMPLEX]
**Card Text:** Saboteur (When this unit attacks, ignore Sentinel and defeat the defender's Shields.)

When Played/On Attack: Bases can't be healed for this phase.

**Notes:** Saboteur implemented; 'When Played/On Attack: Bases can't be healed for this phase' NOT implemented

### SOR_177 — Director Krennic (Unit) [COMPLEX]
**Card Text:** Shielded (When you play this unit, give him a Shield token.)

Action [Exhaust]: Play an event from your hand. It costs [1 resource] less.

**Notes:** Shielded implemented; 'Action [Exhaust]: Play an event from your hand. It costs 1 resource less' NOT implemented

### SOR_182 — Seventh Sister (Unit) [COMPLEX]
**Card Text:** Ambush (After you play this unit, he may ready and attack an enemy unit.)

When you play an event: You may deal 2 damage to a unit.

**Notes:** Ambush implemented; 'When you play an event: You may deal 2 damage to a unit' NOT implemented

### SOR_183 — Han Solo (Unit) [SIMPLE]
**Card Text:** Ambush (After you play this unit, it may ready and attack an enemy unit.)

When Played: You may return an event from a discard pile to its owner's hand.

**Notes:** Ambush implemented; 'When Played: You may return an event from a discard pile to its owner's hand' NOT implemented

### SOR_185 — Maz Kanata (Unit) [COMPLEX]
**Card Text:** Shielded (When you play this unit, give a Shield token to it.)

On Attack: Name a card. An opponent reveals their hand and discards a card with that name from it.

**Notes:** Shielded implemented; 'On Attack: Name a card. Opponent reveals their hand and discards a card with that name if able' NOT implemented

### SOR_197 — Lando Calrissian (Unit) [SIMPLE]
**Card Text:** Saboteur (When this unit attacks, ignore Sentinel and defeat the defender's Shields.)

When Played: Return up to 2 friendly resources to their owners' hands.

**Notes:** Saboteur implemented; 'When Played: Return up to 2 friendly resources to their owners' hands' NOT implemented

### SOR_208 — Swoop Racer (Unit) [SIMPLE]
**Card Text:** Raid 1 (This unit gets +1/+0 while attacking.)

On Attack: If you control a leader unit, you may exhaust a non-leader unit.

**Notes:** Raid 1 implemented; 'On Attack: If you control a leader unit, you may exhaust a non-leader unit' NOT implemented

### SOR_209 — Kylo Ren (Unit) [SIMPLE]
**Card Text:** Raid 1 (This unit gets +1/+0 while attacking.)

When Played: Return a friendly non-leader unit to its owner's hand.

**Notes:** Raid 1 implemented; 'When Played: Return a friendly non-leader unit to its owner's hand' NOT implemented

### SOR_244 — Concord Dawn Interceptors (Unit) [SIMPLE]
**Card Text:** Ambush (After you play this unit, it may ready and attack an enemy unit.)

On Attack: Exhaust an enemy Vehicle ground unit.

**Notes:** Ambush implemented; 'On Attack: Exhaust an enemy Vehicle ground unit' NOT implemented

### SOR_248 — Rogue Squadron X-Wing (Unit) [COMPLEX]
**Card Text:** Raid 1 (This unit gets +1/+0 while attacking.)

If you control a TROOPER unit, this unit costs [1 resource] less to play.

**Notes:** Raid 1 implemented; 'If you control a TROOPER unit, this unit costs 1 resource less to play' (conditional cost reduction) NOT implemented

---

## Keywords Only (effectively implemented)

These cards rely solely on auto-handled keywords. No custom logic needed.

| ID | Name | Type | Keywords |
|----|------|------|----------|
| SOR_032 | Scout Bike Pursuer | Unit | Grit |
| SOR_044 | Restored ARC-170 | Unit | Restore |
| SOR_046 | Consular Security Force | Unit |  |
| SOR_063 | Consular Security Force | Unit | Sentinel |
| SOR_064 | Cartel Turncoat | Unit | Shielded |
| SOR_066 | Outer Rim Headhunter | Unit | Sentinel |
| SOR_098 | Rebel Pathfinder | Unit | Sentinel |
| SOR_117 | Devastator | Unit | Ambush, Overwhelm |
| SOR_141 | Gladiator Star Destroyer | Unit | Raid |
| SOR_157 | Partisan Insurgent | Unit | Raid |
| SOR_164 | Clan Wren Rescuer | Unit | Overwhelm |
| SOR_165 | Pyke Soldier | Unit | Grit |
| SOR_180 | Freelance Muscle | Unit | Shielded |
| SOR_194 | Wookiee Warrior | Unit | Saboteur, Raid |
| SOR_195 | Cartel Turncoat | Unit | Ambush |
| SOR_205 | Black Sun Headhunter | Unit | Saboteur |
| SOR_207 | Outer Rim Headhunter | Unit | Shielded |
| SOR_213 | Outer Rim Smuggler | Unit | Ambush |
| SOR_229 | ISB Agent | Unit | Sentinel |
| SOR_232 | Arquitens-class Command Cruiser | Unit | Overwhelm |
| SOR_239 | Black Sun Starfighter | Unit | Saboteur |
| SOR_243 | Alliance X-Wing | Unit | Restore |
| SOR_250 | Distant Patroller | Unit | Sentinel |

---

## Already Implemented

These cards have custom logic in the engine (overrides, keyword dictionaries, or dispatch-listener).

| ID | Name | Type | Notes |
|----|------|------|-------|
| SOR_033 | Death Trooper | Unit | Has custom logic in engine action files |
| SOR_034 | Del Meeko | Unit | Has custom logic in engine (card-playability.ts + dispatch-listener.ts) |
| SOR_048 | Vigilant Honor Guards | Unit | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_057 | Protector | Upgrade | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_065 | Pyke Sentinel | Unit | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_070 | Devotion | Upgrade | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_072 | Entrenched | Upgrade | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_073 | Moment of Peace | Event | Has custom logic in engine action files |
| SOR_077 | Takedown | Event | Has custom logic in engine action files |
| SOR_078 | Vanquish | Event | Has custom logic in engine action files |
| SOR_079 | Admiral Piett | Unit | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_080 | General Tagge | Unit | Has custom logic in engine action files |
| SOR_082 | Emperor's Royal Guard | Unit | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_083 | Superlaser Technician | Unit | Has custom logic in engine action files |
| SOR_087 | Darth Vader | Unit | Has custom logic in engine action files |
| SOR_092 | Overwhelming Barrage | Event | Has custom logic in engine action files |
| SOR_097 | Leia Organa | Unit | Has custom logic in engine action files |
| SOR_103 | Rebel Assault | Event | Has custom logic in engine action files |
| SOR_104 | U-Wing Reinforcement | Event | Has custom logic in engine action files |
| SOR_106 | Attack Pattern Delta | Event | Has custom logic in engine action files |
| SOR_107 | Command | Event | Has custom logic in engine action files |
| SOR_108 | Vanguard Infantry | Unit | Has custom logic in engine action files |
| SOR_112 | Consortium StarViper | Unit | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_114 | Escort Skiff | Unit | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_115 | Han Solo | Unit | Has custom logic in engine action files |
| SOR_121 | Hardpoint Heavy Blaster | Upgrade | Has custom logic in engine action files |
| SOR_122 | Traitorous | Upgrade | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_123 | Recruit | Event | Has custom logic in engine action files |
| SOR_127 | Strike True | Event | Has custom logic in engine action files |
| SOR_130 | First Legion Snowtrooper | Unit | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_131 | Fifth Brother | Unit | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_135 | Emperor Palpatine | Unit | Has custom logic in engine action files |
| SOR_138 | Force Lightning | Event | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_145 | K-2SO | Unit | Has custom logic in engine action files |
| SOR_150 | Heroic Sacrifice | Event | Has custom logic in engine action files |
| SOR_154 | Rallying Cry | Event | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_156 | Benthic 'Two Tubes' | Unit | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_159 | Partisan Insurgent | Unit | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_162 | Disabling Fang Fighter | Unit | Has custom logic in engine action files |
| SOR_166 | Infiltrator's Skill | Upgrade | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_168 | Precision Fire | Event | Has custom logic in engine action files |
| SOR_176 | ISB Agent | Unit | Has custom logic in engine action files |
| SOR_184 | Fett's Firespray | Unit | Has custom logic in engine action files |
| SOR_196 | General Dodonna | Unit | Has custom logic in engine action files |
| SOR_198 | Boba Fett | Unit | Has custom logic in engine action files |
| SOR_203 | Cunning | Event | Has custom logic in engine action files |
| SOR_211 | Gamorrean Guards | Unit | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_215 | Snapshot Reflexes | Upgrade | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_219 | Sneak Attack | Event | Has custom logic in engine action files |
| SOR_222 | Waylay | Event | Has custom logic in engine action files |
| SOR_224 | Change of Heart | Event | Has custom logic in engine action files |
| SOR_226 | Admiral Motti | Unit | Has custom logic in engine action files |
| SOR_227 | Snowtrooper Lieutenant | Unit | Has custom logic in engine action files |
| SOR_241 | Wing Leader | Unit | Has custom logic in engine action files |
| SOR_249 | Frontier AT-RT | Unit | Has custom logic in engine keyword dictionaries or dispatch-listener |
| SOR_251 | Confiscate | Event | Has custom logic in engine action files |
| SOR_252 | Restock | Event | Has custom logic in engine action files |
| SOR_039 | AT-AT Suppressor | Unit | Has custom logic in engine action files; test coverage added |
| SOR_059 | 2-1B Surgical Droid | Unit | Has custom logic in engine action files; test coverage added |
| SOR_060 | Distant Patroller | Unit | Has custom logic in engine action files; test coverage added |
| SOR_076 | Make an Opening | Event | Has custom logic in engine action files; test coverage added |
| SOR_111 | Patrolling V-Wing | Unit | Has custom logic in engine action files; test coverage added |
| SOR_124 | Tactical Advantage | Event | Has custom logic in engine action files; test coverage added |
| SOR_132 | Imperial Interceptor | Unit | Has custom logic in engine action files; test coverage added |
| SOR_134 | Ruthless Raider | Unit | Has custom logic in engine action files; test coverage added |
| SOR_151 | Karabast | Event | Has custom logic in engine action files; test coverage added |
| SOR_163 | Star Wing Scout | Unit | Has custom logic in engine action files; test coverage added |
| SOR_169 | Keep Fighting | Event | Has custom logic in engine action files; test coverage added |
| SOR_170 | Power Failure | Event | Has custom logic in engine action files; test coverage added |
| SOR_171 | Mission Briefing | Event | Has custom logic in engine action files; test coverage added |
| SOR_173 | Bombing Run | Event | Has custom logic in engine action files; test coverage added |
| SOR_189 | Leia Organa | Unit | Has custom logic in engine action files; test coverage added |
| SOR_202 | Cantina Bouncer | Unit | Has custom logic in engine action files; test coverage added |
| SOR_206 | Mining Guild TIE Fighter | Unit | Has custom logic in engine action files; test coverage added |
| SOR_216 | Disarm | Event | Has custom logic in engine action files; test coverage added |
| SOR_220 | Surprise Strike | Event | Has custom logic in engine action files; test coverage added |
| SOR_221 | Outmaneuver | Event | Has custom logic in engine action files; test coverage added |
| SOR_240 | Fleet Lieutenant | Unit | Has custom logic in engine action files; test coverage added |
