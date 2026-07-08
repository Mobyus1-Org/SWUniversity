# SOR Implementation Status (SOR_031 – SOR_252)

> Analysis covers 214 cards (SOR_031–SOR_252). Some IDs may be absent if they do not exist in the set.

## Summary

| Status | Count |
|--------|-------|
| Implemented | 209 |
| Partially Implemented | 6 |
| Keywords Only (auto-handled) | 23 |
| Unimplemented – Simple | 0 |
| Unimplemented – Complex | 0 |

---

---

## Unimplemented – COMPLEX (requires senior dev consultation)

These cards need new engine features or unusual interactions.






### SOR_238 — C-3PO (Unit)
**Card Text:** When Played/On Attack: Choose a number, then look at the top card of your deck. If its cost is the chosen number, you may reveal and draw it. (Otherwise, leave it on top of your deck.)

**Notes:** Needs implementation: When Played/On Attack: Choose a number, then look at the top card of your deck. If its cost is the

### SOR_246 — You're My Only Hope (Event)
**Card Text:** Look at the top card of your deck. You may play it. It costs [5 resources] less. If your base has 5 or less remaining HP, you may play it for free instead.

**Notes:** Same peek pattern as SOR_119 Reinforcement Walker. Yes path: play-from-hand for the top card with costModifier: -5 (or 'free' if base HP ≤ 5). No path: leave card on top (no-op).

---

## Unimplemented – Simple (implementable with existing engine patterns)

All simple cards have been implemented.

---

## Partially Implemented (keyword wired; at least one ability missing)

These cards have some engine coverage but one or more abilities are not yet implemented.


### SOR_144 — Saw's Renegades (Unit) [COMPLEX]
**Card Text:** Raid 1 (This unit gets +1/+0 while attacking.)

Each other friendly [Heroism] unit gains Raid 1.

**Notes:** Raid 1 implemented; 'Each other friendly [Heroism] unit gains Raid 1' (dynamic keyword grant) NOT implemented

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

### SOR_185 — Maz Kanata (Unit) [COMPLEX]
**Card Text:** Shielded (When you play this unit, give a Shield token to it.)

On Attack: Name a card. An opponent reveals their hand and discards a card with that name from it.

**Notes:** Shielded implemented; 'On Attack: Name a card. Opponent reveals their hand and discards a card with that name if able' NOT implemented

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
| SOR_083 | Superlaser Technician | Unit | When Defeated: may put into resources ready; reworked to ability-option pattern + discard cleanup; test coverage added |
| SOR_087 | Darth Vader | Unit | Has custom logic in engine action files |
| SOR_092 | Overwhelming Barrage | Event | Has custom logic in engine action files |
| SOR_097 | Leia Organa | Unit | Has custom logic in engine action files |
| SOR_103 | Rebel Assault | Event | Has custom logic in engine action files |
| SOR_104 | U-Wing Reinforcement | Event | Has custom logic in engine action files |
| SOR_106 | Attack Pattern Delta | Event | Has custom logic in engine action files |
| SOR_058 | Vigilance | Event | Choose-two aspect event; choose-aspect-effect pending; mill/heal/defeat/shield effects |
| SOR_107 | Command | Event | Choose-two aspect event; choose-aspect-effect pending; XP/power-damage/resource/return effects |
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
| SOR_155 | Aggression | Event | Choose-two aspect event; choose-aspect-effect pending; draw/upgrades/ready/damage effects |
| SOR_203 | Cunning | Event | Choose-two aspect event; choose-aspect-effect pending; bounce/buff/exhaust/discard effects |
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
| SOR_126 | Resupply | Event | When Played: put event into resources (exhausted); via when-played-trigger; test coverage added |
| SOR_125 | Prepare for Takeoff | Event | Search top 8 for up to 2 Vehicle units, draw; test coverage added |
| SOR_146 | Zeb Orrelios | Unit | When attack ends + defender defeated: may deal 4 to a ground unit; test coverage added |
| SOR_147 | Black One | Unit | When Played/When Defeated: may discard hand, draw 3; test coverage added |
| SOR_161 | Ardent Sympathizer | Unit | While controller has initiative: +2/+0; inline in unit.ts CurrentPower(); test coverage added |
| SOR_178 | Cartel Spacer | Unit | When Played: if another Cunning unit, exhaust enemy unit cost ≤ 4; test coverage added |
| SOR_179 | Boba Fett | Unit | On Attack: if defender exhausted and didn't enter this round, deal 3; test coverage added |
| SOR_191 | Vanguard Ace | Unit | When Played: XP per other card played this phase; via when-played-trigger; test coverage added |
| SOR_218 | Asteroid Sanctuary | Event | Exhaust enemy unit; give Shield to friendly unit cost ≤ 3; two-step ability-target; test coverage added |
| SOR_230 | General Veers | Unit | Other friendly Imperial units +1/+1; loops in CurrentPower()/TotalHP(); test coverage added |
| SOR_231 | TIE Advanced | Unit | When Played: give 2 XP to another friendly Imperial unit; test coverage added |
| SOR_242 | General Dodonna | Unit | Other friendly Rebel units +1/+1; loops in CurrentPower()/TotalHP(); test coverage added |
| SOR_245 | Medal Ceremony | Event | Give XP to up to 3 Rebel units that attacked this phase; GiveXpMultiplePending; test coverage added |
| SOR_031 | Inferno Four | Unit | When Played/When Defeated: Scry 2; test coverage added |
| SOR_035 | Lieutenant Childsen | Unit | Sentinel; When Played: reveal up to 4 Vigilance hand cards, gain 1 XP per card (capped at 4); auto-resolved in resolveWhenPlayedTrigger; test coverage added |
| SOR_043 | Superlaser Blast | Event | Defeat all units (board wipe); test coverage added |
| SOR_036 | Gideon Hask | Unit | When an enemy unit is defeated: Experience token; test coverage added |
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
| SOR_172 | Open Fire | Event | Has custom logic in engine action files; test coverage added |
| SOR_173 | Bombing Run | Event | Has custom logic in engine action files; test coverage added |
| SOR_189 | Leia Organa | Unit | Has custom logic in engine action files; test coverage added |
| SOR_200 | Spark of Rebellion | Event | When Played: look at opponent's hand and discard a card; test coverage added |
| SOR_201 | Bodhi Rook | Unit | When Played: look at opponent's hand and discard a non-unit card; test coverage added |
| SOR_202 | Cantina Bouncer | Unit | Has custom logic in engine action files; test coverage added |
| SOR_206 | Mining Guild TIE Fighter | Unit | Has custom logic in engine action files; test coverage added |
| SOR_216 | Disarm | Event | Has custom logic in engine action files; test coverage added |
| SOR_220 | Surprise Strike | Event | Has custom logic in engine action files; test coverage added |
| SOR_221 | Outmaneuver | Event | Has custom logic in engine action files; test coverage added |
| SOR_228 | Viper Probe Droid | Unit | When Played: look at opponent's hand; test coverage added |
| SOR_236 | R2-D2 | Unit | When Played/On Attack: Scry 1; test coverage added |
| SOR_240 | Fleet Lieutenant | Unit | Has custom logic in engine action files; test coverage added |
| SOR_074 | Repair | Event | Heal 3 damage from a unit or base; uses healTarget + allUnitsAndBasesPlayIds helpers; test coverage added |
| SOR_040 | Avenger | Unit | When Played/On Attack: opponent chooses non-leader unit to defeat; uses chooseAndDefeatUnit helper; test coverage added |
| SOR_041 | Power of the Dark Side | Event | Opponent chooses any unit (incl. leader) to defeat; uses chooseAndDefeatUnit helper; test coverage added |
| SOR_052 | Redemption | Unit | Sentinel + When Played: spread heal up to 8 across units/bases, deal total to self; uses SpreadHealPending; test coverage added |
| SOR_042 | Search Your Feelings | Event | When Played: search entire deck for any card and draw it (dontReveal); test coverage added |
| SOR_047 | Kanan Jarrus | Unit | On Attack: mill N cards from defending player's deck (N = friendly Spectre count); heal base by distinct aspects among milled cards; uses MillPending + MillResultPending; test coverage added |
| SOR_055 | The Force Is With Me | Event | Choose friendly unit: give 2 XP; if Force unit in play give Shield; may attack with it; test coverage added |
| SOR_119 | Reinforcement Walker | Unit | When Played/On Attack: peek top card, Yes=draw it / No=discard+heal 3; uses ability-option Yes/No pattern; test coverage added |
| SOR_075 | It Binds All Things | Event | Heal up to 3 from a unit; if you control a Force unit, may deal that much to another unit; uses SpreadHealPending with afterHeal; test coverage added |
| SOR_204 | Greedo | Unit | When Defeated: may discard top card of own deck; if non-unit, deal 2 damage to a ground unit; uses MillPending + MillResultPending; test coverage added |
| SOR_081 | Seasoned Shoretrooper | Unit | While 6+ resources: +2/+0 — conditional power in unit.ts CurrentPower() |
| SOR_084 | Grand Moff Tarkin | Unit | When Played: search top 5 for up to 2 Imperial cards; uses searchDeck with trait filter |
| SOR_088 | Blizzard Assault AT-AT | Unit | When attacks and defeats: may deal excess damage to an enemy ground unit; excess stored via CurrentEffect.value |
| SOR_091 | The Emperor's Legion | Event | Return each unit defeated this phase from discard to hand; inline in when-played using cardsLeftPlayThisPhase |
| SOR_093 | Alliance Dispatcher | Unit | Action [Exhaust]: play a unit from hand at -1 cost; action-ability + play-from-hand handler |
| SOR_094 | Bail Organa | Unit | Action [Exhaust]: give an Experience token to another friendly unit; action-ability + applyAbilityEffect |
| SOR_096 | Mon Mothma | Unit | When Played: search top 5 for a Rebel card; uses searchDeck with trait filter |
| SOR_113 | Homestead Militia | Unit | While 6+ resources: gains Sentinel — conditional in sentinel.ts alongside JTL_113 |
| SOR_118 | 97th Legion | Unit | +1/+1 for each resource you control — dynamic in unit.ts CurrentPower() and TotalHP() |
| SOR_037 | Academy Defense Walker | Unit | When Played: give XP to each friendly damaged unit; via when-played-trigger; test coverage added |
| SOR_038 | Count Dooku | Unit | Shielded; When Played: defeat unit with ≤4 HP (Option prompt); test coverage added |
| SOR_045 | Yoda | Unit | Restore 2; When Defeated: choose any players to each draw a card; test coverage added |
| SOR_049 | Obi-Wan Kenobi | Unit | Sentinel; When Defeated: give 2 XP to friendly unit; if Force unit also draw a card; test coverage added |
| SOR_050 | The Ghost | Unit | Shielded; When Played/On Attack: give Shield to another SPECTRE unit; test coverage added |
| SOR_053 | Luke's Lightsaber | Upgrade | Attach non-Vehicle; When Played: if on Luke Skywalker, heal all damage and give Shield; test coverage added |
| SOR_068 | Cargo Juggernaut (Lom Pyke) | Unit | Shielded; When Played: if another Vigilance unit, heal 4 from base; via when-played-trigger; test coverage added |
| SOR_090 | Devastator | Unit | Sentinel+Overwhelm; When Played: deal damage to unit equal to resource count; test coverage added |
| SOR_099 | Bright Hope | Unit | Sentinel; When Played: return friendly non-leader ground unit to hand; if so, draw a card; test coverage added |
| SOR_101 | Rogue Squadron Skirmisher | Unit | Ambush; When Played: return unit cost ≤2 from discard to hand; test coverage added |
| SOR_116 | Steadfast Battalion (General Grievous) | Unit | Overwhelm; On Attack: if leader in play, give friendly unit +2/+2 for phase; test coverage added |
| SOR_136 | Vader's Lightsaber | Upgrade | Attach non-Vehicle; When Played: if on Darth Vader, deal 4 to a ground unit; test coverage added |
| SOR_140 | SpecForce Soldier | Unit | When Played: chosen unit loses Sentinel for this phase; test coverage added |
| SOR_148 | Guerilla Attack Pod (Chewbacca) | Unit | Grit; When Played: if any base has 15+ damage, ready this unit; via when-played-trigger; test coverage added |
| SOR_158 | Jedha Agitator (Cassian Andor) | Unit | Saboteur; On Attack: if leader in play, deal 2 damage to ground unit or base; test coverage added |
| SOR_183 | Bounty Hunter Crew (Han Solo) | Unit | Ambush; When Played: return an event from either discard pile to owner's hand; test coverage added |
| SOR_197 | Lando Calrissian | Unit | Saboteur; When Played: return up to 2 friendly resources to hand; test coverage added |
| SOR_208 | Outer Rim Headhunter (Swoop Racer) | Unit | Raid 1; On Attack: if leader in play, exhaust a non-leader unit; test coverage added |
| SOR_209 | Pirated Starfighter (Kylo Ren) | Unit | Raid 1; When Played: return friendly non-leader unit to hand; test coverage added |
| SOR_244 | Snowspeeder (Concord Dawn Interceptors) | Unit | Ambush; On Attack: exhaust enemy Vehicle ground unit; test coverage added |
| SOR_102 | Home One | Unit | Restore 2; passive Restore 1 to all other friendly units; When Played: play Heroism unit from discard at -3 cost (pre-filtered by affordability incl. aspect penalty); AspectPenalty exported to core-functions; test coverage added |
| SOR_061 | Guardian of the Whills | Unit | First upgrade played on this unit each round costs 1 less; discount tracked via `SOR_061_firstUpgradeUsed` CurrentEffect (Round duration) in card-playability.ts + dispatch-listener.ts; test coverage added |
| SOR_062 | Regional Governor | Unit | When Played: name a card; opponents can't play that named card while this unit is in play; when-played.ts prompts for name; card-playability.ts blocks it; namedCardTitle stored on unit; test coverage added |
| SOR_105 | General Krell | Unit | Each other friendly unit gains "When Defeated: may draw a card"; resolveOwnWhenDefeated refactor in when-defeated.ts + applyAbilityOptionEffect case in dispatch-listener.ts; test coverage added |
| SOR_109 | Colonel Yularen | Unit | When a Command unit is played (including this one): heal 1 from your base; inline check in completePlayCard (dispatch-listener.ts); test coverage added |
| SOR_110 | Frontline Shuttle | Unit | Action [defeat this unit]: attack with any friendly unit even if exhausted; that attack can't target bases; special-cased in action-ability.ts + dispatch-listener.ts with source: "SOR_110" base-attack block; test coverage added |
| SOR_129 | Admiral Ozzel | Unit | Action [exhaust]: play Imperial unit from hand at cost, enters ready; each opponent may ready one of their units; play-from-hand handler in dispatch-listener.ts; test coverage added |
| SOR_139 | Force Choke | Event | Costs 1 less if you control a Force unit (forceChokeDiscount in card-playability.ts + playCost); deal 5 to non-Vehicle unit; that unit's controller draws; test coverage added |
| SOR_142 | Explosives Artist (Sabine Wren) | Unit | While 3+ distinct aspects among other friendlies: can't be attacked (unless Sentinel); On Attack: deal 1 to defender or base; computeAttackTargets filter + on-attack.ts + applyAbilityEffect; test coverage added |
