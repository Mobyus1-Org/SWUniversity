# Star Wars Unlimited — Engine Mechanics Gap Analysis

> Rules reference: Comprehensive Rules v6.0 (10/31/25)
> Engine reference: `src/server/engine/` — dispatch-listener, unit, core-functions, pending-resolution, keyword-dictionaries, upgrade-attach-restrictions, and action files.
> Status key: ✅ Implemented · ⚠️ Partial · ❌ Not Implemented

---

## 1. Turn Structure & Game Flow

| Mechanic | Status | Notes |
|---|---|---|
| Action Phase — player alternation | ✅ | `processDispatch` routes `play-card`, `initiate-attack`, `use-ability`, `pass-action`, `claim-initiative` correctly. |
| Pass action | ✅ | `handlePassAction` logs and returns updated state. |
| Claim Initiative / Take the Initiative | ⚠️ | `handleClaimInitiative` sets `initiativeClaimed` and `initiativePlayer` but does **not** enforce the rule that once claimed the player auto-passes for the rest of the phase, nor does it prevent a second claim. |
| Regroup Phase — draw 2 | ❌ | No regroup phase dispatch handler exists. Drawing cards must be handled outside the engine. |
| Regroup Phase — resource a card | ❌ | No handler; clients manage this externally. |
| Regroup Phase — ready all exhausted cards | ❌ | No handler. |
| Start-of-phase / End-of-phase lasting-effect expiry | ⚠️ | `ForAttack` effects are cleared after an attack resolves. Phase-scoped (`ForThisPhase`) effects are stored in `currentEffects` but **no regroup/phase-boundary step clears them automatically**. |
| Round counter (`currentRound`) | ⚠️ | Field exists on `GameState` and is used for `turnDiscarded`, but is never incremented by the engine. |
| Epic Action counter — once-per-game enforcement | ⚠️ | `leader.epicActionUsed` prevents a second deploy but the flag is never reset on re-entry to play per rules (it should persist). Also, non-deploy Epic Action abilities have no general once-per-game guard. |
| Consecutive-pass end-of-phase detection | ❌ | Engine does not detect when both players have passed consecutively and does not trigger phase end. |
| Game-over when base reaches 0 HP | ✅ | `updateDefeatedPlayers` runs after every state change. |
| Draw when deck is empty (3 damage per card) | ❌ | Not implemented. |
| Mulligan / opening hand setup | ❌ | Setup is handled outside the engine. |

---

## 2. Resources & Cost

| Mechanic | Status | Notes |
|---|---|---|
| Pay cost by exhausting resources | ✅ | `exhaustResources` correctly exhausts ready resources up to cost. |
| Aspect penalty (+2 per missing icon) | ✅ | `aspectPenalty` counts icons from leader + base and charges correctly. |
| Cost cannot go below 0 | ✅ | Enforced by the fact that `playCost` returns a non-negative integer (base cost + penalty ≥ 0). |
| "Play for free" — bypasses aspect penalty | ❌ | No free-play path exists in the engine; cards always go through `playCost`. |
| Cost modifiers (increase before decrease) | ⚠️ | `Exploit` decreases cost; no increase modifiers are tracked beyond the aspect penalty. Order is not explicitly enforced. |
| Additional costs (non-resource) | ❌ | No mechanism for abilities like "also defeat a friendly unit to pay." |
| Resourcing a card (facedown, exhausted) | ❌ | State model has a `resources` array but no engine dispatch for adding/removing. |
| Resource rearrangement rules | ❌ | Not enforced. |

---

## 3. Playing Cards

| Mechanic | Status | Notes |
|---|---|---|
| Play Unit — pay cost, place exhausted in arena | ✅ | `handlePlayCard` → `addToArena` (enters exhausted). |
| Play Event — pay cost, discard, resolve ability | ✅ | Event placed in discard, `resolveWhenPlayed` called. |
| Play Upgrade — pay cost, attach to eligible unit | ✅ | `UpgradeEligibleTargets` filters targets; `handleChooseTarget` attaches. |
| Upgrade attach restrictions | ⚠️ | `UpgradeEligibleTargets` only special-cases 2 cards (LOF_074, LOF_261). All other upgrades default to "attach to any friendly unit" — enemy upgrade plays and more specific restrictions (e.g., "attach to non-VEHICLE") are unhandled. |
| Upgrade on enemy unit | ❌ | `ownUnits` only checks the playing player's units; enemy attachment is not possible. |
| Play from non-hand zones (Smuggle, Plot) | ⚠️ | `SmuggleCost` and `HasPlot` dictionaries exist but no dispatch path handles playing a card from resources. |
| Uniqueness rule — defeat copy if duplicate | ❌ | `CardIsUnique` is referenced but no enforcement runs when a unit enters play. |
| "When Played" trigger window | ✅ | `resolveWhenPlayed` (immediate input required) and `triggerBag` (auto-resolve) both used. |
| Playing a card "this phase" tracking | ✅ | `roundState.cardsPlayedThisPhase` tracked in `CardWasPlayedThisPhase`. |

---

## 4. Combat / Attack

| Mechanic | Status | Notes |
|---|---|---|
| Declare attacker — must be ready | ✅ | Checked in `handleInitiateAttack`. |
| Attacker exhausts on attack | ✅ | Set in `resolveAttack`. |
| Choose defender (unit or base) | ✅ | `computeAttackTargets` + `handleChooseTarget`. |
| Arena restriction (ground attacks ground, space attacks space) | ✅ | `computeAttackTargets` filters by `CardArena`. |
| Cross-arena attack ability ("can attack ground from space") | ❌ | No mechanism for cards that override arena restrictions (e.g., Strafing Gunship). |
| Deal simultaneous combat damage | ✅ | Both attacker and defender take damage before defeat check. |
| Defeat units with 0 remaining HP | ✅ | Checked immediately after damage in `resolveAttack`. |
| Defender-first defeat ordering | ✅ | Defender checked first per rules. |
| Attacker defeated during attack | ✅ | Handled. |
| "When this unit completes an attack" trigger | ✅ | `resolveWhenAttackEnds` fires for Leia Organa (SOR_009). |
| Undeployed leader attacks | ❌ | Leaders must be deployed to attack; non-deployed leaders attacking is not possible by design. |
| Losing control of attacker/defender mid-attack | ❌ | No take-control mechanic exists. |

---

## 5. Keywords

### 5.1 Ambush
| Status | Notes |
|---|---|
| ✅ | `HasAmbush` dictionary is extensive (covers many conditional forms, effect-granted, upgrade-granted Ambush). Ambush attack is routed through the normal attack flow with an `attack-target` pending. |
| ⚠️ | The rule that a unit with Ambush still enters exhausted is correct, but the exhausted-unit-may-attack-via-Ambush exception must be set at dispatch. Currently it's unclear if the engine enforces that the Ambush attack ignores the "attacker must be ready" check in `handleInitiateAttack`. |

### 5.2 Grit
| Status | Notes |
|---|---|
| ✅ | `grit.ts` dictionary exists. Power bonus from Grit is applied at `CurrentPower` time. |
| ⚠️ | The rule that Grit power is not counted during simultaneous damage resolution (the damage just dealt does not boost power for that same combat strike). `CurrentPower(isAttacking)` does not distinguish "during combat damage resolution." |

### 5.3 Overwhelm
| Status | Notes |
|---|---|
| ✅ | Implemented in `resolveAttack`; excess damage flows to base. |
| ⚠️ | Shield token interaction — if defender had a Shield, excess damage should not deal to base. Engine checks `HasOverwhelm` but does not check if a Shield prevented the hit. |

### 5.4 Raid X
| Status | Notes |
|---|---|
| ✅ | `RaidAmount` dictionary consulted in `CurrentPower(isAttacking=true)`. Stacking (multiple Raid values sum) is implemented. |

### 5.5 Restore X
| Status | Notes |
|---|---|
| ✅ | `RestoreAmount` checked in `resolveAttack`; heals controller's base before combat damage. |
| ⚠️ | Restore stacking (multiple Restore values should sum). Only one Restore value is returned from the dictionary — verify the dictionary sums all sources. |

### 5.6 Saboteur
| Status | Notes |
|---|---|
| ✅ | `HasSaboteur` checked in `computeAttackTargets` to ignore Sentinel. |
| ❌ | The generic Saboteur "On Attack: defeat all Shield tokens on defender" effect is not applied universally. Only Precision Fire (SOR_168) adds a `ForAttack` effect — units with innate Saboteur do not automatically strip Shields. |

### 5.7 Sentinel
| Status | Notes |
|---|---|
| ✅ | `HasSentinel` dictionary is comprehensive (covers upgrades, effects, conditional forms). `computeAttackTargets` enforces Sentinel correctly. |
| ⚠️ | The rule that "abilities can't prevent a Sentinel unit from being attacked" (i.e., Hidden + Sentinel = can be attacked) is not enforced in the engine's Hidden check. |

### 5.8 Shielded
| Status | Notes |
|---|---|
| ✅ | `HasShielded` dictionary is large and well-populated. |
| ❌ | No engine action actually **gives a Shield token** to a unit when Shielded triggers (the When Played / When Deployed window). The dictionary correctly identifies if a card has Shielded, but there is no code path to create and attach a Shield token upgrade to the unit when it enters play. |

### 5.9 Bounty
| Status | Notes |
|---|---|
| ⚠️ | `CountBounties` and `HasBounty` exist. `Unit.HasBounty()` is used for conditions (e.g., Hunter of the Haxion Brood). |
| ❌ | Bounty resolution itself — when a unit with Bounty is defeated, no engine path triggers the Bounty ability and routes it to the opponent to resolve. `resolveWhenDefeated` only handles K-2SO (SOR_145). |

### 5.10 Smuggle [Y]
| Status | Notes |
|---|---|
| ⚠️ | `SmuggleCost` dictionary exists. `PlayerHasCardsToSmuggle` checks resource zone. |
| ❌ | No dispatch handler allows playing a card from resources using Smuggle cost. The "replace with top of deck" effect is also unimplemented. |

### 5.11 Coordinate
| Status | Notes |
|---|---|
| ⚠️ | `HasCoordinate` and `IsCoordinateActive` (≥3 units) exist. Coordinate is used as a condition for some Sentinel/power checks. |
| ❌ | The Coordinate **ability text** (what a unit gains while Coordinate is active) is not automatically applied — each card-specific effect must be hardcoded elsewhere. There is no generic "if Coordinate active, apply this keyword/ability" framework. |

### 5.12 Exploit X
| Status | Notes |
|---|---|
| ⚠️ | `ExploitAmount` dictionary is populated (many TWI cards). |
| ❌ | No dispatch or play-card path invokes Exploit. The cost reduction for defeating friendly units during play is not implemented. "When Defeated" abilities from Exploit-defeated units triggering after the play action is not handled. |

### 5.13 Piloting [Y]
| Status | Notes |
|---|---|
| ⚠️ | `PilotingCost` dictionary is populated (JTL cards). `LeaderCanDeployAsPilot` exists. |
| ❌ | No play-card path allows choosing to play a Piloting unit as an upgrade. The "attach to friendly VEHICLE unit without a PILOT upgrade" restriction check is absent. |

### 5.14 Hidden
| Status | Notes |
|---|---|
| ⚠️ | `HasHidden` dictionary is populated (LOF cards). |
| ❌ | The engine never consults `HasHidden` during `computeAttackTargets` to exclude a unit that was played this phase. There is no tracking of "was this unit played/deployed this phase" in the attack target computation. |

### 5.15 Plot
| Status | Notes |
|---|---|
| ⚠️ | `HasPlot` dictionary exists (SEC cards). |
| ❌ | No dispatch handler triggers when a leader is deployed to check for Plot cards in resources and offer them for play. |

---

## 6. Triggered Abilities

| Trigger Type | Status | Notes |
|---|---|---|
| When Played | ✅ | Two paths: `resolveWhenPlayed` (input required) and `triggerBag` → `resolveWhenPlayedTrigger` (auto). |
| When Deployed | ⚠️ | `when-deployed.ts` action file exists. Leader deploy (`deployLeader`) does not call `resolveWhenDeployed`. |
| When Defeated | ⚠️ | `resolveWhenDefeated` handles K-2SO only. Vast majority of When Defeated cards are unimplemented. |
| On Attack | ✅ | `drainOnAttackTriggerBag` resolves On Attack triggers. Currently hardcoded to specific cards pushing into the bag. |
| When This Unit Completes an Attack | ✅ | `resolveWhenAttackEnds` implemented for SOR_009. |
| When a Unit is Attacked | ❌ | No trigger mechanism for defender-side triggers. |
| Trigger ordering (active player chooses) | ❌ | `drainTriggerBag`: 2+ triggers in bag are silently skipped ("future"). Only single-trigger auto-resolve is supported. |
| Nested trigger resolution | ⚠️ | Continuation chains (PendingResolution linked list) model this partially, but multi-layer nesting with player choice of order is not enforced. |
| Delayed effects | ❌ | No `DelayedEffect` system. Cards like "At the start of the regroup phase, draw 1 card" cannot be represented. |
| Replacement effects ("instead", "would") | ❌ | No general replacement effect system. Shield prevention is inline in `resolveAttack` but only if engine explicitly checks for tokens (not currently done). |

---

## 7. Effects & Lasting Effects

| Mechanic | Status | Notes |
|---|---|---|
| `ForAttack` lasting effects | ✅ | `currentEffects` with `duration: "ForAttack"` are cleaned up after attack. |
| `ForThisPhase` lasting effects | ⚠️ | Stored in `currentEffects` but **never automatically cleared** at phase end because no phase-end dispatch exists. |
| `ForThisRound` lasting effects | ❌ | Same issue — no round-end clearing. |
| Power modifiers (+ and −) | ⚠️ | `CurrentPower` applies upgrade bonuses and effect bonuses. Negative modifiers (e.g., "Give a unit −2/−0") are not handled. |
| HP modifiers (+ and −) | ⚠️ | `TotalHP` applies upgrade HP modifiers. Negative HP modifiers and the "defeat immediately if remaining HP ≤ 0 after modifier removal" rule are not enforced. |
| "Lose all abilities" | ✅ | `LostAbilities()` on `Unit` checks current effects (Force Lightning, Imprisoned, etc.) and propagates to keyword checks. |
| Take control of a unit | ❌ | No mechanic. `controller` can differ from `owner` but no dispatch changes controller. |
| Move a unit to another arena | ❌ | No dispatch or effect for moving between ground/space. |

---

## 8. Tokens

| Token Type | Status | Notes |
|---|---|---|
| Shield token (upgrade, ARMOR) — prevent one damage instance, then defeat | ⚠️ | `HasShielded` dictionary exists; Shield creation is absent. `resolveAttack` does not check for or defeat Shield tokens. |
| Experience token (+1/+1 upgrade, LEARNED) | ❌ | No creation or attachment mechanic. |
| Battle Droid token (ground, 1/1) | ⚠️ | `Unit.IsTokenUnit()` recognizes TWI_T01; creation must happen via card-specific When Played logic. |
| Clone Trooper token (ground, 2/2) | ⚠️ | Same as above — TWI_T02 recognized as token unit. |
| TIE Fighter token (space, 1/1) | ⚠️ | JTL_T01 recognized. |
| X-Wing token (space, 2/2) | ⚠️ | JTL_T02 recognized. |
| Force token (base zone, special) | ⚠️ | `HasTheForce` and `supplemental.forceToken` exist. No dispatch creates/destroys Force token or enforces the "Use the Force" mechanic fully. |
| Spy token | ⚠️ | SEC_T01 recognized as token. |
| Token defeated → set aside (not discard) | ❌ | `defeatUnit` → `pushToDiscard` for all units. Tokens should be set aside, not placed in discard. |

---

## 9. Leaders

| Mechanic | Status | Notes |
|---|---|---|
| Leader side in base zone with abilities | ✅ | Leader action abilities routed through `handleUseAbility`. |
| Leader deploy (Epic Action) — flip, move to ground arena, ready | ✅ | `deployLeader` implemented. |
| Leader deploys into space (Pilot deploy) | ⚠️ | `LeaderCanDeployAsPilot` dictionary exists but `deployLeader` always calls `addToArena` which uses `CardArena` (ground for leaders). Pilot-deploy to space is not handled. |
| Leader defeated → return to base zone exhausted | ✅ | `defeatUnit` checks `CardIsLeader` and flips `leader.deployed = false`. |
| Epic Action used flag persists across re-entry | ✅ | `epicActionUsed` is on the leader object and survives defeat/re-entry. |
| Leader as unit — all unit rules apply | ✅ | Leader units participate in combat normally. |
| Leader upgrade deploy | ❌ | No path for leaders that deploy as upgrades on units. |
| Leader abilities ignored (Brain Invaders) | ✅ | `LeaderAbilitiesIgnored()` checks for TWI_255 in play and propagates. |

---

## 10. Upgrades (General Rules)

| Mechanic | Status | Notes |
|---|---|---|
| Upgrade gives power/HP modifier to attached unit | ✅ | `CardUpgradePower` / `CardUpgradeHp` summed in `CurrentPower` / `TotalHP`. |
| Upgrade defeated when unit leaves play | ❌ | `removeFromArena` splices the unit but does not explicitly defeat/discard upgrades. They vanish with the unit but no "When Defeated" on upgrades fires. |
| Upgrade giving abilities ("attached unit gains X") | ⚠️ | Some keywords (Sentinel, Shielded) correctly check upgrades in their dictionaries. A general "attached unit gains" framework for arbitrary abilities does not exist. |
| Upgrade abilities that affect unit without "gains" (e.g., Entrenched "can't attack bases") | ❌ | No general mechanism; must be hardcoded per card. |
| No limit on upgrades per unit | ✅ | `unit.upgrades` is an unbounded array. |
| Upgrade on enemy unit (controller stays with upgrade owner) | ❌ | `UpgradeEligibleTargets` only returns friendly units. |
| PILOT upgrades (unit as upgrade) | ⚠️ | Framework partially exists (`PilotingCost`, `isClone` flag for Clones) but playing a unit as a Pilot upgrade is not implemented end-to-end. |

---

## 11. Capture Mechanic

| Mechanic | Status | Notes |
|---|---|---|
| Capture a unit (place facedown under capturer) | ⚠️ | `unit.captives: Unit[]` field exists in the data model. |
| Rescue a captured unit | ❌ | No dispatch or engine path rescues captives. |
| Captured unit released when guard leaves play | ❌ | `defeatUnit` / `removeFromArena` do not check and release captives. |
| Bounty triggers when unit captured | ❌ | Not implemented. |

---

## 12. The Force

| Mechanic | Status | Notes |
|---|---|---|
| "The Force is with you" — create Force token in base zone | ⚠️ | `supplemental.forceToken` boolean exists. No engine dispatch creates it via card ability. |
| "Use the Force" — defeat Force token for effect | ❌ | No dispatch or effect path. |
| Check "if the Force is with you" in conditions | ✅ | `HasTheForce(player)` used in keyword dicts (e.g., Jedi Sentinel). |

---

## 13. Additional Rule Mechanics

| Mechanic | Status | Notes |
|---|---|---|
| Indirect damage (player assigns among own units/base) | ❌ | No pending resolution type for indirect damage assignment. |
| Unpreventable damage | ❌ | No flag or enforcement; indirect damage should bypass Shields. |
| "Do as much as you can" | ⚠️ | Followed informally but not systematically enforced (some abilities return null silently). |
| Golden Rule: card overrides rules | ⚠️ | Handled per-card in switch statements; no generic override system. |
| Restrictions override permissions | ❌ | No rule engine — if two effects conflict, no precedence resolution exists. |
| Uniqueness enforcement | ❌ | Entering play with a duplicate unique card is not detected or resolved. |
| Undo / state history | ✅ | `gameStateHistory` snapshotted before top-level actions. |
| Open vs. hidden information enforcement | ❌ | Engine does not enforce information boundaries; all state is returned to the client. |
| Disclose mechanic (reveal aspects from hand) | ❌ | Not implemented. |
| Empty deck damage (3 per card drawn) | ❌ | Not implemented. |
| "Defeated this phase" / "attacked this phase" tracking | ✅ | `roundState.cardsLeftPlayThisPhase` and `roundState.unitsAttackedThisPhase` tracked. |
| "First/second event played this phase" tracking | ⚠️ | `cardsPlayedThisPhase` exists; "first/second" ordinal queries would need additional index logic. |
| choose-player dispatch type | ❌ | Stubbed as "not yet implemented." |
| choose-trigger dispatch type (trigger ordering) | ❌ | Stubbed as "not yet implemented." |

---

## 14. Summary — Priority Gaps

These are the highest-impact missing pieces for a playable, rules-compliant engine:

1. **Shield tokens** — creation on Shielded trigger, prevention during combat, defeat-one-per-hit rule.
2. **Regroup phase** — draw, resource, ready cards, phase-boundary lasting-effect expiry.
3. **Bounty resolution** — trigger when unit defeated/captured, route to opponent.
4. **Token set-aside rule** — tokens go to set-aside, not discard pile.
5. **Saboteur shield strip** — generic "On Attack: defeat all Shields on defender" for any unit with innate Saboteur.
6. **Exploit** — cost reduction during play, friendly unit defeat payment.
7. **Smuggle / Plot** — play-from-resource dispatch paths and deck-replacement.
8. **Piloting** — play-as-upgrade dispatch path including VEHICLE restriction.
9. **Hidden** — exclude newly-played units from `computeAttackTargets`.
10. **Trigger bag ordering** — 2+ simultaneous triggers require player-ordered resolution.
11. **Uniqueness rule** — detect and defeat duplicate unique cards on entry.
12. **Upgrade-on-enemy-unit** — `UpgradeEligibleTargets` must optionally include enemy units.
13. **Delayed effects system** — "at start of regroup phase, …" pattern.
14. **When Defeated** — only K-2SO is handled; all other When Defeated cards are silently ignored.
15. **Capture / Rescue** — mechanic is modeled in data but has no engine actions.
