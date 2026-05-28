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
| Play from non-hand zones (Smuggle, Plot) | ✅ | Smuggle: `play-smuggle` dispatch, `SmuggleCost` + aspect penalty, deck-top replacement (exhausted), `ResourceIsSmuggleable` UI filter. Plot: `PlotWindowPending` chain on deploy, affordability filter, multi-Plot looping, CR 19d deck-replacement exclusion enforced. |
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
| ✅ | `play-smuggle` dispatch: `SmuggleCost` + aspect penalty computed, ready resources exhausted, card removed from resources, deck-top replacement added (exhausted), card placed in arena via `addToArena`. `ResourceIsSmuggleable` used in UI to highlight eligible resources. |

### 5.11 Coordinate
| Status | Notes |
|---|---|
| ✅ | `HasCoordinate` and `IsCoordinateActive` (≥3 units) exist. `IsCoordinateActive` gates actual keyword grants per implemented card: TWI_051 (Restore), TWI_061 (Sentinel), TWI_164 / TWI_196 (Raid). Each card's Coordinate ability is hardcoded where the keyword is checked — no generic framework, but all currently implemented Coordinate cards are wired correctly. |

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
| ✅ | `LeaderDeployPilotThreshold` dictionary maps pilot-capable leaders to their minimum resource count. `deployLeader` checks this threshold + eligible vehicles; if both match, defers placement via `PilotingOptionPending { source: "leader" }`. Leader deploys are a condition check (no resources spent). Prompt shows "Deploy as Unit" / "Deploy as Pilot". Asajj Ventress (JTL_001, threshold 6) is the first entry. |
| ✅ | Millennium Falcon (JTL_249) allows 2 PILOT upgrades. R2-D2 (JTL_245) grants +1 effective max to any vehicle it pilots. Poe Dameron (JTL_013) attaches via leader `use-ability` (`PilotingCost = -1`) and does not count toward PILOT limit. |
| ⚠️ | Keyword/ability transfer (Raid, Grit, WD, WP) from pilot to vehicle not implemented — stats only. |
| ⚠️ | "When deployed as a pilot" triggers not implemented. |

### 5.14 Hidden
| Status | Notes |
|---|---|
| ✅ | `HasHidden` consulted in `computeAttackTargets`. Units in `roundState.cardsEnteredPlayThisPhase` with Hidden are filtered from valid targets. `handlePlayCard` now populates `cardsPlayedThisPhase` and `cardsEnteredPlayThisPhase`. Sentinel overrides Hidden correctly. |

### 5.15 Plot
| Status | Notes |
|---|---|
| ✅ | `HasPlot` dictionary. On deploy: `getAffordablePlotPlayIds` (cost + aspect penalty checked) → `PlotWindowPending` (or `PlotOrderPending` when leader also has When Deployed). Multi-Plot looping: after each card played, remaining affordable candidates recomputed and window reopened if any remain. CR 19d enforced: candidates filtered from the original deploy-time list — deck replacement card is never eligible. UI: `NeedsPlot` resolution type shows a card-art popup with a Pass option. |

---

## 6. Triggered Abilities

| Trigger Type | Status | Notes |
|---|---|---|
| When Played | ✅ | Two paths: `resolveWhenPlayed` (input required) and `triggerBag` → `resolveWhenPlayedTrigger` (auto). |
| When Deployed | ⚠️ | `resolveWhenDeployed` called from `deployLeader` and the Plot chain. Qi'ra (SHD_002) implemented: heal all units, then deal `floor(HP/2)` to each (Shield absorption included). Other leaders' When Deployed effects are not yet implemented. |
| When Defeated | ⚠️ | `resolveWhenDefeated` handles K-2SO (SOR_047), Superlaser Technician (SOR_083, put into play as a resource), and Luke Skywalker pilot eject (special-cased in `defeatUnit` to rescue attached pilot). Vast majority of When Defeated cards are still unimplemented. |
| On Attack | ✅ | `drainOnAttackTriggerBag` resolves On Attack triggers. Currently hardcoded to specific cards pushing into the bag. |
| When This Unit Completes an Attack | ✅ | `resolveWhenAttackEnds` implemented for SOR_009. |
| When a Unit is Attacked | ❌ | No trigger mechanism for defender-side triggers. |
| Trigger ordering (active player chooses) | ⚠️ | `drainTriggerBag` correctly returns `TriggerOrderPending` when 2+ triggers are in the bag. Resolved as `NeedsOption` (type `"Option"`) via `handleChooseOption` with helperText `"Choose which trigger to resolve first:"`. The `choose-trigger` dispatch case is a vestigial stub; ordering goes through `choose-option`. Full multi-layer nesting with re-queued triggers is not yet stress-tested. |
| Leader-reaction triggers | ✅ | `"leader-reaction"` TriggerType added. `completePlayCard` injects the trigger when the played unit meets the leader's condition (e.g., SHD_008 Boba Fett: keyword unit played, leader not deployed and ready). `processSingleTrigger` returns an `ability-option` (exhaust leader Y/N); on Yes, routes to `ability-target` for the effect. Participates in `drainTriggerBag` ordering correctly. |
| Nested trigger resolution | ⚠️ | Continuation chains (PendingResolution linked list) model this partially, but multi-layer nesting with player choice of order is not enforced. |
| Delayed effects | ⚠️ | No general `DelayedEffect` system for arbitrary "at start of regroup phase, …" patterns. However, `UntilStartOfRegroup` duration exists for revert-on-regroup effects: Change of Heart (SOR_224) uses it to transfer unit control and auto-revert at start of the next regroup phase. |
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
| Take control of a unit | ⚠️ | `transferControl(game, log, unit, newController)` function exists. Change of Heart (SOR_224) fully implemented: `transferControl` moves the unit, pushing a `UntilStartOfRegroup` revert effect that calls `transferControl` back at the start of the next regroup phase. |
| Move a unit to another arena | ⚠️ | `PayToMoveGroundPending` exists for unit-to-ground-arena movement. Luke Skywalker's pilot-eject triggers a ground placement, and Blue Leader (JTL_096) uses a pay-to-move flow. No generic `moveToArena` for arbitrary arena swaps. |
| Revert-on-regroup lasting effects | ⚠️ | `UntilStartOfRegroup` duration used by Change of Heart (SOR_224). `executeRegroupReady` processes revert effects before readying cards. Single-card coverage; no general delayed-trigger system. |

---

## 8. Tokens

| Token Type | Status | Notes |
|---|---|---|
| Shield token (upgrade, ARMOR) — prevent one damage instance, then defeat | ✅ | Created via `"shielded"` trigger bag on play. `resolveAttack` removes one `SOR_T02` token instead of dealing damage; Saboteur strips all Shield tokens before damage. |
| Experience token (+1/+1 upgrade, LEARNED) | ⚠️ | `SOR_T01` token type exists and is recognized. Wing Leader (SOR_241) and Blue Leader (JTL_096) create Experience tokens via card-specific When Played / ability logic. No generic "give Experience token" effect helper; each card that creates tokens is hardcoded. |
| Battle Droid token (ground, 1/1) | ⚠️ | `Unit.IsTokenUnit()` recognizes TWI_T01; creation must happen via card-specific When Played logic. |
| Clone Trooper token (ground, 2/2) | ⚠️ | Same as above — TWI_T02 recognized as token unit. |
| TIE Fighter token (space, 1/1) | ⚠️ | JTL_T01 recognized. |
| X-Wing token (space, 2/2) | ⚠️ | JTL_T02 recognized. |
| Force token (base zone, special) | ⚠️ | `HasTheForce` and `supplemental.forceToken` exist. No dispatch creates/destroys Force token or enforces the "Use the Force" mechanic fully. |
| Spy token | ⚠️ | SEC_T01 recognized as token. |
| Token defeated → set aside (not discard) | ✅ | `defeatUnit` guards with `!unit.IsTokenUnit()` before calling `pushToDiscard` (CR 7.6.1 comment in code). Token unit types also record reason `"token-defeated"` in `cardsLeftPlayThisPhase`. Token upgrades (Shield, Experience) disappear when their unit leaves play — also not placed in discard. Tested in `simple-token.test.ts` ("Token Unit Removal", "Token Upgrade Removal"). Tokens are infinitely available — no supply pool tracked. |

---

## 9. Leaders

| Mechanic | Status | Notes |
|---|---|---|
| Leader side in base zone with abilities | ✅ | Leader action abilities routed through `handleUseAbility`. |
| Leader deploy (Epic Action) — flip, move to ground arena, ready | ✅ | `deployLeader` implemented. |
| Leader deploys as pilot (Epic Action) | ✅ | `LeaderDeployPilotThreshold` dictionary maps pilot-capable leaders to their minimum resource count condition (not a payment). `deployLeader` checks threshold + eligible vehicles; defers placement via `PilotingOptionPending { source: "leader" }`. Prompt shows "Deploy as Unit" / "Deploy as Pilot". Asajj Ventress (JTL_001, threshold 6) is the first entry. |
| Leader defeated → return to base zone exhausted | ✅ | `defeatUnit` checks `CardIsLeader` and flips `leader.deployed = false`. |
| Epic Action used flag persists across re-entry | ✅ | `epicActionUsed` is on the leader object and survives defeat/re-entry. |
| Leader as unit — all unit rules apply | ✅ | Leader units participate in combat normally. |
| Leader upgrade deploy | ✅ | `handleChooseOption` "Deploy as Pilot" branch attaches leader as an upgrade via `UpgradeTargetPending`; sets `leader.deployedPlayId` to the upgrade's `playId`. Card renders as card back in `UpgradeStrip`. |
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
| PILOT upgrades (unit as upgrade) | ✅ | Full piloting flow implemented: `handlePlayCard` branches on `PilotingCost` eligibility → `PilotingOptionPending` (both costs affordable + vehicle present) or direct `UpgradeTargetPending` (only pilot cost affordable). `PilotingEligibleVehicles` enforces Vehicle trait and PILOT slot limits. Special cases: Millennium Falcon (2 slots), R2-D2 (+1 effective max), Poe Dameron (`PilotingCost = -1`, doesn't count). |

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

### 13.1 Damage & Prevention (CR 8.36, CR 21)

| Mechanic | Status | Notes |
|---|---|---|
| Indirect damage — player assigns among own units/base | ❌ | Requires a new `IndirectDamagePending` resolution type: engine picks a player, that player assigns X unpreventable damage split across any of their units/base. No pending type or dispatch path exists. Example card: splash-damage bases like LAW_020. |
| Unpreventable damage flag | ❌ | No `unpreventable` flag on damage sources. Indirect damage (CR 36) and certain card effects should bypass Shields and "can't be damaged" clauses. Currently all damage in `resolveAttack` is checked the same way. |
| Prevent damage (CR 21) | ❌ | No general "prevent X damage" effect system. Shield tokens are the only prevention implemented (inline in `resolveAttack`). Cards like "prevent all damage to a unit this phase" have no representation. |
| Damage assignment ordering | ⚠️ | Simultaneous combat damage is implemented. Multi-blocker or multi-target damage assignment ordering (CR 8.13) not relevant to the 1v1 format but edge cases like Overwhelm + Shield are not fully correct (Shield removal should block excess-to-base flow). |

### 13.2 Effect Resolution Language (CR 29, 31, 32, 33, 35)

| Mechanic | Status | Notes |
|---|---|---|
| "THEN" — sequential effects (CR 29) | ⚠️ | "Then" sequencing is correctly followed in continuation chains (e.g., Rebel Assault: attack, then attack again). However, triggers spawned by the first effect are supposed to queue and fire only after both effects complete — this is not enforced generally; some fire immediately mid-chain. |
| "You May" — optional abilities (CR 33) | ⚠️ | Optional abilities use `ability-option` (Yes/No) for explicit prompts. Cards that auto-resolve when no valid targets exist return null early. The "if you do" clause following a "you may" is implemented per-card; no general framework enforces it structurally. "Use this ability only once each round" restriction is not tracked for non-leader abilities. |
| "Up To X" targets (CR 31) | ⚠️ | `maxTargets` on `NeedsTarget` supports multi-select up to X (Exploit uses it). Returning 0 targets (opting out) via empty `targetPlayIds` works. The semantic distinction between "must choose at least 1" vs "may choose 0" is enforced per-card, not generically. |
| "For Each" — simultaneous multi-effects (CR 35) | ❌ | No general "for each X do Y" framework. All such effects must be hardcoded. Example: Calculated Lethality (SHD_039) — "for each upgrade defeated, give an Experience token" cannot be expressed generically. |
| "You" — controller vs owner (CR 32) | ⚠️ | Most abilities correctly reference the controller. `controller` field exists on all in-play cards. Abilities that fire on "when you do X" correctly check the controlling player. However, when a unit changes controller mid-game (not yet supported), all triggers and ability references would still use the original controller. |
| "Do as much as you can" (CR 1.4) | ⚠️ | Followed informally — abilities that find no valid targets return `null` and auto-resolve. No systematic enforcement: a card that says "deal damage to up to 3 units" with only 1 unit in play would need to deal damage to that 1 unit, not silently skip. Not verified for all cards. |

### 13.3 Play Restrictions & Permissions (CR 3, 20)

| Mechanic | Status | Notes |
|---|---|---|
| Golden Rule: card text overrides rules (CR 3.1) | ⚠️ | Implemented per-card in switch statements. No generic override system — each exception (e.g., "this unit can attack exhausted units," "this unit can't be defeated") must be hardcoded wherever the overridden rule is enforced. |
| Restrictions override permissions (CR 3.3) | ❌ | No rule engine. If a card says "can't attack bases" and another says "may attack any target," there is no precedence mechanism — whichever code path runs first wins. |
| Play restrictions — "can't play" abilities (CR 20.3) | ❌ | No `playRestrictions[]` on game state. Cards like Regional Governor (SOR_062) that prevent playing a named card cannot be enforced. `canPlayCard` only checks cost/phase, not ability-based restrictions. |
| Play restriction — no eligible upgrade target (CR 20.2) | ✅ | `UpgradeEligibleTargets` returns empty → `handlePlayCard` rejects the play. |
| Additional costs — "also defeat a friendly unit" (CR 6.2.4) | ❌ | No framework for non-resource additional costs. Cards requiring a sacrifice or discard as part of playing are not representable. |

### 13.4 Zone Mechanics (CR 25, 26, 27, 37)

| Mechanic | Status | Notes |
|---|---|---|
| Return a unit to hand (CR 25) | ⚠️ | Implemented for Waylay (SOR_222): `removeFromArena()` + push to `owner.hand[]`. Does not re-trigger When Played or Shielded/Ambush. Other return-to-hand cards (e.g., Bright Hope SOR_099) are not yet wired; they still return `null` from `resolveWhenPlayed`. |
| Reveal from hand / Disclose (CR 26, 39) | ❌ | No reveal mechanic. "Disclose" (reveal aspect icons from hand) has no dispatch path or pending type. ISB Agent (SOR_176) "reveal an event from hand" cannot check this. Would require a new `NeedsReveal` or similar resolution asking the client to expose one or more hand cards. |
| Search deck (CR 27) | ❌ | No search mechanic. Cards that say "search your deck for X" require showing the player a filtered view of the deck — a fundamentally different UI interaction. Not representable with current pending resolution types. |
| Move between arenas (CR 37) | ⚠️ | `PayToMoveGroundPending` exists for specific cards (Luke pilot-eject → ground placement, Blue Leader JTL_096 pay-to-move flow). No generic `moveToArena` function for arbitrary ground↔space swaps. |
| Take control of a unit (CR 28) | ⚠️ | `transferControl(game, log, unit, newController)` implemented. Change of Heart (SOR_224) fully wired with `UntilStartOfRegroup` auto-revert. Broader coverage (e.g., "take control of a unit with 3 or less power") needs per-card wiring; the infrastructure is in place. |

### 13.5 Information & State Tracking

| Mechanic | Status | Notes |
|---|---|---|
| Open vs. hidden information enforcement | ❌ | Engine returns the full `GameState` to the client on every response, exposing both players' hands and deck order. A compliant engine would send each player only their own hidden information. Requires per-player state projection before sending. |
| Disclose mechanic (reveal aspects from hand) | ❌ | Relies on reveal; see Zone Mechanics above. No pending type for "choose cards from hand to disclose." |
| Empty deck damage (3 per card drawn) | ✅ | `executeRegroupDraw`; 3 damage per missing card dealt to that player's base. |
| "Defeated this phase" / "attacked this phase" tracking | ✅ | `roundState.cardsLeftPlayThisPhase` and `roundState.unitsAttackedThisPhase` tracked per round. |
| "Entered play this phase" tracking | ✅ | `roundState.cardsEnteredPlayThisPhase` tracks playIds + method (`"played"`, `"returned-to-play"`, etc.). Used by Hidden keyword. |
| "First/second event played this phase" ordinal tracking | ⚠️ | `cardsPlayedThisPhase` stores all cards played. Ordinal queries ("was this the first event?") require filtering by `"Unit"` / `"Event"` type and checking index — not yet used but the data is present. |
| Undo / state history | ✅ | `gameStateHistory` deep-cloned and snapshotted before every top-level irreversible action (`stateChanged: true`). `/api/puzzle/undo` restores the last snapshot. |

### 13.6 Dispatch & Trigger Infrastructure

| Mechanic | Status | Notes |
|---|---|---|
| choose-player dispatch type | ❌ | `NeedsPlayer` resolution type exists and `pendingToResolution` emits it. The `handleChoosePlayer` stub returns "not yet implemented." No card currently requires player selection mid-resolution in the engine beyond zone targeting. |
| choose-trigger dispatch type (trigger ordering) | ⚠️ | `drainTriggerBag` returns `TriggerOrderPending` (resolved as `NeedsOption` via `handleChooseOption`) when 2+ triggers are in the bag. The `choose-trigger` dispatch case is a vestigial stub — ordering flows through `choose-option`. Trigger-order prompt is confirmed working (tested: Ambush + leader-reaction on the same play). |
| Trigger ordering — active player chooses (CR 7.6.3) | ⚠️ | Working for simultaneous triggers within one `drainTriggerBag` call. Triggers spawned *by* the resolution of one trigger may re-enter the bag correctly, but complex multi-wave ordering is not fully stress-tested. |
| Delayed / lasting triggered effects | ⚠️ | `UntilStartOfRegroup` duration exists (used by Change of Heart SOR_224 for revert-on-regroup). Arbitrary "at start of regroup phase, draw 1 card" patterns still have no general `DelayedEffect` system. |
| Replacement effects ("instead," "would") | ❌ | No general replacement effect system. The "instead of dealing damage, do X" pattern requires effects to broadcast a "damage about to be dealt" event that a replacement handler can intercept. Shield prevention is the only inline replacement and it's hardcoded in `resolveAttack`. |

---

## 14. Summary — Mechanism Completeness

> Scores measure whether the **engine mechanism exists**, not whether every card exercising that mechanism is wired up. Card coverage is a separate concern.

### 14.1 Section-by-section (mechanism only)

| Section | ✅ | ⚠️ | ❌ | Score |
|---|---|---|---|---|
| 1. Turn Structure & Flow | 10 | 2 | 1 | 11/13 — **85%** |
| 2. Resources & Cost | 4 | 2 | 2 | 5/8 — **63%** |
| 3. Playing Cards | 7 | 1 | 1 | 7.5/9 — **83%** |
| 4. Combat | 9 | 0 | 3 | 9/12 — **75%** |
| 5. Keywords (24 sub-items) | 20 | 4 | 0 | 22/24 — **92%** |
| 6. Triggered Abilities | 6 | 3 | 2 | 7.5/11 — **68%** |
| 7. Lasting Effects | 6 | 3 | 0 | 7.5/9 — **83%** |
| 8. Tokens | 8 | 1 | 0 | 8.5/9 — **94%** |
| 9. Leaders | 8 | 0 | 0 | 8/8 — **100%** |
| 10. Upgrades | 3 | 1 | 3 | 3.5/7 — **50%** |
| 11. Capture | 5 | 0 | 1 | 5/6 — **83%** |
| 12. The Force | 1 | 1 | 1 | 1.5/3 — **50%** |
| 13.1 Damage & Prevention | 1 | 1 | 2 | 1.5/4 — **38%** |
| 13.2 Effect Language | 0 | 5 | 1 | 2.5/6 — **42%** |
| 13.3 Play Restrictions | 1 | 1 | 3 | 1.5/5 — **30%** |
| 13.4 Zone Mechanics | 3 | 2 | 0 | 4/5 — **80%** |
| 13.5 State Tracking | 4 | 2 | 1 | 5/7 — **71%** |
| 13.6 Dispatch Infrastructure | 0 | 3 | 2 | 1.5/5 — **30%** |
| **TOTAL** | **96** | **32** | **23** | **109/151 — ~72%** |

### 14.2 Priority mechanism gaps

These are missing **engine mechanisms**, not missing card implementations:

1. **Replacement effects / "instead"** — no broadcast-and-intercept system; Shield prevention is the only inline replacement. Affects §6 and §13.6.
2. **Play restriction system** — no `playRestrictions[]` on game state; "can't play" effects (e.g. Regional Governor) have no enforcement path. Affects §13.3.
3. **Negative power/HP modifiers** — `CurrentPower`/`TotalHP` don't handle minus values; "−2/−0" effects are silently ignored. Affects §7.
4. **Upgrade defeated trigger** — upgrades vanish silently when their unit leaves play; no When Defeated fires for upgrades themselves. Affects §10.
5. **When Unit is Attacked** — no defender-side trigger mechanism exists at all. Affects §6.
6. **Unpreventable / prevent damage** — no `unpreventable` flag on damage sources; no general "prevent X damage" interception path. Affects §13.1.
7. **Open vs. hidden information** — full `GameState` returned to both players; per-player state projection not implemented. Affects §13.5.
8. **"For Each" simultaneous effects** — no general multi-target effect framework; each "for each X do Y" must be hardcoded. Affects §13.2.
9. **Upgrade on enemy unit** — `UpgradeEligibleTargets` hardcoded to friendly only. Affects §10.
10. **choose-player dispatch** — `NeedsPlayer` resolution type exists but the handler is a stub. Affects §13.6.

### Recently Completed

### Recently Completed
- ✅ **Token set-aside rule (CR 7.6.1)** — `defeatUnit` already guards with `!unit.IsTokenUnit()` before calling `pushToDiscard`. Token upgrades (Shield, Experience) also disappear correctly when their unit leaves play. Tokens are infinitely available (no supply pool). Confirmed by `simple-token.test.ts`.
- ✅ **Deck search (CR 27)** — `DeckSearchPending` with `action: "play" | "draw"` and `costModifier`. Implemented for SOR_087 (Darth Vader), SOR_104 (U-Wing Reinforcement), SOR_123 (Recruit), TWI_193 (R2-D2 Full of Solutions). Unchosen cards returned to bottom in random order. TempIds are positional strings ("0", "1", …) — consumers echo choices from the response.
- ✅ **Indirect damage (CR 8.36)** — `ChooseIndirectTargetPending` (source picks which player assigns) → `IndirectDamagePending` (target player assigns among own units/base). Shields not removed per CR 8.36.2. Per-unit cap enforced per CR 8.36.3. Implemented for JTL_234 (Torpedo Barrage).
- ⚠️ **Disclose mechanic** — specific-card implementations for ISB Agent (SOR_176/SEC_184), Bardottan Ornithopter (SEC_062), Unauthorized Investigation (SEC_181), Charged with Treason (SEC_182). No general `NeedsReveal` dispatch type yet.


- ✅ **Boba Fett leader reaction (SHD_008)** — `"leader-reaction"` TriggerType added. `completePlayCard` injects trigger when a keyword unit is played and leader is ready + undeployed. `processSingleTrigger` returns `ability-option` (exhaust Y/N); `applyAbilityEffect` exhausts leader and pushes a Phase `+1/+0` effect. Participates in trigger-bag ordering (tested with Ambush).
- ✅ **Attack Pattern Delta (SOR_106)** — three-step mandatory ability-target chain via virtual card IDs `SOR_106_3/2/1`. Each step refreshes `fromPlayIds` to exclude already-chosen units. Phase effects grant +3/+3, +2/+2, +1/+1 tracked in `CurrentPower` and `TotalHP` loops. Fizzles gracefully when fewer than 3 friendly units exist.
- ✅ **Trigger ordering** — `drainTriggerBag` returns `TriggerOrderPending` when 2+ triggers queue simultaneously. Resolved as `NeedsOption` via `handleChooseOption` with "Choose which trigger to resolve first:" prompt.
- ✅ **ECL Epic Action** — leader epic action for ECL (specific card) implemented.
- ✅ **Smuggle** — `play-smuggle` dispatch: cost + aspect penalty, ready-resource exhaustion, deck-top replacement (exhausted). `ResourceIsSmuggleable` UI affordability check. UI highlights eligible resources.
- ✅ **Plot** — `PlotWindowPending` / `PlotOrderPending` chain on leader deploy. Affordability filter (cost + aspect penalty). Multi-Plot looping after each card played. CR 19d enforced: deck replacement card excluded from window. `NeedsPlot` UI type shows card-art popup with Pass button. Plot timing (before/after When Deployed) handled via `PlotOrderPending`.
- ✅ **When Deployed (Qi'ra SHD_002)** — `resolveWhenDeployed` wired into `deployLeader` and the Plot chain. Heals all units, then deals `floor(HP/2)` to each; Shield token absorbs damage. Tested: space arena, self-damage, Grit interaction, Plot ordering scenarios, CR 19d.
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
- ✅ **Piloting** — full play-as-PILOT-upgrade dispatch path: `PilotingOptionPending` prompt, `PilotingEligibleVehicles` Vehicle+slot filtering, special cases for Millennium Falcon / R2-D2 / Poe Dameron, and leader pilot deploy via `LeaderDeployPilotThreshold` (condition-only, no resource spend).
