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
| Claim Initiative / Take the Initiative | ✅ | `handleClaimInitiative` sets `initiativeClaimed`/`initiativePlayer`. `advanceTurn` auto-passes for the initiative holder on subsequent turns. Second claim is blocked by guard. |
| Regroup Phase — draw 2 | ✅ | `executeRegroupDraw` in `actions/regroup.ts`; called automatically from `advanceTurn`. Empty-deck penalty: 3 damage per missing card. |
| Regroup Phase — resource a card | ✅ | `"regroup-resource"` / `"pass-resource"` dispatch types; `tryRegroupResource` / `tryPassResource` in `actions/regroup.ts`. Active player (initiative holder) goes first. |
| Regroup Phase — ready all exhausted cards | ✅ | `executeRegroupReady` in `actions/regroup.ts`; auto-called after both players complete the resource step. Readies all units, leaders, and resources. |
| Start-of-phase / End-of-phase lasting-effect expiry | ⚠️ | `ForAttack` effects cleared after attacks. `Phase` and `Round` duration effects cleared in `executeRegroupReady`. Start-of-regroup and end-of-regroup step triggers not yet implemented. |
| Round counter (`currentRound`) | ✅ | Incremented in `executeRegroupReady` at end of each regroup phase. |
| Epic Action counter — once-per-game enforcement | ⚠️ | `leader.epicActionUsed` prevents a second deploy but the flag is never reset on re-entry to play per rules (it should persist). Also, non-deploy Epic Action abilities have no general once-per-game guard. |
| Consecutive-pass end-of-phase detection | ✅ | `advanceTurn` tracks `lastActionWasPass`; two consecutive passes (or pass + claim-initiative) set `gamePhase = "RegroupDraw"`. |
| Game-over when base reaches 0 HP | ✅ | `updateDefeatedPlayers` runs after every state change. |
| Draw when deck is empty (3 damage per card) | ✅ | Handled in `executeRegroupDraw`. |
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
| Resourcing a card (facedown, exhausted) | ✅ | `"regroup-resource"` dispatch in `actions/regroup.ts`; card removed from hand, pushed to `resources[]` as `{ ready: false }`. `"pass-resource"` skips the step. Both handled during RegroupResource phase. |
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
| Uniqueness rule — defeat copy if duplicate | ✅ | `DefeatCopyPending` returned immediately after `addToArena` if a duplicate unique is in play; player chooses which copy to defeat. |
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
| ✅ | `HasAmbush` dictionary is extensive. On play, an `"ambush"` trigger is pushed into the bag (same window as When Played / Shielded). `drainTriggerBag` returns an `ability-option` pending ("attack immediately?"). On Yes, unit is readied then routed to `attack-target`, bypassing `handleInitiateAttack`'s ready-check. Base is excluded from valid targets; fizzles with no prompt if no opposing units exist. |

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
| ✅ | `HasSaboteur` checked in `computeAttackTargets` to ignore Sentinel. Also, at the start of `resolveAttack` (before damage), all `SOR_T02` Shield tokens are stripped from the defender when the attacker has Saboteur. |

### 5.7 Sentinel
| Status | Notes |
|---|---|
| ✅ | `HasSentinel` dictionary is comprehensive (covers upgrades, effects, conditional forms). `computeAttackTargets` enforces Sentinel correctly. Hidden + Sentinel interaction handled: Sentinel units are excluded from the Hidden filter so they remain attackable. |

### 5.8 Shielded
| Status | Notes |
|---|---|
| ✅ | `HasShielded` dictionary is large and well-populated. On play, a `"shielded"` trigger is pushed into the bag (same timing window as When Played / Ambush). `drainTriggerBag` attaches a `SOR_T02` Shield token upgrade to the unit. In `resolveAttack`, an attacker hitting a shielded unit removes one Shield token instead of dealing damage. |

### 5.9 Bounty
| Status | Notes |
|---|---|
| ✅ | `collectBounties` in `actions/bounty.ts` builds a `BountyPending` chain (one per bounty). Called from `defeatUnit` and the capture handler. Collecting player is always the opponent of the bounty unit's controller (CR 13f). |
| ✅ | Collect is optional (`BountyPending` → ability-option Yes/No). Draw-card effect handled in `handleChooseOption`. Give-shield effect (Public Enemy SHD_068) uses `BountyShieldTargetPending` → player picks any unit → `SOR_T02` attached. |
| ✅ | Multiple bounties on one unit form a linked continuation chain — each resolves sequentially. Tested with Hylobon Enforcer (innate) + Public Enemy upgrade (granted). |
| ⚠️ | `CountBounties` and `HasBounty` dictionaries exist for condition checks but are not used during bounty resolution — `getBountyEffects` uses a direct switch. Most bounty cards beyond SHD_027 and SHD_068 need entries in `getBountyEffects` to resolve. |

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
| ✅ | `ExploitAmount` consulted in `handlePlayCard`. If exploit amount > 0, `ExploitOptionPending` (Yes/No) is returned. On Yes, `ExploitTargetPending` prompts the player to select up to X friendly units via multi-select UI. Each selected unit is defeated via `defeatForExploit`, which defers When Defeated triggers to the bag (CR 16d). After unit selection, `ExploitAmount(..., false)` consumes any Count Dooku currentEffect, cost is reduced by 2× selected units, and `completePlayCard` drains the trigger bag after the card enters play. `CardIsPlayable` accounts for Exploit reduction for UI affordability. |

### 5.13 Piloting [Y]
| Status | Notes |
|---|---|
| ✅ | `PilotingCost` dictionary populated (JTL cards). `PilotingEligibleVehicles` returns friendly Vehicle playIds not at PILOT capacity. |
| ✅ | `handlePlayCard` branches on piloting eligibility: both costs affordable + vehicle → `PilotingOptionPending`; only pilot cost affordable + vehicle → directly returns `UpgradeTargetPending` with cost already paid. |
| ✅ | Pilot stats (upgradePower / upgradeHp) applied automatically via existing `CurrentPower` / `TotalHP` upgrade summation. |
| ✅ | `deployLeader` checks `PilotingCost(leader.cardId)` and eligible vehicles; if both match, defers placement via `PilotingOptionPending` with `source = "leader"`. |
| ✅ | Millennium Falcon (JTL_249) allows 2 PILOT upgrades. R2-D2 (JTL_245) grants +1 effective max to any vehicle it pilots. Poe Dameron (JTL_013) attaches via leader ability (`PilotingCost = -1`) and does not count toward PILOT limit. |
| ⚠️ | Keyword/ability transfer (Raid, Grit, WD, WP) from pilot to vehicle not implemented — stats only. |
| ⚠️ | "When deployed as a pilot" triggers not implemented. |

### 5.14 Hidden
| Status | Notes |
|---|---|
| ✅ | `HasHidden` consulted in `computeAttackTargets`. Units in `roundState.cardsEnteredPlayThisPhase` with Hidden are filtered from valid targets. `handlePlayCard` now populates `cardsPlayedThisPhase` and `cardsEnteredPlayThisPhase`. Sentinel overrides Hidden correctly. |

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
| `ForThisPhase` lasting effects | ✅ | `executeRegroupReady` filters out `duration === "Phase"` effects at end of each regroup. |
| `ForThisRound` lasting effects | ✅ | `executeRegroupReady` also filters `duration === "Round"` effects; both cleared together at round boundary. |
| Power modifiers (+ and −) | ⚠️ | `CurrentPower` applies upgrade bonuses and effect bonuses. Negative modifiers (e.g., "Give a unit −2/−0") are not handled. |
| HP modifiers (+ and −) | ⚠️ | `TotalHP` applies upgrade HP modifiers. Negative HP modifiers and the "defeat immediately if remaining HP ≤ 0 after modifier removal" rule are not enforced. |
| "Lose all abilities" | ✅ | `LostAbilities()` on `Unit` checks current effects (Force Lightning, Imprisoned, etc.) and propagates to keyword checks. |
| Take control of a unit | ❌ | No mechanic. `controller` can differ from `owner` but no dispatch changes controller. |
| Move a unit to another arena | ❌ | No dispatch or effect for moving between ground/space. |

---

## 8. Tokens

| Token Type | Status | Notes |
|---|---|---|
| Shield token (upgrade, ARMOR) — prevent one damage instance, then defeat | ✅ | Created via `"shielded"` trigger bag on play. `resolveAttack` removes one `SOR_T02` token instead of dealing damage; Saboteur strips all Shield tokens before damage. |
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
| Capture a unit (place facedown under capturer) | ✅ | `TWI_128` (Take Captive) two-step resolution: choose captor → choose enemy non-leader in same arena. Damage cleared, upgrades defeated, unit placed in `captor.captives[]`. Phase-tracking entries removed on capture so rescue doesn't carry stale "played this phase" status. |
| Token captured → set aside | ✅ | Token units are defeated on capture instead of placed under the captor (CR 34.5). |
| Rescue a captured unit | ✅ | `defeatUnit` auto-rescues all captives when the guard leaves play — returned to owner's arena exhausted with reason `"returned-to-play"`. |
| Captured unit released when guard leaves play | ✅ | Handled in `defeatUnit`. |
| Rescued unit: enters play but not "played" | ✅ | Rescue adds `"returned-to-play"` entry to `cardsEnteredPlayThisPhase`. Hidden filter excludes `"returned-to-play"` entries; Shielded/Ambush triggers are only pushed during `handlePlayCard` so they don't fire on rescue. |
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
| Uniqueness enforcement | ✅ | `DefeatCopyPending` returned immediately after `addToArena` when a duplicate unique enters play; player chooses which copy to defeat. |
| Undo / state history | ✅ | `gameStateHistory` snapshotted before top-level actions. |
| Open vs. hidden information enforcement | ❌ | Engine does not enforce information boundaries; all state is returned to the client. |
| Disclose mechanic (reveal aspects from hand) | ❌ | Not implemented. |
| Empty deck damage (3 per card drawn) | ✅ | Implemented in `executeRegroupDraw`; 3 damage per missing card dealt to that player's base. |
| "Defeated this phase" / "attacked this phase" tracking | ✅ | `roundState.cardsLeftPlayThisPhase` and `roundState.unitsAttackedThisPhase` tracked. |
| "First/second event played this phase" tracking | ⚠️ | `cardsPlayedThisPhase` exists; "first/second" ordinal queries would need additional index logic. |
| choose-player dispatch type | ❌ | Stubbed as "not yet implemented." |
| choose-trigger dispatch type (trigger ordering) | ❌ | Stubbed as "not yet implemented." |

---

## 14. Summary — Priority Gaps

These are the highest-impact missing pieces for a playable, rules-compliant engine:

1. **When Defeated coverage** — Only K-2SO is handled; all other When Defeated cards are silently ignored.
2. **Bounty card coverage** — `getBountyEffects` currently handles SHD_027 (draw a card) and SHD_068 (give shield). All other bounty cards in the set need entries.
3. **Token set-aside rule** — tokens go to set-aside, not discard pile.
4. **Piloting** — play-as-upgrade dispatch path including VEHICLE restriction.
5. **Smuggle / Plot** — play-from-resource dispatch paths and deck-replacement.
6. **Trigger bag ordering** — 2+ simultaneous triggers require player-ordered resolution.
7. **Upgrade-on-enemy-unit** — `UpgradeEligibleTargets` must optionally include enemy units.
8. **Delayed effects system** — "at start of regroup phase, …" pattern.

### Recently Completed
- ✅ **Exploit** — `ExploitOptionPending` / `ExploitTargetPending` two-step chain. Cost reduced 2× per sacrificed unit. WD triggers deferred to bag per CR 16d. Count Dooku stacking via `currentEffect`. Superlaser Technician put-into-play-as-resource WD handled. Multi-select UI for target selection.
- ✅ **Bounty resolution** — `collectBounties` wired into defeat and capture. Optional collect (Yes/No). Draw-card and give-shield effects implemented. Multi-bounty sequential resolution tested.
- ✅ **Regroup phase** — draw 2 (empty-deck penalty), optional resource-a-card step, auto-ready all units/leaders/resources, Phase+Round effect clearing, round counter increment.
- ✅ **Capture mechanic** — `TWI_128` two-step resolution; token capture defeats token; auto-rescue on captor defeat; Hidden/Shielded/Ambush do not re-trigger on rescue.
- ✅ **TPA (turn-per-action)** — `processDispatch` rejects out-of-turn top-level actions; `advanceTurn` alternates `activePlayer` after each action.
- ✅ **Action phase end** — consecutive passes (or pass + claim-initiative) set `gamePhase = "RegroupDraw"`.
- ✅ **Claim Initiative** — auto-passes for the holder on subsequent turns; second claim blocked.
- ✅ **Hidden** — `computeAttackTargets` excludes units in `cardsEnteredPlayThisPhase` that have Hidden, unless they also have Sentinel.
- ✅ **Shield token creation** — `"shielded"` trigger in the bag; `SOR_T02` attached on play.
- ✅ **Shield prevention** — attacker hitting a shielded unit removes the token instead of dealing damage.
- ✅ **Ambush** — `"ambush"` trigger in the bag; optional attack prompt, units only, fizzles with no targets.
- ✅ **Saboteur shield strip** — all Shield tokens removed from defender before damage when attacker has Saboteur.
- ✅ **Uniqueness rule** — `DefeatCopyPending` enforced immediately when a duplicate unique enters play.
