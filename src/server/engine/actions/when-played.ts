import { PlayerId } from "@/lib/engine/core-models";
import { AllCaptives, AllGroundUnits, AllSpaceUnits, AllUnits, CanDisclose, DealDamageToBase, GetGame, GetUnitByPlayId, GetUnitsForPlayer, GetPlayer, TraitContains, CardIsLeader, chooseAndDefeatUnit, mandatoryTarget, optionalTarget, searchDeck, buildVaneeAbility, buildTakeControlOfUpgrade, PlayerHasUnitWithTraitInPlay, PlayerHasUnitWithAspectInPlay, HasTheForce, HealBaseForPlayer, UseTheForce, DefeatableUpgradePlayIds, UnitHasWhenDefeatedAbility, PlayerHasAspectInDiscard, FindUpgradeByPlayId, ReadyUnitByPlayId, LAWBRINGER_ASPECTS, UnitImmuneToEnemyAbilities, DealDamageToUnit, CanUnitAttack } from "@/server/engine/core-functions";
import { aspectPenalty, spendableFor } from "@/server/engine/card-playability";
import { chooseFriendlyForPowerDamage } from "@/server/engine/actions/deal-power-damage";
import { IsTokenUpgrade, PilotlessVehiclePlayIds } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { PendingResolution, ChooseOnePending, AbilityOptionPending, AbilityTargetPending, ReturnFromDiscardPending, SpreadDamagePending, SpreadTokensPending, SpreadHealPending, GiveXpMultiplePending, ChooseIndirectTargetPending, PeekHandPending, RevealFromHandPending, DiscardFromHandPending, RevealDiscardPending, ChooseAspectEffectPending } from "@/server/engine/pending-resolution";
import { Unit } from "@/server/engine/unit";
import { CreateBattleDroid, CreateCloneTrooper, CreateXWing, CreateSpy, CreateCreditToken, CreateMandalorianToken, GiveAdvantageTokens } from "@/server/engine/token-helpers";
import { AllCardTitles, CardTitle, CardType, CardCost, CardAspects, CardTraits, CardIsUnique } from "@/server/engine/card-db/generated";

/**
 * One of LOF_070 Anakin's two "you may give a unit -3/-3 for this phase" abilities.
 * `continuation` chains the other one after it when both are live.
 */
export function anakinMortisAbility(
  which: "heroism" | "villainy",
  player: PlayerId,
  continuation: PendingResolution | null,
): PendingResolution | null {
  const units = AllUnits();
  if (units.length === 0) return continuation;
  const aspect = which === "heroism" ? "Heroism" : "Villainy";
  return optionalTarget(`LOF_070_${which}`, player, units.map(u => u.playId),
    `${aspect} card in your discard: give a unit -3/-3 for this phase?`,
    { continuation });
}

/** Returns playIds for all units on both sides plus both base identifiers. */
function allUnitsAndBasesPlayIds(): string[] {
  return [
    ...GetUnitsForPlayer(1).map(u => u.playId),
    ...GetUnitsForPlayer(2).map(u => u.playId),
    "player1.base",
    "player2.base",
  ];
}

// ---------------------------------------------------------------------------
// LOF_079 Shatterpoint — "Choose one:
//   Defeat a non-leader unit with 3 or less remaining HP.
//   Use the Force (lose your Force token). If you do, defeat a non-leader unit."
// The two modes are built here because both the initial "Choose one" prompt and the
// single-live-mode shortcut need them.
// ---------------------------------------------------------------------------

/** Non-leader units the mode-A clause can reach (3 or less REMAINING HP). */
export function shatterpointLowHpTargets(): Unit[] {
  return AllUnits().filter(u => {
    const unit = Unit.FromInterface(u);
    return !unit.IsLeader() && unit.CurrentHP() <= 3;
  });
}

/** Every non-leader unit — what mode B can reach once the Force is spent. */
export function shatterpointAnyTargets(): Unit[] {
  return AllUnits().filter(u => !Unit.FromInterface(u).IsLeader());
}

/** Mode A: defeat a non-leader unit with 3 or less remaining HP. No cost. */
export function shatterpointModeA(cardId: string, player: PlayerId): PendingResolution | null {
  const targets = shatterpointLowHpTargets();
  if (targets.length === 0) return null;
  return mandatoryTarget(cardId, player, targets.map(u => u.playId));
}

/**
 * Mode B: Use the Force, then defeat any non-leader unit. The Force is spent up front —
 * "If you do" gates the defeat on the token actually being there.
 */
export function shatterpointModeB(
  cardId: string,
  player: PlayerId,
  gameLog: string[],
): PendingResolution | null {
  const targets = shatterpointAnyTargets();
  if (targets.length === 0) return null;
  if (!UseTheForce(player, gameLog, cardId)) return null; // no Force token → no defeat
  return mandatoryTarget(cardId, player, targets.map(u => u.playId));
}

/**
 * When Played abilities for unit cards.
 * Return a PendingResolution if further input is needed, or null to auto-resolve.
 */
export function resolveWhenPlayed(
  cardId: string,
  player: PlayerId,
  playId?: string,
): PendingResolution | null {
  const game = GetGame();
  if (!game) throw new Error("Game not found in resolveWhenPlayedAbility");
  switch (cardId) {
    case "LOF_082": // Vaneé — When Played/On Attack: may defeat an XP token on a friendly unit, then give one to a friendly unit.
      return buildVaneeAbility(player, null);
    case "ASH_132": { // Queen Soruna — When Played/On Attack: may reveal a unit from hand; if you
                      // do, deal 3 damage to a unit with the same cost as the revealed unit.
      const pStateQueen = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      if (!pStateQueen.hand.some(c => CardType(c.cardId) === "Unit")) return null;
      return {
        type: "ability-option",
        cardId: "ASH_132",
        sourcePlayId: playId,
        helperText: "Reveal a unit from your hand to deal 3 damage to a unit with the same cost?",
        yesLabel: "Reveal",
        noLabel: "Skip",
        onYes: {
          type: "play-from-hand",
          cardId: "ASH_132",
          player,
        },
        continuation: null,
      };
    }
    case "ASH_235": { // Sense Through the Force (Event) — "Choose a number, then search the top 5
                      // cards of your deck for a card, reveal it, and draw it. If its cost is the
                      // chosen number, you may give 3 Advantage tokens to a Force unit."
                      // The number is picked first, as an Option prompt over the printable costs.
      return {
        type: "choose-one",
        cardId: "ASH_235",
        player,
        options: Array.from({ length: 9 }, (_, n) => ({ id: String(n), label: String(n) })),
        continuation: null,
      } satisfies ChooseOnePending;
    }
    case "ASH_186": { // Treacherous Minefield (Event) — "Choose an arena. For this phase, each unit
                      // in that arena gains: 'On Attack: Deal 2 damage to this unit.'"
                      // The chosen arena rides on the effect's `value` (0 = Ground, 1 = Space).
      return {
        type: "choose-one",
        cardId: "ASH_186",
        player,
        options: [
          { id: "ground", label: "Ground arena" },
          { id: "space", label: "Space arena" },
        ],
        continuation: null,
      } satisfies ChooseOnePending;
    }
    case "ASH_184": { // Follow Me (Event) — "Attack with a unit. After completing the attack, give
                      // 3 Advantage tokens to a unit."
      const attackers184 = GetUnitsForPlayer(player, true).filter(u => CanUnitAttack(u));
      if (attackers184.length === 0) return null;
      return mandatoryTarget("ASH_184", player, attackers184.map(u => u.playId));
    }
    case "ASH_234": { // Masterstroke (Event) — "Attack with a unit. It gets +1/+0 for this attack
                      // for each unit the defending player controls in its arena."
      const attackers234 = GetUnitsForPlayer(player, true).filter(u => CanUnitAttack(u));
      if (attackers234.length === 0) return null;
      return mandatoryTarget("ASH_234", player, attackers234.map(u => u.playId));
    }
    case "ASH_257": { // Choose Your Path (Event) — "Choose one: If you control a Force unit, heal 5
                      // damage from your base. / If you control a Mandalorian unit, create a
                      // Mandalorian token and give an Advantage token to it."
                      // Each mode is offered only while its condition holds.
      const options257: { id: string; label: string }[] = [];
      if (PlayerHasUnitWithTraitInPlay(player, "Force")) {
        options257.push({ id: "heal", label: "Heal 5 damage from your base" });
      }
      if (PlayerHasUnitWithTraitInPlay(player, "Mandalorian")) {
        options257.push({ id: "mandalorian", label: "Create a Mandalorian token with an Advantage token" });
      }
      if (options257.length === 0) return null;
      return {
        type: "choose-one",
        cardId: "ASH_257",
        player,
        options: options257,
        continuation: null,
      } satisfies ChooseOnePending;
    }
    case "ASH_247": { // One Must Destroy to Create (Event) — "Defeat a friendly non-leader unit.
                      // Then, you may play that unit from your discard pile for free."
      const friendly247 = GetUnitsForPlayer(player).filter(u => !CardIsLeader(u.cardId));
      if (friendly247.length === 0) return null;
      return mandatoryTarget("ASH_247", player, friendly247.map(u => u.playId));
    }
    case "ASH_211": { // Fateful Goodbye (Event) — "If a friendly unit left play this phase,
                      // distribute 3 Advantage tokens among friendly units. If a friendly leader
                      // unit left play this phase, distribute 5 Advantage tokens instead."
      const gs211 = game.currentGameState;
      const left211 = gs211.roundState.cardsLeftPlayThisPhase.filter(c => c.fromPlayer === player);
      if (left211.length === 0) return null;
      const total211 = left211.some(c => CardIsLeader(c.cardId)) ? 5 : 3;
      const friendly211 = GetUnitsForPlayer(player);
      if (friendly211.length === 0) return null; // nothing left to receive the tokens
      return {
        type: "spread-tokens",
        cardId: "ASH_211",
        player,
        totalTokens: total211,
        optional: false,
        eligiblePlayIds: friendly211.map(u => u.playId),
        continuation: null,
      } satisfies SpreadTokensPending;
    }
    case "ASH_232": { // Full of Surprises (Event) — "Return an upgrade that costs 2 or less to its
                      // owner's hand." + "Give a Shield token to a unit." Two independent mandatory
                      // clauses: each is skipped only when it has no legal target.
      const cheapUpgrades232 = AllUnits().flatMap(u =>
        u.upgrades
          .filter(upg => !IsTokenUpgrade(upg.cardId) && (CardCost(upg.cardId) ?? 0) <= 2)
          .map(upg => upg.playId),
      );
      const units232 = AllUnits();
      const shieldStep232 = units232.length > 0
        ? mandatoryTarget("ASH_232_shield", player, units232.map(u => u.playId))
        : null;
      if (cheapUpgrades232.length === 0) return shieldStep232;
      return mandatoryTarget("ASH_232_upgrade", player, cheapUpgrades232, shieldStep232);
    }
    case "ASH_200": { // Rehabilitation (Event) — "Choose a non-leader unit. Give that unit –3/–0 for
                      // this phase, then take control of it. At the start of the regroup phase, its
                      // owner takes control of it."
      const nonLeaders200 = AllUnits().filter(u => !CardIsLeader(u.cardId));
      if (nonLeaders200.length === 0) return null;
      return mandatoryTarget("ASH_200", player, nonLeaders200.map(u => u.playId));
    }
    case "ASH_231": { // Diplomatic Pageantry (Event) — "Exhaust a friendly unit and an enemy unit.
                      // If you do, give 2 Advantage tokens to that friendly unit." Both halves are
                      // required, so the whole event fizzles unless each side has a unit.
      const friendly231 = GetUnitsForPlayer(player);
      const enemy231 = GetUnitsForPlayer(player === 1 ? 2 : 1);
      if (friendly231.length === 0 || enemy231.length === 0) return null;
      return mandatoryTarget("ASH_231_friendly", player, friendly231.map(u => u.playId));
    }
    case "ASH_236": { // Far Far Away (Event) — "Return a friendly non-leader unit to its owner's
                      // hand. If you do, return an enemy non-leader unit to its owner's hand."
      const friendly236 = GetUnitsForPlayer(player).filter(u => !CardIsLeader(u.cardId));
      if (friendly236.length === 0) return null;
      return mandatoryTarget("ASH_236_friendly", player, friendly236.map(u => u.playId));
    }
    case "ASH_163": { // Reckless Sacrifice (Event) — "Discard a unit from your hand. Deal 5 damage
                      // to a unit that costs more than the discarded card." The legal targets
                      // depend on which unit was discarded, so they are computed in the handler.
      const hand163 = GetPlayer(game.currentGameState, player).hand;
      if (!hand163.some(c => CardType(c.cardId) === "Unit")) return null;
      return { type: "play-from-hand", cardId: "ASH_163", player };
    }
    case "ASH_187": { // Reckoning (Event) — "Deal damage to a unit equal to the total amount of
                      // damage on all units you control." The amount is read when the target
                      // resolves, so a unit dying in between cannot inflate it.
      const allUnits187 = AllUnits();
      if (allUnits187.length === 0) return null;
      return mandatoryTarget("ASH_187", player, allUnits187.map(u => u.playId));
    }
    case "ASH_146": { // Justifier — When Played/On Attack: may deal 1 damage to a unit; if
                      // defeated this way, give an Advantage token to a unit.
      const allUnits146 = AllUnits();
      if (allUnits146.length === 0) return null;
      return optionalTarget("ASH_146", player, allUnits146.map(u => u.playId),
        "Deal 1 damage to a unit?", { yesLabel: "Deal 1" });
    }
    case "ASH_174": { // StarFortress Heavy Bomber — When Played: may deal 6 damage to a non-unique ground unit.
      const nonUniqueGround174 = AllGroundUnits().filter(u => !CardIsUnique(u.cardId));
      if (nonUniqueGround174.length === 0) return null;
      return optionalTarget("ASH_174", player, nonUniqueGround174.map(u => u.playId),
        "Deal 6 damage to a non-unique ground unit?", { yesLabel: "Deal 6" });
    }
    case "ASH_171": { // Pegasus Tri-Wing — may defeat a friendly upgrade; if you do, ready this unit.
      const friendlyUpgrades171 = GetUnitsForPlayer(player).flatMap(u => u.upgrades.map(upg => upg.playId));
      if (friendlyUpgrades171.length === 0) return null;
      return {
        type: "ability-option",
        cardId: "ASH_171",
        player,
        sourcePlayId: playId,
        helperText: "Defeat a friendly upgrade to ready this unit?",
        yesLabel: "Defeat",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: "ASH_171",
          player,
          sourcePlayId: playId,
          fromPlayIds: friendlyUpgrades171,
          continuation: null,
        } satisfies AbilityTargetPending,
        continuation: null,
      } satisfies AbilityOptionPending;
    }
    case "ASH_170": { // Desert Sharpshooter — When Played: may deal 2 damage to an upgraded ground unit.
      const upgradedGround170 = AllGroundUnits().filter(u => u.upgrades.length > 0);
      if (upgradedGround170.length === 0) return null;
      return optionalTarget("ASH_170", player, upgradedGround170.map(u => u.playId),
        "Deal 2 damage to an upgraded ground unit?", { yesLabel: "Deal 2" });
    }
    case "ASH_167": { // Flarestar Attack Shuttle — When Played/When Defeated: may give an Advantage token to a unit.
      const allUnits167 = AllUnits();
      if (allUnits167.length === 0) return null;
      return optionalTarget("ASH_167", player, allUnits167.map(u => u.playId),
        "Give an Advantage token to a unit?", { yesLabel: "Give token" });
    }
    case "ASH_158": { // Han Solo — deal 3 damage to this unit, then give 3 Advantage tokens to a unit.
      const self158 = playId ? GetUnitByPlayId(game.currentGameState, playId) : undefined;
      if (self158) DealDamageToUnit(game.currentGameState, "ASH_158", self158.playId, 3, game.gameLog);
      const allUnits158 = AllUnits();
      if (allUnits158.length === 0) return null;
      return mandatoryTarget("ASH_158", player, allUnits158.map(u => u.playId));
    }
    case "JTL_248": { // Dilapidated Ski Speeder — "When Played: Deal 3 damage to this unit."
      const self248 = playId ? GetUnitByPlayId(game.currentGameState, playId) : undefined;
      if (self248) DealDamageToUnit(game.currentGameState, "JTL_248", self248.playId, 3, game.gameLog);
      return null; // 7 HP, so it survives — no sweep needed.
    }
    case "ASH_147": { // The Cyborg Mech — deal 2 damage to an undamaged ground unit, or 5 to a
                      // damaged ground unit. (Amount is decided by the chosen target's state.)
      const groundUnits147 = AllGroundUnits();
      if (groundUnits147.length === 0) return null;
      return mandatoryTarget("ASH_147", player, groundUnits147.map(u => u.playId));
    }
    case "ASH_188": { // Galvanized Leap — "Ready a unit that was damaged this phase."
      const damaged188 = (game.currentGameState.roundState.unitsDamagedThisPhase ?? [])
        .filter(pid => AllUnits().some(u => u.playId === pid));
      if (damaged188.length === 0) return null;
      return mandatoryTarget("ASH_188", player, damaged188);
    }
    case "JTL_242": // Shuttle ST-149 — When Played/When Defeated: may take control of a token upgrade and attach it to a different eligible unit.
      return buildTakeControlOfUpgrade("JTL_242", player,
        upg => IsTokenUpgrade(upg.cardId),
        "Take control of a token upgrade and attach it to a different eligible unit?", null);
    case "SOR_042": // Search Your Feelings — Search your deck for a card and draw it. (Then, shuffle your deck.)
      return searchDeck(cardId, player, -1, "draw", { maxChoices: 1, dontReveal: true });
    case "SOR_119": { // Reinforcement Walker — look at top card, draw it (Yes) or discard + heal 3 (No).
      const gs119 = game.currentGameState;
      const deck119 = player === 1 ? gs119.player1.deck : gs119.player2.deck;
      if (deck119.length === 0) return null;
      const topCard = deck119[deck119.length - 1];
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: `Draw ${CardTitle(topCard.cardId)}? Or discard it and heal 3 from your base.`,
        yesLabel: "Draw",
        noLabel: "Discard + Heal 3",
        onYes: null,
        continuation: null,
      };
    }
    case "SOR_084": // Grand Moff Tarkin — Search top 5 for up to 2 Imperial cards, reveal and draw.
      return searchDeck(cardId, player, 5, "draw", { filter: { trait: "Imperial" }, maxChoices: 2 });
    case "SOR_091": { // The Emperor's Legion — Return each unit defeated this phase from discard to hand.
      const gs091 = game.currentGameState;
      const pState091 = player === 1 ? gs091.player1 : gs091.player2;
      const defeatedPlayIds = new Set(
        gs091.roundState.cardsLeftPlayThisPhase
          .filter(c => c.fromPlayer === player && (c.reason === "defeated" || c.reason === "token-defeated"))
          .map(c => c.playId)
      );
      const toReturn = pState091.discard.filter(d => defeatedPlayIds.has(d.playId) && CardType(d.cardId) === "Unit");
      for (const card of toReturn) {
        pState091.hand.push({ cardId: card.cardId });
        const idx = pState091.discard.findIndex(d => d.playId === card.playId);
        if (idx >= 0) pState091.discard.splice(idx, 1);
        game.gameLog.push(`${CardTitle(cardId)}: returned ${CardTitle(card.cardId)} to hand.`);
      }
      return null;
    }
    case "SOR_096": // Mon Mothma — Search top 5 for a Rebel card, reveal and draw.
      return searchDeck(cardId, player, 5, "draw", { filter: { trait: "Rebel" }, maxChoices: 1 });
    case "SOR_055": { // The Force Is With Me — Choose a friendly unit; give 2 XP; if Force unit in play, give Shield; may attack.
      const friendlies055 = GetUnitsForPlayer(player).map(u => u.playId);
      if (friendlies055.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: friendlies055,
        continuation: null,
      };
    }
    case "SOR_041": // Power of the Dark Side — opponent chooses any unit they control to defeat (leaders included).
      return chooseAndDefeatUnit(cardId, player, true);
    case "SOR_040": // Avenger When Played — opponent chooses a non-leader unit they control to defeat.
      return chooseAndDefeatUnit(cardId, player, false);
    case "SOR_052": // Redemption — Heal up to 8 total damage from any units/bases; deal that much to self.
      if (!playId) return null;
      return {
        type: "spread-heal",
        cardId,
        player,
        maxHeal: 8,
        eligiblePlayIds: allUnitsAndBasesPlayIds(),
        afterHeal: { type: "deal-healed-to-self", targetPlayId: playId },
        continuation: null,
      } satisfies SpreadHealPending;
    case "LOF_037": { // Darth Vader — "When Played: Give a Shield token to a friendly unit and to an
                      // enemy unit." Two mandatory steps: friendly first, then enemy.
      const friendly037 = GetUnitsForPlayer(player);
      const enemy037 = GetUnitsForPlayer(player === 1 ? 2 : 1);
      if (friendly037.length === 0 || enemy037.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "LOF_037",
        player,
        fromPlayIds: friendly037.map(u => u.playId),
        continuation: {
          type: "ability-target",
          cardId: "LOF_037",
          player,
          fromPlayIds: enemy037.map(u => u.playId),
          continuation: null,
        },
      };
    }
    case "SOR_033": //Death Trooper "Deal 2 damage to a friendly ground unit and 2 damage to an enemy ground unit."
    case "SEC_030": {// reprint of SOR_033
      const friendlyGround = player === 1 ? game.currentGameState.player1.groundArena : game.currentGameState.player2.groundArena;
      const enemyGround = player === 1 ? game.currentGameState.player2.groundArena : game.currentGameState.player1.groundArena;
      if (friendlyGround.length === 0 || enemyGround.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: friendlyGround.map(u => u.playId),
        continuation: {
          type: "ability-target",
          cardId,
          player,
          fromPlayIds: enemyGround.map(u => u.playId),
          continuation: null,
        },
      };
    }
    case "SOR_227": // Snowtrooper Lieutenant — You may attack with a unit. If Imperial, gets +2/+0 for this attack.
    case "SHD_236": {
      const readyFriendly = GetUnitsForPlayer(player, true).map(u => u.playId);
      if (readyFriendly.length === 0) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Attack with a unit? Imperial units get +2/+0.",
        yesLabel: "Attack",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId,
          player,
          fromPlayIds: readyFriendly,
          continuation: null,
        },
        continuation: null,
      };
    }
    case "JTL_261": { // Attack Run — "Attack with 2 space units (one at a time)."
      const spacePlayIds261 = AllSpaceUnits()
        .filter(u => u.controller === player && u.ready)
        .map(u => u.playId);
      if (spacePlayIds261.length === 0) return null; // no ready friendly space unit — soft pass
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: spacePlayIds261,
        continuation: {
          type: "ability-target",
          cardId,
          player,
          fromPlayIds: spacePlayIds261,
          continuation: null,
        },
      };
    }
    case "SOR_103": { //Rebel Assault "Attack with a Rebel unit. It gets +1/+0 for this attack. Then, attack with another Rebel unit. It gets +1/+0 for this attack."
      const rebelPlayIds = GetUnitsForPlayer(player, true).filter((u) =>
        TraitContains(u.cardId, "Rebel", u.controller, u.playId)).map((u) => u.playId);
      if (rebelPlayIds.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        fromPlayIds: rebelPlayIds,
        continuation: {
          type: "ability-target",
          cardId,
          fromPlayIds: rebelPlayIds,
          continuation: null,
        }
      };
    }
    case "JTL_170": { // War Juggernaut — "When Played: Deal 1 damage to each of any number of units."
      const allUnits170 = AllUnits();
      if (allUnits170.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "JTL_170",
        player,
        fromPlayIds: allUnits170.map(u => u.playId),
        needsMultiple: true,
        maxTargets: allUnits170.length,
        continuation: null,
      };
    }
    case "JTL_140": { // IG-2000 — "When Played: Deal 1 damage to each of up to 3 units."
      const allUnits140 = AllUnits();
      if (allUnits140.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "JTL_140",
        player,
        fromPlayIds: allUnits140.map(u => u.playId),
        needsMultiple: true,
        maxTargets: 3,
        continuation: null,
      };
    }
    case "LAW_101": { // Lawbringer — "When Played/On Attack: Choose an aspect. Give each enemy unit
                      // with that aspect –2/–2 for this phase." (The On Attack side is in on-attack.ts.)
      return {
        type: "ability-target",
        cardId: "LAW_101",
        player,
        fromPlayIds: [],
        fromChoices: LAWBRINGER_ASPECTS,
        continuation: null,
      };
    }
    case "SHD_129": {//Timely Intervention: Play a unit from your hand. Give it Ambush for this phase.
      const game129 = GetGame();
      if (!game129) throw new Error("Game not found in SHD_129 resolution.");
      const playerHand = player === 1 ? game129.currentGameState.player1.hand : game129.currentGameState.player2.hand;
      const handUnits = playerHand.filter(c => CardType(c.cardId) === "Unit");
      if (handUnits.length === 0) return null;
      return {
        type: "play-from-hand",
        cardId,
        player,
      };
    }
    case "LOF_220": {//Shien Flurry: Play a Force unit from your hand. It gains Ambush this phase; prevent 2 of the next damage to it.
      const game220 = GetGame();
      if (!game220) throw new Error("Game not found in LOF_220 resolution.");
      const hand220 = player === 1 ? game220.currentGameState.player1.hand : game220.currentGameState.player2.hand;
      const forceUnits = hand220.filter(c => CardType(c.cardId) === "Unit" && CardTraits(c.cardId).includes("Force"));
      if (forceUnits.length === 0) return null;
      return {
        type: "play-from-hand",
        cardId,
        player,
      };
    }
    case "SOR_162": //Disabling Fang Fighter: You may defeat an upgrade.
    case "SHD_166": //reprint of SOR_162
      if (!playId && !player) return null;
      const allUpgradePlayIds162 = AllUnits().flatMap(u => u.upgrades.map(upg => upg.playId));
      if (allUpgradePlayIds162.length === 0) return null;
      return optionalTarget(cardId, player, allUpgradePlayIds162,
        "Defeat an upgrade?", { yesLabel: "Defeat", sourcePlayId: playId });
    case "SOR_168": //Precision Fire "Attack with a unit. It gains Saboteur for this attack. If it's a Trooper, it also gets +2/+0 for this attack. (Ignore Sentinel and defeat the defender's Shields.)"
      return {
        type: "ability-target",
        cardId,
        fromPlayIds: GetUnitsForPlayer(player, true).map((u) => u.playId),
        continuation: null,
      }
    case "TWI_224": //Breaking In "Attack with a unit. It gets +2/+0 and gains Saboteur for this attack. (Ignore Sentinel and defeat the defender's Shields.)"
      return {
        type: "ability-target",
        cardId,
        fromPlayIds: GetUnitsForPlayer(player, true).map((u) => u.playId),
        continuation: null,
      }
    case "ASH_115": { //The Student Guides the Master "Give a friendly unit +1/+0 for this phase for each other friendly unit with less power than it."
      const friendly115 = GetUnitsForPlayer(player).map(u => u.playId);
      if (friendly115.length === 0) return null;
      return mandatoryTarget(cardId, player, friendly115);
    }
    case "ASH_139": { //Hold Them Off "Choose a friendly unit. That unit deals damage equal to its power divided as you choose among any number of units in its arena."
      const friendly139 = GetUnitsForPlayer(player).map(u => u.playId);
      if (friendly139.length === 0) return null;
      return mandatoryTarget(cardId, player, friendly139);
    }
    case "ASH_137": //Wipe Them Out "Attack with a unit. For this attack, you may deal its excess damage to another unit in the same arena."
      return {
        type: "ability-target",
        cardId,
        fromPlayIds: GetUnitsForPlayer(player, true).map((u) => u.playId),
        continuation: null,
      }
    case "JTL_231": { // Punch It — "Attack with a Vehicle unit. It gets +2/+0 for this attack."
      const vehiclePlayIds = GetUnitsForPlayer(player, true)
        .filter(u => TraitContains(u.cardId, "Vehicle", u.controller, u.playId))
        .map(u => u.playId);
      if (vehiclePlayIds.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        fromPlayIds: vehiclePlayIds,
        continuation: null,
      };
    }
    case "TS26_058": { // Backed by the Pykes — "Give an Experience token to a friendly unit.
                       // You may deal damage to a unit equal to the number of Experience tokens on friendly units."
      const friendly058 = GetUnitsForPlayer(player);
      if (friendly058.length === 0) return null; // no friendly unit to receive the token — nothing to do
      // Step 1 (mandatory): choose the friendly unit to give an Experience token to.
      // Step 2 (optional damage) is built after the token lands, in applyAbilityEffect.
      return mandatoryTarget("TS26_058", player, friendly058.map(u => u.playId));
    }
    case "JTL_153": //Rebellious Hammerhead "When Played: You may deal damage to a unit equal to the number of cards in your hand."
      if (!playId && !player) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Deal damage to a unit equal to the number of cards in your hand?",
        yesLabel: "Deal Damage",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId,
          sourcePlayId: playId!,
          fromPlayIds: AllUnits().map(u => u.playId),
          continuation: null,
        },
        continuation: null,
      };
    case "JTL_102": { // Resistance Blue Squadron — "When Played: You may deal damage to a unit equal
                      // to the number of friendly space units." Blue Squadron is already in play, so
                      // it counts itself. The count is read live at resolution (applyAbilityEffect).
      const allUnits102 = AllUnits();
      if (allUnits102.length === 0) return null; // nothing to damage
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Deal damage to a unit equal to the number of friendly space units?",
        yesLabel: "Deal Damage",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId,
          sourcePlayId: playId,
          fromPlayIds: allUnits102.map(u => u.playId),
          continuation: null,
        },
        continuation: null,
      };
    }
    case "JTL_206": { // Fly Casual — "Ready a Vehicle unit. It can't attack bases for this phase."
      const vehicles206 = GetUnitsForPlayer(player).filter(u => TraitContains(u.cardId, "Vehicle", player, u.playId));
      if (vehicles206.length === 0) return null;
      return mandatoryTarget(cardId, player, vehicles206.map(u => u.playId));
    }
    case "LAW_045": { // Zeb Orellios — When Played: You may deal 3 damage to a ground unit (5 if you control a Command or Cunning unit).
      const groundUnits045 = AllGroundUnits();
      if (groundUnits045.length === 0) return null;
      const amount045 = (PlayerHasUnitWithAspectInPlay(player, "Command") || PlayerHasUnitWithAspectInPlay(player, "Cunning")) ? 5 : 3;
      return optionalTarget(cardId, player, groundUnits045.map(u => u.playId),
        `Deal ${amount045} damage to a ground unit?`);
    }
    case "LAW_233": { // Galen Erso — "When Played: You may have an opponent take control of this unit."
      if (!playId) return null;
      return {
        type: "ability-option",
        cardId,
        player,
        sourcePlayId: playId,
        helperText: "Have an opponent take control of Galen Erso?",
        yesLabel: "Give to Opponent",
        noLabel: "Keep",
        onYes: null,
        continuation: null,
      };
    }
    case "LAW_244": // Unmarked Credits — "Create a Credit token."
      CreateCreditToken(game.currentGameState, player, game.gameLog, cardId);
      return null;
    case "LAW_247": { // Backed by the Hutts — "Create a Credit token. You may deal damage to a unit equal to the number of friendly Credit tokens."
      CreateCreditToken(game.currentGameState, player, game.gameLog, cardId);
      const units247 = AllUnits();
      if (units247.length === 0) return null;
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: "Deal damage to a unit equal to the number of friendly Credit tokens?",
        yesLabel: "Deal Damage",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId,
          player,
          fromPlayIds: units247.map(u => u.playId),
          continuation: null,
        },
        continuation: null,
      };
    }
    case "IBH_064": // Hoth Lieutenant — "When Played: You may attack with another unit. It gets +2/+0
    case "IBH_092": { // for this attack." Optional; the +2/+0 and the attack are applied in applyAbilityEffect.
      const readyOthers064 = GetUnitsForPlayer(player).filter(u => u.ready && u.playId !== playId);
      if (readyOthers064.length === 0) return null;
      return optionalTarget(cardId, player, readyOthers064.map(u => u.playId),
        "Attack with another unit? It gets +2/+0 for this attack.", { yesLabel: "Attack" });
    }
    case "IBH_068": // General Veers — "When Played: If you control a Vigilance unit, deal 2 damage to an
    case "IBH_088": { // enemy base and heal 2 damage from your base." Mandatory + conditional, no target.
      const game068 = GetGame();
      if (!game068) return null;
      if (!PlayerHasUnitWithAspectInPlay(player, "Vigilance")) return null; // soft pass — no Vigilance unit
      const opponent068 = player === 1 ? 2 : 1;
      DealDamageToBase(game068.currentGameState, opponent068, 2, player);
      game068.gameLog.push(`${CardTitle(cardId)}: dealt 2 damage to player ${opponent068}'s base.`);
      HealBaseForPlayer(game068.currentGameState, player, 2, game068.gameLog, cardId);
      return null;
    }
    case "IBH_099": { // Blizzard One — "When Played: You may defeat a non-leader ground unit with 3 or
                      // less remaining HP."
      const targets099 = AllGroundUnits().filter(u => {
        const unit = Unit.FromInterface(u);
        return !unit.IsLeader() && unit.CurrentHP() <= 3;
      });
      if (targets099.length === 0) return null;
      return optionalTarget("IBH_099", player, targets099.map(u => u.playId),
        "Defeat a non-leader ground unit with 3 or less remaining HP?", { yesLabel: "Defeat" });
    }
    case "SEC_034": { // Cad Bane — "When Played: You may defeat a unit with 2 or less remaining HP."
      const eligible034 = AllUnits().filter(u => Unit.FromInterface(u).CurrentHP() <= 2);
      if (eligible034.length === 0) return null;
      return mandatoryTarget(cardId, player, eligible034.map(u => u.playId));
    }
    case "SHD_054": { // Midnight Repairs — Heal up to 8 total damage from any number of units. (No rebound, no bases.)
      const allUnits054 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)].map(u => u.playId);
      return {
        type: "spread-heal",
        cardId,
        player,
        maxHeal: 8,
        eligiblePlayIds: allUnits054,
        continuation: null,
      } satisfies SpreadHealPending;
    }
    case "SHD_160": //Reckless Gunslinger "When Played: Deal 1 damage to each base."
      return null;
    case "TWI_237": { // Droid Deployment — "Create 2 Battle Droid tokens."
      const gs237 = game.currentGameState;
      CreateBattleDroid(gs237, player, game.gameLog, cardId);
      CreateBattleDroid(gs237, player, game.gameLog, cardId);
      return null;
    }
    case "TWI_251": { // Drop In — "Create 2 Clone Trooper tokens."
      const gs251 = game.currentGameState;
      CreateCloneTrooper(gs251, player, game.gameLog, cardId);
      CreateCloneTrooper(gs251, player, game.gameLog, cardId);
      return null;
    }
    case "JTL_254": { // Dedicated Wingmen — "Create 2 X-Wing tokens."
      const gs254 = game.currentGameState;
      CreateXWing(gs254, player, game.gameLog, cardId);
      CreateXWing(gs254, player, game.gameLog, cardId);
      return null;
    }
    case "ASH_140": { // Stronger Together — "Create 2 Mandalorian tokens."
      const gs140 = game.currentGameState;
      CreateMandalorianToken(gs140, player, game.gameLog, cardId);
      CreateMandalorianToken(gs140, player, game.gameLog, cardId);
      return null;
    }
    case "ASH_226": { // Qi'ra (Master of Teräs Käsi) — "When Played: You may discard a card from
                      // your hand. If you do, deal 3 damage to a unit."
      const hand226 = GetPlayer(game.currentGameState, player).hand;
      const units226 = AllUnits();
      if (hand226.length === 0 || units226.length === 0) return null;
      // Discard first, then choose the damage target — the discard is what pays for the damage.
      const damage226: AbilityTargetPending = {
        type: "ability-target",
        cardId: "ASH_226",
        player,
        fromPlayIds: units226.map(u => u.playId),
        continuation: null,
      };
      return {
        type: "ability-option",
        cardId: "ASH_226",
        player,
        sourcePlayId: playId,
        helperText: "Discard a card from your hand to deal 3 damage to a unit?",
        yesLabel: "Discard",
        noLabel: "Skip",
        onYes: {
          type: "discard-from-hand",
          targetPlayer: player,
          count: 1,
          continuation: damage226,
        },
        continuation: null,
      };
    }
    case "ASH_238": { // Attendant Navigator — "When Played: You may give 2 Advantage tokens to a
                      // space unit." Any space unit, friendly or enemy.
      const spaceUnits238 = AllSpaceUnits();
      if (spaceUnits238.length === 0) return null;
      return optionalTarget("ASH_238", player, spaceUnits238.map(u => u.playId),
        "Give 2 Advantage tokens to a space unit?", { yesLabel: "Give 2", sourcePlayId: playId });
    }
    case "ASH_259": { // LEP Ratcatcher — "When Played: You may deal 1 damage to a ground unit."
      const groundUnits259 = AllGroundUnits();
      if (groundUnits259.length === 0) return null;
      return optionalTarget("ASH_259", player, groundUnits259.map(u => u.playId),
        "Deal 1 damage to a ground unit?", { yesLabel: "Deal 1", sourcePlayId: playId });
    }
    case "ASH_197": { // Executor — "When Played: Give an Advantage token to each other friendly unit."
      const gs197 = game.currentGameState;
      const friendly197 = GetUnitsForPlayer(player).filter(u => u.playId !== playId);
      for (const u of friendly197) {
        GiveAdvantageTokens(gs197, u, 1, game.gameLog, cardId);
      }
      return null;
    }
    case "ASH_176": { // Imposing Scout Walker — "When Played: You may deal 3 damage to a ground
                      // unit. If it's defeated this way, give 3 Advantage tokens to this unit."
      const groundUnits176 = AllGroundUnits();
      if (groundUnits176.length === 0) return null;
      return {
        type: "ability-option",
        cardId: "ASH_176",
        player,
        sourcePlayId: playId,
        helperText: "Deal 3 damage to a ground unit?",
        yesLabel: "Deal 3",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: "ASH_176",
          player,
          sourcePlayId: playId,
          fromPlayIds: groundUnits176.map(u => u.playId),
          continuation: null,
        } satisfies AbilityTargetPending,
        continuation: null,
      } satisfies AbilityOptionPending;
    }
    case "ASH_205": { // Inspiring Veteran — "When Played: Give an Advantage token to each of up
                      // to 3 exhausted units."
      const exhausted205 = AllUnits().filter(u => !u.ready);
      if (exhausted205.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "ASH_205",
        player,
        fromPlayIds: exhausted205.map(u => u.playId),
        needsMultiple: true,
        maxTargets: 3,
        continuation: null,
      };
    }
    case "ASH_092": { // Foundling Rescue — "You may defeat a unit with 2 or less remaining HP.
                      // Create a Mandalorian token."
      const gs092 = game.currentGameState;
      const eligible092 = AllUnits().filter(u => Unit.FromInterface(u).CurrentHP() <= 2);
      CreateMandalorianToken(gs092, player, game.gameLog, cardId);
      if (eligible092.length === 0) return null;
      return optionalTarget(cardId, player, eligible092.map(u => u.playId),
        "Defeat a unit with 2 or less remaining HP?");
    }
    case "SEC_082": // Chancellor Palpatine — When Played: handled in when-played-trigger.ts
    case "SEC_083": // ISB Shuttle — When Played: handled in when-played-trigger.ts
      return null;
    case "SEC_092": { // I Am the Senate — "Create 5 Spy tokens."
      for (let i = 0; i < 5; i++) CreateSpy(game.currentGameState, player, game.gameLog, cardId);
      return null;
    }
    case "SOR_073": { // Moment of Peace — "Give a Shield token to a unit."
      const allUnits073 = AllUnits();
      if (allUnits073.length === 0) return null;
      return mandatoryTarget(cardId, player, allUnits073.map(u => u.playId));
    }
    case "SOR_241": { // Wing Leader — "When Played: Give 2 Experience tokens to another friendly REBEL unit."
      const friendlyRebels241 = GetUnitsForPlayer(player, true)
        .filter(u => u.playId !== playId && TraitContains(u.cardId, "Rebel", u.controller, u.playId));
      if (friendlyRebels241.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        sourcePlayId: playId,
        fromPlayIds: friendlyRebels241.map(u => u.playId),
        continuation: null,
      };
    }
    case "TWI_128": { // Take Captive "A friendly unit captures an enemy non-leader unit in the same arena."
      const friendlyUnits = GetUnitsForPlayer(player, true);
      if (friendlyUnits.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: friendlyUnits.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_224": { // Change of Heart — "Take control of a non-leader unit."
      const allNonLeaders = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .filter(u => !CardIsLeader(u.cardId));
      if (allNonLeaders.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: allNonLeaders.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_222": // Waylay — "Return a non-leader unit to its owner's hand."
    case "TWI_226": { // reprint of SOR_222
      const allNonLeaders = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .filter(u => !CardIsLeader(u.cardId));
      if (allNonLeaders.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: allNonLeaders.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_176":
    case "SEC_184": { // ISB Agent — "When Played: You may reveal an event from your hand. If you do, deal 1 damage to a unit."
      const pStateIsb = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      const hasEvent = pStateIsb.hand.some(c => CardType(c.cardId) === "Event");
      if (!hasEvent) return null;
      const allUnitsIsb = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)];
      if (allUnitsIsb.length === 0) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Reveal an event from your hand to deal 1 damage to a unit?",
        yesLabel: "Reveal",
        noLabel: "Skip",
        onYes: {
          type: "play-from-hand",
          cardId,
          player,
        },
        continuation: null,
      };
    }
    case "SOR_252": { // Restock — "Choose up to 4 cards in a discard pile. Put them on the bottom of their owner's deck in a random order."
      const gs252 = game.currentGameState;
      const combined = [...gs252.player1.discard, ...gs252.player2.discard];
      if (combined.length === 0) return null;
      return {
        type: "return-from-discard",
        cardId: "SOR_252",
        player,
        maxCount: 4,
        eligiblePlayIds: combined.map(d => d.playId),
        continuation: null,
      } satisfies ReturnFromDiscardPending;
    }
    case "SEC_062": { // Bardottan Ornithopter — "When Played: You may disclose Vigilance. If you do, draw a card."
      if (!CanDisclose(player, ["Vigilance"])) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Disclose Vigilance to draw a card?",
        yesLabel: "Disclose",
        noLabel: "Skip",
        onYes: { type: "play-from-hand", cardId, player },
        continuation: null,
      };
    }
    case "SEC_181": { // Unauthorized Investigation — "Create a Spy token. You may disclose Aggression. If you do, create another Spy token."
      CreateSpy(game.currentGameState, player, game.gameLog, cardId);
      if (!CanDisclose(player, ["Aggression"])) return null;
      return {
        type: "ability-option",
        cardId,
        helperText: "Disclose Aggression to create another Spy token?",
        yesLabel: "Disclose",
        noLabel: "Skip",
        onYes: { type: "play-from-hand", cardId, player },
        continuation: null,
      };
    }
    case "SEC_182": { // Charged with Treason — "You may disclose AggressionAggression. If you do, deal 5 damage to a unit."
      if (!CanDisclose(player, ["Aggression", "Aggression"])) return null;
      return {
        type: "ability-option",
        cardId,
        helperText: "Disclose AggressionAggression to deal 5 damage to a unit?",
        yesLabel: "Disclose",
        noLabel: "Skip",
        onYes: { type: "play-from-hand", cardId, player },
        continuation: null,
      };
    }
    case "SOR_235": { // Galactic Ambition — "Play a non-Heroism unit from your hand for free. Deal damage to your base equal to its cost."
      const pState235 = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      const hasEligible235 = pState235.hand.some(c => CardType(c.cardId) === "Unit" && !CardAspects(c.cardId).includes("Heroism"));
      if (!hasEligible235) return null;
      return { type: "play-from-hand", cardId: "SOR_235", player };
    }
    case "SOR_219": { // Sneak Attack — "Play a unit from your hand. It costs 3 less and enters play ready. At the start of the regroup phase, defeat it."
      const pState219 = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      const hasUnit219 = pState219.hand.some(c => CardType(c.cardId) === "Unit");
      if (!hasUnit219) return null;
      return {
        type: "play-from-hand",
        cardId: "SOR_219",
        player,
      };
    }
    case "JTL_096": { // Blue Leader — "You may pay 2 resources. If you do, move this unit to the ground arena and give 2 Experience tokens to it."
      if (!playId) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: `Pay 2 resources to move ${CardTitle(cardId)} to the ground arena and give 2 Experience tokens?`,
        yesLabel: "Pay 2",
        noLabel: "Skip",
        onYes: null,
        continuation: null,
      };
    }
    case "SOR_147": // Black One — "When Played/When Defeated: You may discard your hand. If you do, draw 3 cards."
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: "Discard your hand and draw 3 cards?",
        yesLabel: "Discard & Draw 3",
        noLabel: "Skip",
        onYes: null,
        continuation: null,
      };
    case "SOR_150": { // Heroic Sacrifice — "Draw a card, then attack with a unit. It gets +2/+0 and dies when it deals combat damage."
      const game150 = game!;
      const gs150 = game150.currentGameState;
      const p150 = player === 1 ? gs150.player1 : gs150.player2;
      if (p150.deck.length > 0) {
        p150.hand.push(p150.deck.pop()!);
        game150.gameLog.push(`${CardTitle("SOR_150")}: drew a card.`);
      } else {
        DealDamageToBase(gs150, player, 3);
        game150.gameLog.push(`${CardTitle("SOR_150")}: drew from empty deck — 3 damage to base.`);
      }
      const attackers150 = GetUnitsForPlayer(player, true);
      if (attackers150.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: attackers150.map(u => u.playId),
        continuation: null,
      };
    }
    case "SHD_132": { // Choose Sides — "Choose a friendly non-leader unit and an enemy non-leader unit. Exchange control of those units."
      const friendly132 = GetUnitsForPlayer(player).filter(u => !CardIsLeader(u.cardId));
      if (friendly132.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: friendly132.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_092": { // Overwhelming Barrage — choose a friendly unit to buff and spread damage
      const friendly092 = GetUnitsForPlayer(player);
      if (friendly092.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: friendly092.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_178": { // Cartel Spacer — If you control another Cunning unit, exhaust an enemy unit (cost ≤ 4).
      if (!PlayerHasUnitWithAspectInPlay(player, "Cunning", true, playId)) return null;
      const eligible178 = AllUnits().filter(u => u.controller !== player && (CardCost(u.cardId) ?? 0) <= 4);
      if (eligible178.length === 0) return null;
      return mandatoryTarget(cardId, player, eligible178.map(u => u.playId));
    }
    case "SOR_035": { // Lieutenant Childsen — Reveal up to 4 Vigilance cards from hand; give 1 XP per revealed.
      const pState035 = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      const eligibleIndices035 = pState035.hand
        .map((c, i) => ({ i, cardId: c.cardId }))
        .filter(({ cardId }) => CardAspects(cardId).includes("Vigilance"))
        .map(({ i }) => i);
      if (eligibleIndices035.length === 0) return null;
      return {
        type: "reveal-from-hand",
        cardId,
        player,
        eligibleIndices: eligibleIndices035,
        maxCount: 4,
        sourcePlayId: playId ?? "",
        continuation: null,
      } satisfies RevealFromHandPending;
    }
    case "SOR_190": // Lothal Insurgent — auto-resolves in resolveWhenPlayedTrigger
    case "SOR_191": // Vanguard Ace — effect applied in resolveWhenPlayedTrigger
      return null;
    case "SOR_218": { // Asteroid Sanctuary — Exhaust an enemy unit; give Shield to a friendly unit (cost ≤ 3).
      const enemies218 = AllUnits().filter(u => u.controller !== player);
      if (enemies218.length === 0) return null;
      const friendliesEligible218 = AllUnits().filter(u => u.controller === player && (CardCost(u.cardId) ?? 0) <= 3);
      const shieldStep: PendingResolution = friendliesEligible218.length > 0
        ? mandatoryTarget("SOR_218_shield", player, friendliesEligible218.map(u => u.playId))
        : null as unknown as PendingResolution;
      return { type: "ability-target", cardId, player, fromPlayIds: enemies218.map(u => u.playId), continuation: friendliesEligible218.length > 0 ? shieldStep : null };
    }
    case "SOR_231": { // TIE Advanced — Give 2 XP to another friendly Imperial unit.
      const imperials231 = AllUnits().filter(u => u.controller === player && u.playId !== playId && TraitContains(u.cardId, "Imperial", player, u.playId));
      if (imperials231.length === 0) return null;
      return mandatoryTarget(cardId, player, imperials231.map(u => u.playId));
    }
    case "SOR_245": { // Medal Ceremony — Give XP to each of up to 3 Rebel units that attacked this phase.
      const gs245 = game.currentGameState;
      const rebellsAttacked = gs245.roundState.unitsAttackedThisPhase
        .filter(a => a.fromPlayer === player && TraitContains(a.cardId, "Rebel", player, a.playId));
      if (rebellsAttacked.length === 0) return null;
      const pending245: GiveXpMultiplePending = {
        type: "give-xp-multiple",
        cardId,
        player,
        maxCount: 3,
        eligiblePlayIds: rebellsAttacked.map(a => a.playId),
        continuation: null,
      };
      return pending245;
    }
    case "SOR_125": // Prepare for Takeoff — Search top 8 for up to 2 Vehicle units, reveal and draw.
      return searchDeck(cardId, player, 8, "draw", { filter: { type: "Unit", trait: "Vehicle" }, maxChoices: 2 });
    case "SOR_126": { // Resupply — "Put this event into play as a resource."
      const gs126 = game.currentGameState;
      const pState126 = player === 1 ? gs126.player1 : gs126.player2;
      const discardIdx126 = pState126.discard.findIndex(d => d.cardId === "SOR_126");
      if (discardIdx126 >= 0) {
        const discarded = pState126.discard.splice(discardIdx126, 1)[0];
        pState126.resources.push({
          cardId: discarded.cardId,
          playId: discarded.playId,
          owner: player,
          controller: player,
          ready: false,
          stolen: false,
        });
        game.gameLog.push(`${CardTitle("SOR_126")} entered play as an exhausted resource.`);
      }
      return null;
    }
    case "SOR_127": // Strike True — "A friendly unit deals damage equal to its power to an enemy unit."
      return chooseFriendlyForPowerDamage(cardId, player);
    case "LAW_168": // Haymaker — "Give an Experience token to a friendly unit. That unit deals damage equal to its power to an enemy unit in the same arena."
      return chooseFriendlyForPowerDamage(cardId, player);
    case "LAW_170": { // Double-Cross — "Choose a friendly non-leader unit and an enemy non-leader
                      // unit. Exchange control of those units. The player who takes control of the
                      // lower-cost unit creates Credit tokens equal to the difference in cost."
      const opponent170: PlayerId = player === 1 ? 2 : 1;
      const friendly170 = GetUnitsForPlayer(player).filter(u => !Unit.FromInterface(u).IsLeader());
      const enemy170 = GetUnitsForPlayer(opponent170).filter(u => !Unit.FromInterface(u).IsLeader());
      if (friendly170.length === 0 || enemy170.length === 0) return null; // needs one of each
      // Step 1 picks the friendly unit; its continuation picks the enemy unit.
      return mandatoryTarget("LAW_170_friendly", player, friendly170.map(u => u.playId));
    }
    case "JTL_143": { // Devastator — "When Played: Deal 4 indirect damage to each opponent."
      const opponent143: PlayerId = player === 1 ? 2 : 1;
      return {
        type: "indirect-damage",
        cardId: "JTL_143",
        sourcePlayer: player,
        targetPlayer: opponent143,
        totalDamage: 4,
        eligibleUnitPlayIds: GetUnitsForPlayer(opponent143).map(u => u.playId),
        continuation: null,
      };
    }
    case "LOF_048": { // Itinerant Warrior — "When Played: You may use the Force (lose your Force
                      // token). If you do, heal 3 damage from a base."
      if (!HasTheForce(player)) return null; // no token → nothing to spend, no prompt
      return {
        type: "ability-option",
        cardId: "LOF_048",
        player,
        helperText: "Use the Force to heal 3 damage from a base?",
        yesLabel: "Use the Force",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: "LOF_048",
          player,
          fromPlayIds: [],
          fromZones: ["Base"],
          continuation: null,
        },
        continuation: null,
      } satisfies AbilityOptionPending;
    }
    case "LAW_078": { // Sabine Wren (Spectre Five) — "When Played: You may defeat a non-unique
                      // upgrade. If you control a Vigilance or Command unit, you may defeat an
                      // upgrade instead." The condition only WIDENS the legal targets.
      const anyUpgrade078 = PlayerHasUnitWithAspectInPlay(player, "Vigilance")
        || PlayerHasUnitWithAspectInPlay(player, "Command");
      const eligible078 = DefeatableUpgradePlayIds(player).filter(playId => {
        if (anyUpgrade078) return true;
        const upgrade = FindUpgradeByPlayId(playId);
        return !!upgrade && !CardIsUnique(upgrade.cardId);
      });
      if (eligible078.length === 0) return null;
      return optionalTarget(cardId, player, eligible078,
        anyUpgrade078 ? "You may defeat an upgrade." : "You may defeat a non-unique upgrade.", {
          yesLabel: "Defeat an upgrade",
          noLabel: "Skip",
        });
    }
    case "JTL_100": { // Poe Dameron (One Hell of a Pilot) — "When played as a unit: Create an X-Wing
                      // token. You may attach this unit as an upgrade to a friendly Vehicle unit
                      // without a Pilot on it." Only reached on the unit path: playing him as a
                      // Pilot never puts a unit into play, so this trigger never fires there.
      const game100 = GetGame();
      if (!game100) return null;
      CreateXWing(game100.currentGameState, player, game100.gameLog, "JTL_100");
      if (!playId) return null;
      const vehicles100 = PilotlessVehiclePlayIds(game100.currentGameState, player, playId);
      if (vehicles100.length === 0) return null;
      // Hand-built rather than optionalTarget(): the target step needs sourcePlayId (which Poe
      // to attach), and optionalTarget only puts sourcePlayId on the option, not on its onYes.
      return {
        type: "ability-option",
        cardId: "JTL_100",
        player,
        sourcePlayId: playId,
        helperText: "Attach Poe Dameron as an upgrade to a friendly Vehicle without a Pilot?",
        yesLabel: "Attach as Pilot",
        noLabel: "Stay as a unit",
        onYes: {
          type: "ability-target",
          cardId: "JTL_100",
          player,
          sourcePlayId: playId,
          fromPlayIds: vehicles100,
          continuation: null,
        } satisfies AbilityTargetPending,
        continuation: null,
      } satisfies AbilityOptionPending;
    }
    case "SEC_193": { // Grand Admiral Thrawn (Grand Schemer) — "When Played: An opponent may choose
                      // a non-leader unit they control. If they do, this unit captures that unit.
                      // If they don't, ready this unit." The choice belongs to the OPPONENT.
      const opponent193 = player === 1 ? 2 : 1;
      const theirUnits193 = GetUnitsForPlayer(opponent193).filter(u => !CardIsLeader(u.cardId));
      if (theirUnits193.length === 0) {
        // They can't choose, so they didn't — ready Thrawn straight away.
        ReadyUnitByPlayId(playId, player, "SEC_193");
        return null;
      }
      return {
        type: "ability-option",
        cardId: "SEC_193",
        player: opponent193, // the opponent answers
        sourcePlayId: playId, // Thrawn, the captor
        helperText: `Choose a non-leader unit for ${CardTitle("SEC_193")} to capture? (If you don't, it readies.)`,
        yesLabel: "Give up a unit",
        noLabel: "Ready Thrawn instead",
        onYes: {
          type: "ability-target",
          cardId: "SEC_193",
          player: opponent193,
          sourcePlayId: playId,
          fromPlayIds: theirUnits193.map(u => u.playId),
          continuation: null,
        } satisfies AbilityTargetPending,
        continuation: null,
      } satisfies AbilityOptionPending;
    }
    case "SEC_163": { // Outer Rim Constable — "When Played: You may defeat an upgrade."
      const upgrades163 = DefeatableUpgradePlayIds(player);
      if (upgrades163.length === 0) return null;
      return optionalTarget(cardId, player, upgrades163, "You may defeat an upgrade.", {
        yesLabel: "Defeat an upgrade",
        noLabel: "Skip",
      });
    }
    case "SOR_251": { // Confiscate — "Defeat an upgrade."
      // Upgrades immune to enemy abilities (Luke JTL_012 as a Pilot) aren't legal targets.
      const allUpgradePlayIds251 = DefeatableUpgradePlayIds(player);
      if (allUpgradePlayIds251.length === 0) return null;
      return mandatoryTarget(cardId, player, allUpgradePlayIds251);
    }
    case "SOR_139": { // Force Choke — Deal 5 damage to a non-Vehicle unit; that controller draws a card.
      const eligible139 = AllUnits().filter(u => !CardTraits(u.cardId).includes("Vehicle"));
      if (eligible139.length === 0) return null;
      return mandatoryTarget(cardId, player, eligible139.map(u => u.playId));
    }
    case "SOR_077": { // Takedown — "Defeat a unit with 5 or less remaining HP."
      const eligible077 = AllUnits().filter(u => Unit.FromInterface(u).CurrentHP() <= 5);
      if (eligible077.length === 0) return null;
      return mandatoryTarget(cardId, player, eligible077.map(u => u.playId));
    }
    case "SOR_078": // Vanquish — "Defeat a non-leader unit."
    case "TWI_077": { // reprint of SOR_078
      const eligible078 = AllUnits().filter(u =>
        !Unit.FromInterface(u).IsLeader()
        // A unit immune to enemy card abilities (SHD_187) can't be defeated by an opponent's Vanquish.
        && !(UnitImmuneToEnemyAbilities(u.cardId) && u.controller !== player),
      );
      if (eligible078.length === 0) return null;
      return mandatoryTarget(cardId, player, eligible078.map(u => u.playId));
    }
    case "LOF_079": { // Shatterpoint — "Choose one: …"
      const modeALive = shatterpointLowHpTargets().length > 0;
      // Mode B needs both the Force token to spend and something to defeat with it.
      const modeBLive = HasTheForce(player) && shatterpointAnyTargets().length > 0;

      if (modeALive && modeBLive) {
        return {
          type: "choose-one",
          cardId,
          player,
          options: [
            { id: "defeat_low_hp", label: "Defeat a unit with 3 or less remaining HP" },
            { id: "use_force_then_defeat", label: "Use the Force, then defeat a unit" },
          ],
          continuation: null,
        };
      }
      // Only one mode is executable — no choice to present.
      if (modeALive) return shatterpointModeA(cardId, player);
      if (modeBLive) return shatterpointModeB(cardId, player, game.gameLog);
      return null; // neither mode can be carried out
    }
    case "JTL_043": { // No Glory, Only Results — "Take control of a non-leader unit, then defeat it."
      const eligible043 = AllUnits().filter(u => !Unit.FromInterface(u).IsLeader());
      if (eligible043.length === 0) return null;
      return mandatoryTarget(cardId, player, eligible043.map(u => u.playId));
    }
    case "LAW_133": { // Lost and Forgotten — "Defeat a non-leader unit. If you do, heal 3 damage from your base."
      const eligible133 = AllUnits().filter(u => !Unit.FromInterface(u).IsLeader());
      // No legal target → nothing is defeated, so the "if you do" heal never happens.
      if (eligible133.length === 0) return null;
      return mandatoryTarget(cardId, player, eligible133.map(u => u.playId));
    }
    case "ASH_103": { // Long Live the Empire — "Defeat a friendly Imperial unit. If you do, resource the top card of your deck."
      const eligible103 = AllUnits().filter(u => u.controller === player && TraitContains(u.cardId, "Imperial", player, u.playId));
      // No eligible friendly Imperial unit → the event still resolves, just with no effect.
      if (eligible103.length === 0) return null;
      return mandatoryTarget(cardId, player, eligible103.map(u => u.playId));
    }
    case "SHD_181": { // Pillage — "Choose a player. They discard 2 cards from their hand."
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: "Who discards 2 cards?",
        yesLabel: "You discard 2",
        noLabel: "Opponent discards 2",
        onYes: null,
        continuation: null,
      };
    }
    case "SEC_258": // Grassroots Resistance — "Deal 3 damage to a unit. Heal 3 damage from your base."
    case "ASH_258": { // reprint of SEC_258
      const eligible258 = AllUnits();
      if (eligible258.length === 0) {
        // No unit to damage, but the heal is not conditional on it — do it now.
        HealBaseForPlayer(game.currentGameState, player, 3, game.gameLog, cardId);
        return null;
      }
      return mandatoryTarget(cardId, player, eligible258.map(u => u.playId));
    }
    case "SOR_135": { // Emperor Palpatine — When Played: Deal 6 damage divided as you choose among enemy units.
      const enemies135 = GetUnitsForPlayer(player === 1 ? 2 : 1);
      if (enemies135.length === 0) return null;
      return {
        type: "spread-damage",
        cardId,
        player,
        totalDamage: 6,
        optional: false,
        eligiblePlayIds: enemies135.map(u => u.playId),
        continuation: null,
      } satisfies SpreadDamagePending;
    }
    case "TWI_229": // Battle Droid Escort — When Played: Create a Battle Droid token. (auto-resolves in when-played-trigger — resolveWhenPlayed is also called as a preview, so the effect must NOT live here or it doubles)
      return null;
    case "TWI_190": { // On the Doorstep — "Create 3 Battle Droid tokens and ready them."
      const gs190 = game.currentGameState;
      const d1 = CreateBattleDroid(gs190, player, game.gameLog, cardId);
      const d2 = CreateBattleDroid(gs190, player, game.gameLog, cardId);
      const d3 = CreateBattleDroid(gs190, player, game.gameLog, cardId);
      d1.ready = true;
      d2.ready = true;
      d3.ready = true;
      return null;
    }
    case "TWI_086": { // Admiral Trench — "When Played: Return up to 3 units that were defeated this phase from your discard pile to your hand."
      const gs086 = game.currentGameState;
      const playerState086 = player === 1 ? gs086.player1 : gs086.player2;
      const defeatedPlayIds086 = new Set(
        gs086.roundState.cardsLeftPlayThisPhase
          .filter(c => c.fromPlayer === player && c.reason === "defeated")
          .map(c => c.playId)
      );
      const eligible086 = playerState086.discard
        .filter(d => defeatedPlayIds086.has(d.playId))
        .map(d => d.playId);
      if (eligible086.length === 0) return null;
      return {
        type: "return-from-discard",
        cardId,
        player,
        maxCount: 3,
        eligiblePlayIds: eligible086,
        continuation: null,
      } satisfies ReturnFromDiscardPending;
    }
    case "SOR_106": { // Attack Pattern Delta
      const friendlies = GetUnitsForPlayer(player);
      if (friendlies.length === 0) return null;
      const allIds = friendlies.map(u => u.playId);
      return {
        type: "ability-target",
        cardId: "SOR_106_3",
        player,
        fromPlayIds: allIds,
        continuation: {
          type: "ability-target",
          cardId: "SOR_106_2",
          player,
          fromPlayIds: allIds, // stale — refreshed in applyAbilityEffect for SOR_106_3
          continuation: {
            type: "ability-target",
            cardId: "SOR_106_1",
            player,
            fromPlayIds: allIds, // stale — refreshed in applyAbilityEffect for SOR_106_2
            continuation: null,
          },
        },
      };
    }
    case "SOR_080": // General Tagge — When Played: Give an Experience token to each of up to 3 TROOPER units.
    case "SHD_081": { // reprint of SOR_080
      const troopers = AllUnits().filter(u => TraitContains(u.cardId, "Trooper", u.controller, u.playId));
      if (troopers.length === 0) return null;
      return {
        type: "give-xp-multiple",
        cardId,
        player,
        maxCount: 3,
        eligiblePlayIds: troopers.map(u => u.playId),
        continuation: null,
      } satisfies GiveXpMultiplePending;
    }
    case "JTL_106": { // Unity of Purpose — For each friendly unit with a different name, give each unit you control +1/+1 for this phase.
      const gs106 = game.currentGameState;
      const friendlyUnits106 = player === 1
        ? [...gs106.player1.groundArena, ...gs106.player1.spaceArena]
        : [...gs106.player2.groundArena, ...gs106.player2.spaceArena];
      const distinctCount106 = new Set(friendlyUnits106.map(u => u.cardId)).size;
      if (distinctCount106 === 0) return null;
      for (let i = 0; i < distinctCount106; i++) {
        gs106.currentEffects.push({
          cardId: "JTL_106",
          duration: "Phase",
          affectedPlayer: player,
        });
      }
      game.gameLog.push(`${CardTitle(cardId)}: giving each friendly unit +${distinctCount106}/+${distinctCount106} for this phase.`);
      return null;
    }
    case "JTL_234": // Torpedo Barrage — Deal 5 indirect damage to a player.
      return {
        type: "choose-indirect-target",
        cardId,
        sourcePlayer: player,
        totalDamage: 5,
      } satisfies ChooseIndirectTargetPending;
    case "SOR_087": // Darth Vader — Search top 10 of deck for Villainy units with combined cost ≤ 3, play each for free.
      return searchDeck(cardId, player, 10, "play", { filter: { type: "Unit", aspect: "Villainy", maxCost: 3 }, maxCombinedCost: 3, costModifier: "free" });
    case "SOR_104": // U-Wing Reinforcement — Search top 10 of deck for up to 3 units with combined cost ≤ 7, play each for free.
      return searchDeck(cardId, player, 10, "play", { filter: { type: "Unit", maxCost: 7 }, maxChoices: 3, maxCombinedCost: 7, costModifier: "free" });
    case "SOR_123": // Recruit — Search top 5 of deck for a unit, reveal it, and draw it.
      return searchDeck(cardId, player, 5, "draw", { filter: { type: "Unit" }, maxChoices: 1 });
    case "SOR_039": // AT-AT Suppressor — When Played: Exhaust all ground units. (auto-resolves in when-played-trigger)
      return null;
    case "SOR_111": // Patrolling V-Wing — When Played: Draw a card. (auto-resolves in when-played-trigger)
      return null;
    case "SOR_132": { // Imperial Interceptor — When Played: You may deal 3 damage to a space unit.
      const spaceUnits132 = AllSpaceUnits();
      if (spaceUnits132.length === 0) return null;
      return optionalTarget(cardId, player, spaceUnits132.map(u => u.playId),
        "Deal 3 damage to a space unit?", { yesLabel: "Deal 3", sourcePlayId: playId });
    }
    case "ASH_194": { // Snub Fighter Squadron — When Played: Deal 1 damage to a space unit. (mandatory)
      const spaceUnits194 = AllSpaceUnits();
      if (spaceUnits194.length === 0) return null;
      return mandatoryTarget(cardId, player, spaceUnits194.map(u => u.playId));
    }
    case "SHD_197": { // L3-37 — When Played: You may rescue a captured card. If you don't, give a Shield token to this unit.
      // If there is nothing to rescue, the "If you don't" fallback (Shield to self) auto-resolves in
      // resolveWhenPlayedTrigger (this preview is called twice for units, so it must stay side-effect-free).
      if (!playId) return null;
      if (AllCaptives().length === 0) return null;
      return {
        type: "ability-option",
        cardId,
        player,
        sourcePlayId: playId,
        helperText: "Rescue a captured card? (If you don't, give a Shield token to L3-37.)",
        yesLabel: "Rescue",
        noLabel: "Give Shield",
        onYes: null,
        continuation: null,
      };
    }
    case "TS26_077": { // Deployed Droideka — When Played: You may pay 2 resources. If you do, give an Experience token and a Shield token to this unit.
      if (!playId) return null;
      if (spendableFor(game.currentGameState, player) < 2) return null; // can't afford → no offer
      return {
        type: "ability-option",
        cardId,
        player,
        sourcePlayId: playId,
        helperText: "Pay 2 resources to give this unit an Experience token and a Shield token?",
        yesLabel: "Pay 2",
        noLabel: "Skip",
        onYes: null,
        continuation: null,
      };
    }
    case "SHD_235": { // Ruthless Assassin — When Played: Deal 2 damage to a friendly unit. (mandatory)
      const friendly235 = GetUnitsForPlayer(player);
      if (friendly235.length === 0) return null;
      return mandatoryTarget(cardId, player, friendly235.map(u => u.playId));
    }
    case "LOF_158": { // Hyena Bomber — When Played: If you control another Aggression unit, you may deal 2 damage to a ground unit.
      if (!PlayerHasUnitWithAspectInPlay(player, "Aggression", true, playId)) return null;
      const groundUnits158 = AllGroundUnits();
      if (groundUnits158.length === 0) return null;
      return optionalTarget(cardId, player, groundUnits158.map(u => u.playId),
        "Deal 2 damage to a ground unit?", { yesLabel: "Deal 2", sourcePlayId: playId });
    }
    case "ASH_196": { // Gorian Shard's Corsair — When Played/On Attack: may deal 2 damage to a unit.
      const allUnits196 = AllUnits();
      if (allUnits196.length === 0) return null;
      return optionalTarget(cardId, player, allUnits196.map(u => u.playId),
        "Deal 2 damage to a unit?", { yesLabel: "Deal 2", sourcePlayId: playId });
    }
    case "SOR_134": { // Ruthless Raider — When Played: Deal 2 to enemy base + 2 to an enemy unit.
      // resolveWhenPlayed must stay side-effect-free (for units it is called both as a preview
      // in queueUnitEntryTriggers AND on trigger-bag drain, so any mutation here double-applies).
      // Base + unit damage are applied together when the ability-target resolves (applyAbilityEffect),
      // or, when there is no enemy unit to hit, in resolveWhenPlayedTrigger (drained once).
      const gs134 = game.currentGameState;
      const oppState134 = player === 1 ? gs134.player2 : gs134.player1;
      const enemyUnits134 = [...oppState134.groundArena, ...oppState134.spaceArena];
      if (enemyUnits134.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: enemyUnits134.map(u => u.playId),
        continuation: null,
      };
    }
    case "ASH_179": { // Boba Fett's Rancor — When Played: Deal 5 to your base. Then, deal 5 to an
                      // enemy ground unit. Then, deal 5 more to the same unit.
      // resolveWhenPlayed must stay side-effect-free (see SOR_134 above). Base damage + both hits
      // are applied together when the ability-target resolves (applyAbilityEffect), or, when there
      // is no enemy ground unit, in resolveWhenPlayedTrigger (drained once) — base damage only.
      const enemyGroundUnits179 = AllGroundUnits().filter(u => u.controller !== player);
      if (enemyGroundUnits179.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: enemyGroundUnits179.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_189": { // Leia Organa — When Played: Either ready a resource or exhaust a unit.
      const pState189 = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      const exhaustedResources189 = pState189.resources.filter(r => !r.ready);
      const allReadyUnits189 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)].filter(u => u.ready);
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Ready a resource (Yes) or exhaust a unit (No)?",
        yesLabel: "Ready a resource",
        noLabel: "Exhaust a unit",
        onYes: exhaustedResources189.length > 0 ? {
          type: "ability-target",
          cardId: "SOR_189_ready",
          player,
          fromPlayIds: exhaustedResources189.map(r => r.playId),
          continuation: null,
        } : null,
        continuation: allReadyUnits189.length > 0 ? {
          type: "ability-target",
          cardId: "SOR_189_exhaust",
          player,
          fromPlayIds: allReadyUnits189.map(u => u.playId),
          continuation: null,
        } : null,
      };
    }
    case "SOR_202": { // Cantina Bouncer — When Played: You may return a non-leader unit to its owner's hand.
      const nonLeaders202 = AllUnits().filter(u => !CardIsLeader(u.cardId));
      if (nonLeaders202.length === 0) return null;
      return optionalTarget(cardId, player, nonLeaders202.map(u => u.playId),
        "Return a non-leader unit to its owner's hand?",
        { yesLabel: "Bounce", sourcePlayId: playId });
    }
    case "SOR_075": { // It Binds All Things — Heal up to 3 from a unit. If Force unit, may deal that much to another unit.
      const allUnits075 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)].map(u => u.playId);
      return {
        type: "spread-heal",
        cardId,
        player,
        maxHeal: 3,
        eligiblePlayIds: allUnits075,
        afterHeal: PlayerHasUnitWithTraitInPlay(player, "Force")
          ? { type: "deal-healed-to-unit", eligiblePlayIds: allUnits075, optional: true }
          : undefined,
        continuation: null,
      } satisfies SpreadHealPending;
    }
    case "LOF_075": // Cure Wounds — "Use the Force. If you do, heal 6 damage from a unit."
    case "LOF_172": { // Sorcerous Blast — "Use the Force. If you do, deal 3 damage to a unit."
      // "Use the Force" is a "may": only offer it when the player controls the Force.
      if (!HasTheForce(player)) return null;
      const isHeal = cardId === "LOF_075";
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: isHeal
          ? "Use the Force to heal 6 damage from a unit?"
          : "Use the Force to deal 3 damage to a unit?",
        yesLabel: "Use the Force",
        noLabel: "Skip",
        onYes: null,
        continuation: null,
      };
    }
    case "JTL_039": { // Chimaera — "You may use a 'When Defeated' ability on another friendly unit."
                      // The chosen unit is NOT defeated; only its ability is used.
      const eligible039 = GetUnitsForPlayer(player)
        .filter(u => u.playId !== playId && UnitHasWhenDefeatedAbility(u));
      if (eligible039.length === 0) return null;
      return optionalTarget("JTL_039", player, eligible039.map(u => u.playId),
        "Use a “When Defeated” ability on another friendly unit?",
        { yesLabel: "Use it" });
    }
    case "LOF_070": { // Anakin Skywalker (Champion of Mortis) — TWO independent When Played abilities:
                      //   "If there is a Heroism card in your discard pile, you may give a unit -3/-3 for this phase."
                      //   "If there is a Villainy card in your discard pile, you may give a unit -3/-3 for this phase."
                      // Both can be live at once; they are simultaneous triggers, so the controller
                      // orders them (the first debuff can defeat a unit and change the second's targets).
      const units070 = AllUnits();
      if (units070.length === 0) return null;
      const heroism070 = PlayerHasAspectInDiscard(player, "Heroism");
      const villainy070 = PlayerHasAspectInDiscard(player, "Villainy");
      if (!heroism070 && !villainy070) return null;
      if (heroism070 && villainy070) {
        return {
          type: "choose-one",
          cardId: "LOF_070",
          player,
          options: [
            { id: "heroism", label: "Resolve the Heroism ability first" },
            { id: "villainy", label: "Resolve the Villainy ability first" },
          ],
          continuation: null,
        } satisfies ChooseOnePending;
      }
      return anakinMortisAbility(heroism070 ? "heroism" : "villainy", player, null);
    }
    case "SOR_074": // Repair — Heal 3 damage from a unit or base.
    case "JTL_075": {
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: allUnitsAndBasesPlayIds(),
        continuation: null,
      };
    }
    case "SHD_178": // Daring Raid — "Deal 2 damage to a unit or base." (TWI_170 is an identical reprint.)
    case "TWI_170": {
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: allUnitsAndBasesPlayIds(),
        continuation: null,
      };
    }
    case "IBH_066": // Too Strong for Blasters — "Heal 2 damage from a unit."
    case "IBH_091":
    case "IBH_061": // We're In Trouble — "Deal 3 damage to a unit."
    case "IBH_086": {
      const units066 = AllUnits();
      if (units066.length === 0) return null;
      return { type: "ability-target", cardId, player, fromPlayIds: units066.map(u => u.playId), continuation: null };
    }
    case "IBH_059": // Target the Main Generator — "Deal 2 damage to a base." (either base)
    case "IBH_071":
      return { type: "ability-target", cardId, player, fromPlayIds: [], fromZones: ["Base"], continuation: null };
    case "IBH_005": // I'll Cover For You — "Deal 1 damage to an enemy unit and 1 damage to another enemy unit."
    case "IBH_039": {
      const opponent005 = player === 1 ? 2 : 1;
      const enemies005 = GetUnitsForPlayer(opponent005);
      if (enemies005.length === 0) return null;
      return { type: "ability-target", cardId: "IBH_005_a", player, fromPlayIds: enemies005.map(u => u.playId), continuation: null };
    }
    case "IBH_021": // Improvised Detonation — "Attack with a unit. It gets +2/+0 for this attack."
    case "IBH_030": {
      const ready021 = GetUnitsForPlayer(player, true);
      if (ready021.length === 0) return null;
      return { type: "ability-target", cardId, player, fromPlayIds: ready021.map(u => u.playId), continuation: null };
    }
    case "IBH_104": { // The Desolation of Hoth — "Defeat up to 2 enemy units that each cost 3 or less."
      const opponent104 = player === 1 ? 2 : 1;
      const targets104 = GetUnitsForPlayer(opponent104).filter(u => (CardCost(u.cardId) ?? 0) <= 3);
      if (targets104.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "IBH_104",
        player,
        fromPlayIds: targets104.map(u => u.playId),
        needsMultiple: true,
        maxTargets: 2,
        continuation: null,
      };
    }
    case "IBH_095": { // You Have Failed Me — "Defeat a friendly unit. If you do, ready a friendly unit with 5 or less power."
      const friendly095 = GetUnitsForPlayer(player);
      if (friendly095.length === 0) return null;
      return mandatoryTarget("IBH_095", player, friendly095.map(u => u.playId));
    }
    case "SOR_076": { // Make an Opening — Give a unit –2/–2 for this phase. Heal 2 from own base.
      const allUnits076 = AllUnits();
      if (allUnits076.length === 0) return null;
      return mandatoryTarget(cardId, player, allUnits076.map(u => u.playId));
    }
    case "SOR_124": { // Tactical Advantage — Give a unit +2/+2 for this phase.
      const allUnits124 = AllUnits();
      if (allUnits124.length === 0) return null;
      return mandatoryTarget(cardId, player, allUnits124.map(u => u.playId));
    }
    case "SOR_187": { // I Had No Choice — Choose up to 2 non-leader units; opponent picks 1 to return to hand; other goes to deck bottom.
      const nonLeaders187 = AllUnits().filter(u => !CardIsLeader(u.cardId));
      if (nonLeaders187.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: nonLeaders187.map(u => u.playId),
        needsMultiple: true,
        maxTargets: 2,
        continuation: null,
      };
    }
    case "SOR_181": // Jabba the Hutt — When Played: Search top 8 for a TRICK event, draw it.
      return searchDeck(cardId, player, 8, "draw", { filter: { trait: "Trick" }, maxChoices: 1 });
    case "SOR_151": { // Karabast — A friendly unit deals damage equal to damage on it + its power to an enemy unit.
      const friendlyUnits151 = GetUnitsForPlayer(player);
      const enemyUnits151 = GetUnitsForPlayer(player === 1 ? 2 : 1);
      if (friendlyUnits151.length === 0 || enemyUnits151.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: friendlyUnits151.map(u => u.playId),
        continuation: {
          type: "ability-target",
          cardId: "SOR_151_deal",
          player,
          fromPlayIds: enemyUnits151.map(u => u.playId),
          continuation: null,
        },
      };
    }
    case "SOR_152": { // For a Cause I Believe In — Reveal top 4. Deal 1 damage per Heroism card to enemy base. May discard any; rest return to top.
      const game152 = GetGame();
      if (!game152) return null;
      const pState152 = GetPlayer(game152.currentGameState, player);
      const opponentPlayer152 = player === 1 ? 2 : 1;
      const n152 = Math.min(4, pState152.deck.length);
      if (n152 === 0) return null;
      const slice152 = pState152.deck.slice(-n152);
      const heroismCount = slice152.filter(c => CardAspects(c.cardId).includes("Heroism")).length;
      if (heroismCount > 0) {
        DealDamageToBase(game152.currentGameState, opponentPlayer152, heroismCount);
        game152.gameLog.push(`${CardTitle(cardId)}: revealed ${heroismCount} Heroism card(s) — dealt ${heroismCount} damage to enemy base.`);
      }
      pState152.deck.splice(pState152.deck.length - n152, n152);
      return {
        type: "reveal-discard",
        cardId,
        player,
        revealedCards: slice152.map((c, i) => ({ tempId: `${i}`, cardId: c.cardId })),
        continuation: null,
      } satisfies RevealDiscardPending;
    }
    case "SOR_169": { // Keep Fighting — Ready a unit with 3 or less power.
      const eligible169 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .filter(u => new Unit(u.cardId, u.playId, u.controller).CurrentPower() <= 3);
      if (eligible169.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: eligible169.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_170": { // Power Failure — Defeat any number of upgrades on a unit.
      const unitsWithUpgrades170 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .filter(u => u.upgrades.length > 0);
      if (unitsWithUpgrades170.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: unitsWithUpgrades170.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_171": { // Mission Briefing — Choose a player. They draw 2 cards.
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: "Who draws 2 cards?",
        yesLabel: "You draw 2",
        noLabel: "Opponent draws 2",
        onYes: null,
        continuation: null,
      };
    }
    case "SOR_172": { // Open Fire — Deal 4 damage to a unit.
      const allUnits172 = AllUnits();
      if (allUnits172.length === 0) return null;
      return mandatoryTarget(cardId, player, allUnits172.map(u => u.playId));
    }
    case "SOR_173": { // Bombing Run — Choose an arena. Deal 3 damage to each unit in that arena.
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: "Choose an arena: Ground (Yes) or Space (No)?",
        yesLabel: "Ground",
        noLabel: "Space",
        onYes: null,
        continuation: null,
      };
    }
    case "SOR_216": { // Disarm — Give an enemy unit –4/–0 for this phase.
      const enemyUnits216 = GetUnitsForPlayer(player === 1 ? 2 : 1);
      if (enemyUnits216.length === 0) return null;
      return mandatoryTarget(cardId, player, enemyUnits216.map(u => u.playId));
    }
    case "SOR_223": { // Don't Get Cocky — Choose a unit, reveal cards one at a time until stop/7.
      const allUnits223 = AllUnits();
      if (allUnits223.length === 0) return null;
      return mandatoryTarget(cardId, player, allUnits223.map(u => u.playId));
    }
    case "SOR_217": { // Shoot First — Attack with a unit. It gets +1/+0 and deals damage first.
      const readyFriendly217 = GetUnitsForPlayer(player, true);
      if (readyFriendly217.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: readyFriendly217.map(u => u.playId),
        continuation: null,
      };
    }
    case "LOF_128": { // Protect the Pod — "A friendly non-Vehicle unit deals damage equal to its
                      // remaining HP to an enemy unit."
      const opponent128 = player === 1 ? 2 : 1;
      if (GetUnitsForPlayer(opponent128).length === 0) return null; // no enemy unit to damage
      return chooseFriendlyForPowerDamage("LOF_128", player, {
        filter: u => !TraitContains(u.cardId, "Vehicle", u.controller, u.playId),
      });
    }
    case "JTL_156": { // Trench Run — "Attack with a Fighter unit. For this attack, it gets +4/+0 and
                      // gains: 'On Attack: Discard 2 cards from the defending player's deck. Deal
                      // unpreventable damage equal to the difference in the discarded cards' costs
                      // to this unit.'"
      const fighters156 = GetUnitsForPlayer(player, true)
        .filter(u => TraitContains(u.cardId, "Fighter", u.controller, u.playId));
      if (fighters156.length === 0) return null;
      return mandatoryTarget(cardId, player, fighters156.map(u => u.playId));
    }
    case "JTL_177": { // Stay on Target — "Attack with a Vehicle unit. For this attack, it gets +2/+0
                      // and gains: 'When this unit deals damage to a base: Draw a card.'"
      const vehicles177 = GetUnitsForPlayer(player, true)
        .filter(u => TraitContains(u.cardId, "Vehicle", u.controller, u.playId));
      if (vehicles177.length === 0) return null;
      return mandatoryTarget(cardId, player, vehicles177.map(u => u.playId));
    }
    case "SOR_220": { // Surprise Strike — Attack with a unit. It gets +3/+0 for this attack.
      const readyFriendly220 = GetUnitsForPlayer(player, true);
      if (readyFriendly220.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: readyFriendly220.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_221": { // Outmaneuver — Choose an arena. Exhaust each unit in that arena.
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: "Choose an arena: Ground (Yes) or Space (No)?",
        yesLabel: "Ground",
        noLabel: "Space",
        onYes: null,
        continuation: null,
      };
    }
    case "SOR_240": { // Fleet Lieutenant — When Played: You may attack with a unit. Rebels get +2/+0.
      const readyFriendly240 = GetUnitsForPlayer(player, true);
      if (readyFriendly240.length === 0) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Attack with a unit? Rebel units get +2/+0.",
        yesLabel: "Attack",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId,
          player,
          fromPlayIds: readyFriendly240.map(u => u.playId),
          continuation: null,
        },
        continuation: null,
      };
    }
    case "TWI_193": { // R2-D2 (Full of Solutions) — You may discard a card. If you do, search top 3 and draw a card.
      const pState193 = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      if (pState193.hand.length === 0) return null;
      const deckSearchCont193 = searchDeck(cardId, player, 3, "draw", { maxChoices: 1, dontReveal: true });
      if (!deckSearchCont193) return null;
      return {
        type: "ability-option",
        cardId: "TWI_193",
        sourcePlayId: playId,
        helperText: "Discard a card from your hand to search the top 3 cards of your deck and draw a card?",
        yesLabel: "Discard",
        noLabel: "Skip",
        onYes: {
          type: "discard-from-hand",
          targetPlayer: player,
          count: 1,
          continuation: deckSearchCont193,
        },
        continuation: null,
      };
    }
    case "SOR_236": // R2-D2 — When Played/On Attack: Scry 1.
      return searchDeck(cardId, player, 1, "scry");
    case "SOR_031": // Inferno Four — When Played/When Defeated: Look at top 2, put any on bottom, rest on top.
      return searchDeck(cardId, player, 2, "scry");
    case "LOF_100": // Kelleran Beq — Search the top 7 cards of your deck for a unit, reveal it, and play it. It costs 3 resources less.
      return searchDeck(cardId, player, 7, "play", { filter: { type: "Unit" }, maxChoices: 1, costModifier: -3 });
    case "SOR_228": // Viper Probe Droid — When Played: Look at an opponent's hand.
    case "SEC_239": // reprint of SOR_228
    {
      const opponent228: PlayerId = player === 1 ? 2 : 1;
      return {
        type: "peek-hand",
        peekingPlayer: player,
        targetPlayer: opponent228,
        mustDiscard: false,
        continuation: null,
      } satisfies PeekHandPending;
    }
    case "SOR_201": { // Bodhi Rook — When Played: Look at an opponent's hand and discard a non-unit card from it.
      const opponent201: PlayerId = player === 1 ? 2 : 1;
      const hand201 = player === 1 ? game.currentGameState.player2.hand : game.currentGameState.player1.hand;
      const hasNonUnit = hand201.some(c => CardType(c.cardId) !== "Unit");
      if (!hasNonUnit) return null;
      return {
        type: "peek-hand",
        peekingPlayer: player,
        targetPlayer: opponent201,
        mustDiscard: true,
        discardFilter: "non-unit",
        continuation: null,
      } satisfies PeekHandPending;
    }
    // ASH_220 Remnant Lookouts / SHD_184 Bazine Netal — "When Played: Look at an opponent's hand.
    // You may discard a card from it. If you do, they draw a card."
    case "ASH_220":
    case "SHD_184": {
      const opponent220: PlayerId = player === 1 ? 2 : 1;
      const hand220 = player === 1 ? game.currentGameState.player2.hand : game.currentGameState.player1.hand;
      if (hand220.length === 0) return null;
      return {
        type: "peek-hand",
        peekingPlayer: player,
        targetPlayer: opponent220,
        mustDiscard: true,
        optionalDiscard: true,
        thenDrawForTarget: true,
        continuation: null,
      } satisfies PeekHandPending;
    }
    case "SOR_200": { // Spark of Rebellion (Event) — Look at an opponent's hand and discard a card from it.
      const opponent200: PlayerId = player === 1 ? 2 : 1;
      const hand200 = player === 1 ? game.currentGameState.player2.hand : game.currentGameState.player1.hand;
      if (hand200.length === 0) return null;
      return {
        type: "peek-hand",
        peekingPlayer: player,
        targetPlayer: opponent200,
        mustDiscard: true,
        continuation: null,
      } satisfies PeekHandPending;
    }
    case "SOR_186": { // No Good to Me Dead — Exhaust a unit; it can't ready this round.
      const allUnits186 = AllUnits();
      if (allUnits186.length === 0) return null;
      return mandatoryTarget(cardId, player, allUnits186.map(u => u.playId));
    }
    case "SOR_174": { // Smoke and Cinders — Each player discards all but 2 cards.
      const gs174 = game.currentGameState;
      const p1Hand174 = gs174.player1.hand.length;
      const p2Hand174 = gs174.player2.hand.length;
      const p1Count = Math.max(0, p1Hand174 - 2);
      const p2Count = Math.max(0, p2Hand174 - 2);
      const p2Pending174: DiscardFromHandPending | null = p2Count > 0
        ? { type: "discard-from-hand", targetPlayer: 2, count: p2Count, continuation: null }
        : null;
      if (p1Count > 0) {
        return { type: "discard-from-hand", targetPlayer: 1, count: p1Count, continuation: p2Pending174 } satisfies DiscardFromHandPending;
      }
      return p2Pending174;
    }
    case "SOR_167": { // Force Throw — Choose a player to discard a card; if Force unit, may deal damage = discarded cost.
      const opp167: PlayerId = player === 1 ? 2 : 1;
      const hasForce167 = PlayerHasUnitWithTraitInPlay(player, "Force");
      const oppDiscard: DiscardFromHandPending = {
        type: "discard-from-hand",
        targetPlayer: opp167,
        count: 1,
        forceThrowControllerPlayer: hasForce167 ? player : undefined,
        continuation: null,
      };
      const selfDiscard: DiscardFromHandPending = {
        type: "discard-from-hand",
        targetPlayer: player,
        count: 1,
        forceThrowControllerPlayer: hasForce167 ? player : undefined,
        continuation: null,
      };
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: "Choose a player to discard a card from their hand.",
        yesLabel: `Opponent (Player ${opp167}) discards`,
        noLabel: `You (Player ${player}) discard`,
        onYes: oppDiscard,
        continuation: selfDiscard,
      } satisfies AbilityOptionPending;
    }
    case "SOR_051": { // Luke Skywalker — Give an enemy unit –3/–3 (or –6/–6 if friendly died this phase).
      const enemies051 = GetUnitsForPlayer(player === 1 ? 2 : 1);
      if (enemies051.length === 0) return null;
      return mandatoryTarget(cardId, player, enemies051.map(u => u.playId));
    }
    case "SOR_234": { // Maximum Firepower — step 1: pick first friendly Imperial unit.
      const imperials234 = GetUnitsForPlayer(player)
        .filter(u => TraitContains(u.cardId, "Imperial", player, u.playId));
      if (imperials234.length === 0) return null;
      return {
        type: "ability-target",
        cardId: "SOR_234",
        player,
        fromPlayIds: imperials234.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_233": { // I Am Your Father — Deal 7 damage to an enemy unit unless its controller says 'no.'
      const enemies233 = GetUnitsForPlayer(player === 1 ? 2 : 1);
      if (enemies233.length === 0) return null;
      return mandatoryTarget(cardId, player, enemies233.map(u => u.playId));
    }
    case "SOR_199": { // Bamboozle — Exhaust a unit and return each upgrade on it to its owner's hand.
      const allUnits199 = AllUnits();
      if (allUnits199.length === 0) return null;
      return mandatoryTarget(cardId, player, allUnits199.map(u => u.playId));
    }
    case "SOR_037": // Academy Defense Walker — handled auto in resolveWhenPlayedTrigger
      return null;
    case "SOR_038": // Count Dooku (Darth Tyranus) — You may defeat a unit with 4 or less remaining HP.
    case "C24_001": { // reprint
      const eligible038 = AllUnits().filter(u => Unit.FromInterface(u).CurrentHP() <= 4);
      if (eligible038.length === 0) return null;
      return optionalTarget(cardId, player, eligible038.map(u => u.playId),
        "Defeat a unit with 4 or less remaining HP?");
    }
    case "SOR_050": { // The Ghost — When Played: You may give a Shield token to another SPECTRE unit.
      const spectres050 = GetUnitsForPlayer(player)
        .filter(u => u.playId !== playId && TraitContains(u.cardId, "Spectre", player, u.playId));
      if (spectres050.length === 0) return null;
      return optionalTarget(cardId, player, spectres050.map(u => u.playId),
        "Give a Shield token to another Spectre unit?",
        { yesLabel: "Give Shield", sourcePlayId: playId });
    }
    case "SOR_062": { // Regional Governor — Name a card; opponents can't play it while this unit is in play.
      return {
        type: "ability-target",
        cardId: "SOR_062",
        sourcePlayId: playId,
        player,
        fromPlayIds: [],   // any card ID is valid; UI uses fromChoices for display
        fromChoices: AllCardTitles(),
        continuation: null,
      };
    }
    case "SOR_068": // Cargo Juggernaut (Lom Pyke) — handled auto in resolveWhenPlayedTrigger
      return null;
    case "SOR_090": { // Devastator — You may deal damage to a unit equal to the number of resources you control.
      const gs090 = game.currentGameState;
      const resourceCount090 = (player === 1 ? gs090.player1 : gs090.player2).resources.length;
      if (resourceCount090 === 0) return null;
      const allUnits090 = AllUnits();
      if (allUnits090.length === 0) return null;
      return optionalTarget(cardId, player, allUnits090.map(u => u.playId),
        `Deal ${resourceCount090} damage to a unit?`);
    }
    case "SOR_097": { // Admiral Ackbar — When Played: You may deal damage to a unit equal to the number of units you control in its arena.
      const allUnits097 = AllUnits();
      if (allUnits097.length === 0) return null;
      return optionalTarget(cardId, player, allUnits097.map(u => u.playId),
        "Deal damage to a unit equal to the number of units you control in its arena?");
    }
    case "SOR_101": { // Rogue Squadron Skirmisher — Return a unit costing 2 or less from your discard to your hand.
      const gs101 = game.currentGameState;
      const pState101 = player === 1 ? gs101.player1 : gs101.player2;
      const eligible101 = pState101.discard.filter(
        d => CardType(d.cardId) === "Unit" && (CardCost(d.cardId) ?? 0) <= 2
      );
      if (eligible101.length === 0) return null;
      return {
        type: "return-from-discard",
        cardId,
        player,
        maxCount: 1,
        eligiblePlayIds: eligible101.map(d => d.playId),
        continuation: null,
      } satisfies ReturnFromDiscardPending;
    }
    case "SOR_099": { // Home One — You may return a friendly non-leader ground unit to hand; if you do, draw a card.
      const game099 = GetGame();
      if (!game099) return null;
      const groundArena099 = player === 1 ? game099.currentGameState.player1.groundArena : game099.currentGameState.player2.groundArena;
      const friendlyNonLeaderGround099 = groundArena099.filter(u => !CardIsLeader(u.cardId));
      if (friendlyNonLeaderGround099.length === 0) return null;
      return optionalTarget(cardId, player, friendlyNonLeaderGround099.map(u => u.playId),
        "Return a friendly non-leader ground unit to hand?",
        { yesLabel: "Return" });
    }
    case "SOR_102": { // Home One — Play a [Heroism] unit from your discard pile. It costs [3 resources] less.
      const game102 = GetGame();
      if (!game102) return null;
      const gs102 = game102.currentGameState;
      const playerState102 = player === 1 ? gs102.player1 : gs102.player2;
      const readyResources102 = playerState102.resources.filter(r => r.ready).length;
      const eligible102 = playerState102.discard.filter(d => {
        if (CardType(d.cardId) !== "Unit") return false;
        if (!CardAspects(d.cardId)?.includes("Heroism")) return false;
        const effectiveCost = Math.max(0, CardCost(d.cardId) + aspectPenalty(gs102, player, d.cardId) - 3);
        return effectiveCost <= readyResources102;
      });
      if (eligible102.length === 0) return null;
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: "Play a Heroism unit from your discard pile? (costs 3 less)",
        yesLabel: "Play",
        noLabel: "Skip",
        onYes: {
          type: "return-from-discard",
          cardId,
          player,
          maxCount: 1,
          eligiblePlayIds: eligible102.map(d => d.playId),
          continuation: null,
        } satisfies ReturnFromDiscardPending,
        continuation: null,
      } satisfies AbilityOptionPending;
    }
    case "TWI_189": { // Unnatural Life — "Play a unit that was defeated this phase from your discard
                      // pile. It costs 2 resources less and enters play ready. At the start of the
                      // regroup phase, defeat it."
      const gs189 = game.currentGameState;
      const pState189 = player === 1 ? gs189.player1 : gs189.player2;
      const readyResources189 = pState189.resources.filter(r => r.ready).length;
      const defeatedThisPhase189 = new Set(
        gs189.roundState.cardsLeftPlayThisPhase
          .filter(c => c.fromPlayer === player && (c.reason === "defeated" || c.reason === "token-defeated"))
          .map(c => c.playId),
      );
      const eligible189 = pState189.discard.filter(d => {
        if (CardType(d.cardId) !== "Unit") return false;
        if (!defeatedThisPhase189.has(d.playId)) return false;
        const effectiveCost = Math.max(0, CardCost(d.cardId) + aspectPenalty(gs189, player, d.cardId) - 2);
        return effectiveCost <= readyResources189;
      });
      if (eligible189.length === 0) return null;
      return {
        type: "return-from-discard",
        cardId: "TWI_189",
        player,
        maxCount: 1,
        eligiblePlayIds: eligible189.map(d => d.playId),
        continuation: null,
      } satisfies ReturnFromDiscardPending;
    }
    case "SOR_086": { // Gladiator Star Destroyer — Give a unit Sentinel for this phase.
      const all086 = AllUnits();
      if (all086.length === 0) return null;
      return mandatoryTarget(cardId, player, all086.map(u => u.playId));
    }
    case "SOR_140": { // SpecForce Soldier — A unit loses Sentinel for this phase.
      const all140 = AllUnits();
      if (all140.length === 0) return null;
      return mandatoryTarget(cardId, player, all140.map(u => u.playId));
    }
    case "SOR_148": // Guerilla Attack Pod — handled auto in resolveWhenPlayedTrigger
      return null;
    case "SOR_183": { // Bounty Hunter Crew (Han Solo) — Return an event from a discard pile to its owner's hand.
      const gs183 = game.currentGameState;
      const events183 = [
        ...gs183.player1.discard.filter(d => CardType(d.cardId) === "Event"),
        ...gs183.player2.discard.filter(d => CardType(d.cardId) === "Event"),
      ];
      if (events183.length === 0) return null;
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: "Return an event from a discard pile to its owner's hand?",
        yesLabel: "Return",
        noLabel: "Skip",
        onYes: {
          type: "return-from-discard",
          cardId,
          player,
          maxCount: 1,
          eligiblePlayIds: events183.map(d => d.playId),
          continuation: null,
        } satisfies ReturnFromDiscardPending,
        continuation: null,
      } satisfies AbilityOptionPending;
    }
    case "SOR_197": { // Lando Calrissian (Responsible Businessman) — Return up to 2 friendly resources to hand.
      const gs197 = game.currentGameState;
      const friendlyResources197 = (player === 1 ? gs197.player1 : gs197.player2).resources;
      if (friendlyResources197.length === 0) return null;
      return {
        type: "give-xp-multiple",
        cardId,
        player,
        maxCount: 2,
        eligiblePlayIds: friendlyResources197.map(r => r.playId),
        continuation: null,
      } satisfies GiveXpMultiplePending;
    }
    case "SOR_209": { // Pirated Starfighter (Kylo Ren) — Return a friendly non-leader unit to its owner's hand.
      const friendlyNonLeaders209 = GetUnitsForPlayer(player).filter(u => !CardIsLeader(u.cardId));
      if (friendlyNonLeaders209.length === 0) return null;
      return mandatoryTarget(cardId, player, friendlyNonLeaders209.map(u => u.playId));
    }
    case "SOR_058": // Vigilance — Choose two, in any order (Discard 6 / Heal 5 base / Defeat ≤3HP / Give Shield)
      return {
        type: "choose-aspect-effect",
        cardId,
        player,
        remainingEffects: ["mill_6_opponent_deck", "heal_5_base", "defeat_unit_3hp", "give_shield"],
        continuation: null,
      } satisfies ChooseAspectEffectPending;
    case "SOR_107": // Command — Choose two, in any order (Give 2XP / Power damage / Play as resource / Return from discard)
      return {
        type: "choose-aspect-effect",
        cardId,
        player,
        remainingEffects: ["give_2_xp", "power_damage_enemy", "play_as_resource", "return_from_discard"],
        continuation: null,
      } satisfies ChooseAspectEffectPending;
    case "SOR_155": // Aggression — Choose two, in any order (Draw / Defeat upgrades / Ready ≤3 power / Deal 4 damage)
      return {
        type: "choose-aspect-effect",
        cardId,
        player,
        remainingEffects: ["draw_card", "defeat_upgrades", "ready_unit_3pow", "deal_4_damage"],
        continuation: null,
      } satisfies ChooseAspectEffectPending;
    case "SOR_203": // Cunning — Choose two, in any order (Bounce ≤4 power / +4/+0 / Exhaust 2 / Random discard)
      return {
        type: "choose-aspect-effect",
        cardId,
        player,
        remainingEffects: ["bounce_unit_4pow", "buff_4_attack", "exhaust_2_units", "random_discard"],
        continuation: null,
      } satisfies ChooseAspectEffectPending;
    default:
      return null;
  }
}