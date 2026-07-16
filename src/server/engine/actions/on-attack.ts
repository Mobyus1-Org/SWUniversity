import { PlayerId } from "@/lib/engine/core-models";
import { Unit } from "@/server/engine/unit";
import { OnAttackOrderPending, OnAttackTriggerEntry, PendingResolution, ResolveAttackPending, SpreadDamagePending, GiveXpMultiplePending, SpreadHealPending, MillPending } from "@/server/engine/pending-resolution";
import { AllGroundUnits, AllSpaceUnits, AllUnits, GetGame, GetUnitsForPlayer, GetLeaderForPlayer, InitiativePlayer, TraitContains, CardIsLeader, UnitAttackedThisPhase, UnitWasDefeatedThisPhase, CardWasPlayedThisPhase, HasOnAttack, UpgradeGrantsOnAttack, GetCurrentEffectsForPlayer, CanDisclose, chooseAndDefeatUnit, mandatoryTarget, optionalTarget, searchDeck, buildVaneeAbility, buildTakeControlOfUpgrade, DealDamageToUnit, DrawCardForPlayer, PlayerControlsCardWithTitle, CanDiscloseAnyOf, SEC_004_ASPECTS, LAWBRINGER_ASPECTS, GivePowerMod } from "@/server/engine/core-functions";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";
import { AttackAbilityCardIds } from "@/server/engine/card-db/keyword-dictionaries.ts/support";
import { CardCost, CardTitle, CardIsUnique, CardAspects } from "@/server/engine/card-db/generated";
import { CardTraits } from "@/server/engine/card-db/generated";
import { applyDarksaberOnAttack } from "../on-attack-helper";
import { IsPilotUpgrade } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { CreateCloneTrooper, CreateBattleDroid } from "@/server/engine/token-helpers";

/**
 * On Attack abilities — called after the attack target is chosen.
 * Returns a PendingResolution if the ability requires player input, or null
 * if no ability triggers for this attacker.
 * The `continuation` is the ResolveAttackPending that executes combat once
 * the on-attack ability finishes resolving.
 *
 * Pass `skipOrderingPrompt: true` when calling for the last remaining trigger
 * after the player already resolved earlier triggers from an on-attack-order choice.
 */
export function resolveOnAttackTrigger(
  attacker: Unit,
  continuation: ResolveAttackPending,
  opts: { skipOrderingPrompt?: boolean } = {},
): PendingResolution | null {
  const activeUpgrades = attacker.upgrades.filter(u => UpgradeGrantsOnAttack(u.cardId, u.controller, u.playId));
  const unitHasOnAttack = HasOnAttack(attacker.cardId, attacker.controller, attacker.playId);
  const hasOtherTrigger = activeUpgrades.length > 0 || unitHasOnAttack;

  // When attacking a unit with two or more simultaneous On-Attack triggers, give the active
  // player an ordering choice before resolving any of them.
  if (!opts.skipOrderingPrompt && hasOtherTrigger && continuation.target.type === "unit") {
    const targetPlayId = continuation.target.playId;
    const hasSab = (() => {
      try { return HasSaboteur(attacker.cardId, attacker.playId, attacker.controller); }
      catch { return false; }
    })();
    if (hasSab) {
      // Saboteur is a keyword, not a free-standing trigger. Its only *orderable* part is the
      // triggered ability "defeat the defender's Shield tokens" — which does nothing, and so
      // shouldn't appear in the ordering, unless the defender actually has Shields. (The
      // Sentinel-ignoring half is a constant ability, handled at target selection.)
      const defenderUnit = AllUnits().find(u => u.playId === targetPlayId);
      const saboteurHasEffect = !!defenderUnit?.upgrades.some(u => u.cardId === "SOR_T02");

      const triggers: OnAttackTriggerEntry[] = [];
      if (saboteurHasEffect) triggers.push({ cardId: "saboteur", label: `${CardTitle(attacker.cardId)} — Saboteur` });
      triggers.push(...activeUpgrades.map(u => ({ cardId: u.cardId, label: `${CardTitle(u.cardId)} — On Attack` })));
      if (HasOnAttack(attacker.cardId)) triggers.push({ cardId: attacker.cardId, label: `${CardTitle(attacker.cardId)} — On Attack` });

      // Only prompt when there is a genuine ordering choice (2+ triggers). With Saboteur
      // excluded as a no-op, a lone remaining trigger just resolves normally below.
      if (triggers.length >= 2) {
        return {
          type: "on-attack-order",
          attackerPlayId: attacker.playId,
          player: attacker.controller,
          triggers,
          continuation,
        } satisfies OnAttackOrderPending;
      }
    }
  }

  // Effect-granted On Attack abilities
  for(const currentEffect of GetCurrentEffectsForPlayer(attacker.controller)) {
    if (currentEffect.targetPlayId && currentEffect.targetPlayId !== attacker.playId) continue;
    switch (currentEffect.cardId) {
      case "JTL_156": { // Trench Run grants the attacker: "On Attack: Discard 2 cards from the
                        // defending player's deck. Deal unpreventable damage equal to the
                        // difference in the discarded cards' costs to this unit."
        const game156 = GetGame();
        if (!game156) break;
        const gs156 = game156.currentGameState;
        // The defending player is whoever owns the attack's target.
        const opponent156: PlayerId = attacker.controller === 1 ? 2 : 1;
        const target156 = continuation.target;
        const defender156: PlayerId = target156.type === "base"
          ? target156.player
          : (AllUnits().find(u => u.playId === target156.playId)?.controller ?? opponent156);
        const defState156 = defender156 === 1 ? gs156.player1 : gs156.player2;

        const discarded156: string[] = [];
        for (let i = 0; i < 2; i++) {
          const top = defState156.deck.pop(); // the top of the deck is the END of the array
          if (!top) break;
          discarded156.push(top.cardId);
          defState156.discard.unshift({
            cardId: top.cardId,
            playId: String(gs156.nextPlayId++),
            owner: defender156,
            controller: defender156,
            turnDiscarded: gs156.currentRound,
            discardEffect: "",
          });
        }
        if (discarded156.length > 0) {
          game156.gameLog.push(`${CardTitle("JTL_156")}: discarded ${discarded156.map(c => CardTitle(c)).join(", ")} from player ${defender156}'s deck.`);
        }
        // "the difference in the discarded cards' costs" — needs both cards to have a difference.
        if (discarded156.length === 2) {
          const diff156 = Math.abs(CardCost(discarded156[0]) - CardCost(discarded156[1]));
          if (diff156 > 0) {
            // Unpreventable: applied straight to the unit, ignoring Shields and any prevention.
            const self156 = GetUnitsForPlayer(attacker.controller).find(u => u.playId === attacker.playId);
            if (self156) {
              self156.damage += diff156;
              game156.gameLog.push(`${CardTitle("JTL_156")}: dealt ${diff156} unpreventable damage to ${CardTitle(attacker.cardId)}.`);
            }
          }
        }
        break;
      }
    }
  }

  //Upgrade-granted On Attack abilities
  for (const upgrade of activeUpgrades) {
    switch (upgrade.cardId) {
      case "JTL_018": // Kazuda Xiono piloting — same On Attack as his deployed side.
        return kazudaSilencePending(attacker, continuation);
      case "JTL_012": { // Luke Skywalker piloting a Fighter — "On Attack: You may deal 3 damage to a unit."
        const allUnits012 = AllUnits();
        if (allUnits012.length > 0) {
          return optionalTarget("JTL_012_pilot", attacker.controller, allUnits012.map(u => u.playId),
            "Deal 3 damage to a unit?", { continuation });
        }
        break;
      }
      case "SOR_121": { // Hardpoint Heavy Blaster
        if (continuation.target.type === "unit") {
          const defenderPlayId = continuation.target.playId;
          const inGround = AllGroundUnits().some(u => u.playId === defenderPlayId);
          const arenaUnits = inGround ? AllGroundUnits() : AllSpaceUnits();
          if (arenaUnits.length > 0) {
            return optionalTarget("SOR_121", attacker.controller, arenaUnits.map(u => u.playId),
              "Deal 2 damage to a unit in the defender's arena?", { continuation });
          }
        }
        break;
      }
      case "SOR_214": { // Smuggling Compartment — On Attack: Ready a resource.
        const game214 = GetGame();
        if (game214) {
          const pState214 = attacker.controller === 1 ? game214.currentGameState.player1 : game214.currentGameState.player2;
          const exhausted214 = pState214.resources.find(r => !r.ready);
          if (exhausted214) {
            exhausted214.ready = true;
            game214.gameLog.push(`${CardTitle("SOR_214")}: readied a resource.`);
          }
        }
        break;
      }
      case "SOR_054": { // Jedi Lightsaber — if attached unit is Force, give defender -2/-2 for this phase
        if (TraitContains(attacker.cardId, "Force", attacker.controller, attacker.playId)
          && continuation.target.type === "unit") {
          const defPlayId054 = continuation.target.playId;
          const defender054 = AllUnits().find(u => u.playId === defPlayId054);
          const game054 = GetGame();
          if (defender054 && game054) {
            game054.currentGameState.currentEffects.push({
              cardId: "SOR_054",
              duration: "Phase",
              affectedPlayer: defender054.controller,
              targetPlayId: defPlayId054,
            });
            game054.gameLog.push(`${CardTitle("SOR_054")}: defender gets –2/–2 for this phase.`);
          }
        }
        break;
      }
      case "SOR_137": { // Fallen Lightsaber — if attached unit is Force, deal 1 damage to each defending player's ground unit
        if (TraitContains(attacker.cardId, "Force", attacker.controller, attacker.playId)) {
          const game137 = GetGame();
          if (game137) {
            const gs137 = game137.currentGameState;
            const defPlayer137 = attacker.controller === 1 ? 2 : 1;
            const defGround137 = [...(defPlayer137 === 1 ? gs137.player1.groundArena : gs137.player2.groundArena)];
            for (const groundUnit of defGround137) {
              DealDamageToUnit(gs137, "SOR_137", groundUnit.playId, 1, game137.gameLog);
            }
            if (defGround137.length > 0) {
              game137.gameLog.push(`${CardTitle("SOR_137")}: dealt 1 damage to each of the defending player's ground units.`);
            }
          }
        }
        break;
      }
      case "SEC_264": { // Clandestine Connections — On Attack: You may pay 2 resources. If you do, deal 2 damage to a base.
        const game264 = GetGame();
        if (!game264) break;
        const pState264 = attacker.controller === 1 ? game264.currentGameState.player1 : game264.currentGameState.player2;
        const ready264 = pState264.resources.filter(r => r.ready).length;
        const credits264 = pState264.supplemental.creditTokens ?? 0;
        if (ready264 + credits264 < 2) break; // can't afford
        return {
          type: "ability-option",
          cardId: "SEC_264",
          player: attacker.controller,
          sourcePlayId: attacker.playId,
          helperText: "Pay 2 to deal 2 damage to a base?",
          yesLabel: "Pay 2",
          noLabel: "Skip",
          onYes: null,
          continuation,
        };
      }
      case "SHD_126": { // The Darksaber
        applyDarksaberOnAttack(attacker);
        break;
      }
      case "SHD_177": { // Vambrace Flamethrower
        const game = GetGame();
        if (game) {
          const gs = game.currentGameState;
          const opponent = attacker.controller === 1 ? 2 : 1;
          const enemyGround = (opponent === 1 ? gs.player1.groundArena : gs.player2.groundArena)
            .map(u => u.playId);
          if (enemyGround.length > 0) {
            const spreadPending: SpreadDamagePending = {
              type: "spread-damage",
              cardId: "SHD_177",
              player: attacker.controller,
              totalDamage: 3,
              optional: true,
              eligiblePlayIds: enemyGround,
              continuation,
            };
            return {
              type: "ability-option",
              cardId: "SHD_177",
              helperText: "Deal 3 damage divided among enemy ground units?",
              onYes: spreadPending,
              continuation,
            };
          }
        }
        break;
      }
    }
  }
  // Innate On Attack abilities — the attacker's own, plus any it gained from a Support unit for
  // this attack. The granted ability resolves with `attacker` as its subject, so "this unit" in
  // the borrowed text correctly means the unit that is attacking.
  let resolved = activeUpgrades.length > 0;
  for (const sourceCardId of AttackAbilityCardIds(attacker)) {
    const pending = resolveInnateOnAttack(sourceCardId, attacker, continuation);
    if (pending === null) continue;              // this source has no On Attack ability
    if (pending === continuation) { resolved = true; continue; } // it fizzled (no legal target)
    return pending;                              // it needs player input
  }
  // An upgrade-only or fizzled trigger still means combat proceeds; nothing at all means no trigger.
  return resolved ? continuation : null;
}

/**
 * Resolves the On Attack ability printed on `sourceCardId`, applied to `attacker`.
 * `sourceCardId` is normally the attacker's own cardId, but is the supporter's when the attacker
 * gained its abilities via Support.
 */
function resolveInnateOnAttack(
  sourceCardId: string,
  attacker: Unit,
  continuation: ResolveAttackPending,
): PendingResolution | null {
  switch (sourceCardId) {
    case "ASH_189": { // Emperor's Messenger — "On Attack: Ready a resource." Mandatory and
                      // targetless: resources are interchangeable, so ready the first exhausted one.
      const game189 = GetGame();
      if (!game189) return continuation;
      const player189 = attacker.controller === 1
        ? game189.currentGameState.player1
        : game189.currentGameState.player2;
      const exhausted189 = player189.resources.find(r => !r.ready);
      if (exhausted189) {
        exhausted189.ready = true;
        game189.gameLog.push(`${CardTitle("ASH_189")}: readied a resource.`);
      }
      return continuation;
    }
    case "LAW_101": { // Lawbringer — "On Attack: Choose an aspect. Give each enemy unit with that
                      // aspect –2/–2 for this phase." (Same effect as its When Played.)
      return {
        type: "ability-target",
        cardId: "LAW_101",
        player: attacker.controller,
        fromPlayIds: [],
        fromChoices: LAWBRINGER_ASPECTS,
        continuation,
      };
    }
    case "SEC_015": { // C-3PO (deployed) — "On Attack: If you control another exhausted unit, you
                      // may exhaust a unit." Condition: an exhausted unit other than the attacker.
      const hasOtherExhausted015 = GetUnitsForPlayer(attacker.controller)
        .some(u => u.playId !== attacker.playId && !u.ready);
      if (!hasOtherExhausted015) return continuation;
      const allUnits015 = AllUnits();
      if (allUnits015.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: "SEC_015",
        player: attacker.controller,
        helperText: "Exhaust a unit?",
        yesLabel: "Exhaust",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: "SEC_015",
          player: attacker.controller,
          fromPlayIds: allUnits015.map(u => u.playId),
          continuation,
        },
        continuation,
      };
    }
    case "TWI_002": { // Nute Gunray (deployed) — "On Attack: Create a Battle Droid token."
      const game002 = GetGame();
      if (game002) CreateBattleDroid(game002.currentGameState, attacker.controller, game002.gameLog, "TWI_002");
      return continuation;
    }
    case "TWI_014": { // Asajj Ventress (deployed) — "On Attack: If you played an event this phase,
                      // this unit gets +1/+0 for this attack and deals combat damage before the
                      // defender." (first strike)
      const game014 = GetGame();
      if (game014 && CardWasPlayedThisPhase(attacker.controller, undefined, "Event")) {
        game014.currentGameState.currentEffects.push({ cardId: "TWI_014", duration: "ForAttack", affectedPlayer: attacker.controller, targetPlayId: attacker.playId });
        game014.currentGameState.currentEffects.push({ cardId: "SOR_217_first_strike", duration: "ForAttack", affectedPlayer: attacker.controller, targetPlayId: attacker.playId });
        game014.gameLog.push(`${CardTitle("TWI_014")}: +1/+0 and first strike for this attack (event played this phase).`);
      }
      return continuation;
    }
    case "TWI_006": { // Wat Tambor (deployed) — "On Attack: If a friendly unit was defeated this
                      // phase, you may give another unit +2/+2 for this phase."
      if (!UnitWasDefeatedThisPhase(attacker.controller)) return continuation;
      const others006 = AllUnits().filter(u => u.playId !== attacker.playId);
      if (others006.length === 0) return continuation;
      return optionalTarget("TWI_006", attacker.controller, others006.map(u => u.playId),
        "Give another unit +2/+2 for this phase?", { yesLabel: "Give +2/+2", continuation });
    }
    case "SOR_008": { // Hera Syndulla (deployed) — "On Attack: You may give an Experience token to
                      // another unique unit."
      const uniqueOthers008 = AllUnits()
        .filter(u => u.playId !== attacker.playId && CardIsUnique(u.cardId));
      if (uniqueOthers008.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: "SOR_008",
        player: attacker.controller,
        helperText: "Give an Experience token to another unique unit?",
        yesLabel: "Give Experience",
        noLabel: "Skip",
        onYes: {
          type: "give-xp-multiple",
          cardId: "SOR_008",
          player: attacker.controller,
          maxCount: 1,
          eligiblePlayIds: uniqueOthers008.map(u => u.playId),
          continuation,
        } satisfies GiveXpMultiplePending,
        continuation,
      };
    }
    case "LAW_048": { // Chio Fain — "On Attack: You may choose 2 players. If you do, they each draw
                      // a card." With only two players, that is simply: both players may each draw.
      return {
        type: "ability-option",
        cardId: "LAW_048",
        player: attacker.controller,
        helperText: "Both players each draw a card?",
        yesLabel: "Both draw",
        noLabel: "Skip",
        onYes: null,
        continuation,
      };
    }
    case "LOF_037": { // Darth Vader — "On Attack: Defeat an enemy unit with a Shield token on it."
                      // Mandatory when there is a valid target (a shielded enemy, which may be a
                      // leader unit and need not be the defender). Resolves before combat damage.
      const shieldedEnemies037 = GetUnitsForPlayer(attacker.controller === 1 ? 2 : 1)
        .filter(u => u.upgrades.some(up => up.cardId === "SOR_T02"));
      if (shieldedEnemies037.length === 0) return continuation;
      return mandatoryTarget("LOF_037_OA", attacker.controller, shieldedEnemies037.map(u => u.playId), continuation);
    }
    case "ASH_009": { // Ahsoka Tano (deployed) — "On Attack: You may give a unit with less power
                      // than this unit +2/+0 for this phase."
      const weaker009 = AllUnits().filter(u =>
        Unit.FromInterface(u).CurrentPower() < attacker.CurrentPower(),
      );
      if (weaker009.length === 0) return continuation;
      return optionalTarget("ASH_009", attacker.controller, weaker009.map(u => u.playId),
        "Give a unit with less power +2/+0 for this phase?", { continuation });
    }
    case "ASH_014": { // The Mandalorian (deployed) — "On Attack: If you have the initiative, you may
                      // draw a card."
      const game014 = GetGame();
      if (!game014 || InitiativePlayer() !== attacker.controller) return continuation;
      return {
        type: "ability-option",
        cardId: "ASH_014",
        player: attacker.controller,
        sourcePlayId: attacker.playId,
        helperText: "Draw a card?",
        yesLabel: "Draw",
        noLabel: "Skip",
        onYes: null,
        continuation,
      };
    }
    case "ASH_072": { // Doctor Pershing — "On Attack: If this unit has 3 or more remaining HP, draw a card."
      const game072 = GetGame();
      if (!game072) return continuation;
      if (attacker.CurrentHP() >= 3) {
        DrawCardForPlayer(game072.currentGameState, game072.gameLog, attacker.controller);
        game072.gameLog.push(`${CardTitle("ASH_072")}: drew a card.`);
      }
      return continuation;
    }
    case "ASH_059": { // Leia Organa — "On Attack: You may deal 1 damage to this unit. If you do,
                      // heal 2 damage from your base."
      return {
        type: "ability-option",
        cardId: "ASH_059",
        player: attacker.controller,
        sourcePlayId: attacker.playId,
        helperText: `Deal 1 damage to ${CardTitle(attacker.cardId)} to heal 2 damage from your base?`,
        yesLabel: "Deal 1 damage",
        noLabel: "Skip",
        onYes: null,
        continuation,
      };
    }
    case "ASH_099": { // Gozanti Assault Carrier — "On Attack: This unit gains Sentinel for this phase."
      const game099 = GetGame();
      if (!game099) return continuation;
      game099.currentGameState.currentEffects.push({
        cardId: "ASH_099",
        duration: "Phase",
        affectedPlayer: attacker.controller,
        targetPlayId: attacker.playId,
      });
      game099.gameLog.push(`${CardTitle("ASH_099")}: gained Sentinel for this phase.`);
      return continuation;
    }
    case "ASH_203": { // Mando's N-1 Starfighter — "On Attack: You may exhaust a friendly (non-upgrade)
                      // leader. If you do, this unit gets +2/+0 for this attack."
      const leader203 = GetLeaderForPlayer(attacker.controller);
      // "non-upgrade leader": a leader piloting a unit is an upgrade, so it can't be exhausted here.
      const leaderIsUpgrade203 = AllUnits().some(u => u.upgrades.some(up => up.cardId === leader203.cardId));
      if (!leader203.ready || leaderIsUpgrade203) return continuation;
      return {
        type: "ability-option",
        cardId: "ASH_203",
        player: attacker.controller,
        sourcePlayId: attacker.playId,
        helperText: `Exhaust ${CardTitle(leader203.cardId)} to give ${CardTitle(attacker.cardId)} +2/+0 for this attack?`,
        yesLabel: "Exhaust leader",
        noLabel: "Skip",
        onYes: null,
        continuation,
      };
    }
    case "ASH_209": { // Ezra Bridger — "On Attack: If this unit is upgraded, you may give a unit
                      // –3/–0 for this phase."
      if (attacker.upgrades.length === 0) return continuation;
      const allUnits209 = AllUnits();
      if (allUnits209.length === 0) return continuation;
      return optionalTarget("ASH_209", attacker.controller, allUnits209.map(u => u.playId),
        "Give a unit –3/–0 for this phase?", { continuation });
    }
    case "ASH_253": { // Yellow Aces Bomber — "On Attack: If this unit is upgraded, deal 2 damage to a base."
      if (attacker.upgrades.length === 0) return continuation;
      return {
        type: "ability-target",
        cardId: "ASH_253",
        player: attacker.controller,
        fromPlayIds: [],
        fromZones: ["Base"],
        continuation,
      };
    }
    case "LOF_082": // Vaneé — When Played/On Attack: may defeat an XP token on a friendly unit, then give one to a friendly unit.
      return buildVaneeAbility(attacker.controller, continuation) ?? continuation;
    case "LOF_003": { // Ahsoka Tano (deployed) — On Attack: you may give a friendly unit Sentinel for this phase.
      const friendly003 = GetUnitsForPlayer(attacker.controller);
      if (friendly003.length === 0) return continuation;
      return optionalTarget("LOF_003", attacker.controller, friendly003.map(u => u.playId),
        "Give a friendly unit Sentinel for this phase?", { continuation });
    }
    case "JTL_056": // Hondo Ohnaka — On Attack: You may take control of a non-Pilot upgrade on a unit and attach it to a different eligible unit.
      return buildTakeControlOfUpgrade(
        "JTL_056",
        attacker.controller,
        upg => !IsPilotUpgrade(upg.cardId),
        "Take control of a non-Pilot upgrade and attach it to a different eligible unit?",
        continuation,
      ) ?? continuation;
    case "SOR_067": { // Rugged Survivors — On Attack: if you control a leader unit, you may draw a card
      const leader067 = GetLeaderForPlayer(attacker.controller);
      if (!leader067.deployed) return continuation;
      return {
        type: "ability-option",
        cardId: attacker.cardId,
        player: attacker.controller,
        helperText: "You may draw a card.",
        yesLabel: "Draw",
        noLabel: "Skip",
        onYes: null,
        continuation,
      };
    }
    case "LAW_173": { // BT-1 — On Attack: Discard a card from your deck. If it's Aggression, you may deal 1 damage to a ground unit.
      const game173 = GetGame();
      if (!game173) return continuation;
      const deck173 = (attacker.controller === 1 ? game173.currentGameState.player1 : game173.currentGameState.player2).deck;
      if (deck173.length === 0) return continuation;
      return {
        type: "mill",
        cardId: attacker.cardId,
        player: attacker.controller,
        millingPlayer: attacker.controller, // discard from your OWN deck
        count: 1,
        continuation,
      } satisfies MillPending;
    }
    case "JTL_186": { // Mist Hunter — On Attack: If you played a Bounty Hunter or Pilot card this phase, you may draw a card.
      if (!CardWasPlayedThisPhase(attacker.controller, "Bounty Hunter")
          && !CardWasPlayedThisPhase(attacker.controller, "Pilot")) return continuation;
      return {
        type: "ability-option",
        cardId: attacker.cardId,
        player: attacker.controller,
        helperText: "You may draw a card.",
        yesLabel: "Draw",
        noLabel: "Skip",
        onYes: null,
        continuation,
      };
    }
    case "LAW_174": { // 0-0-0 — On Attack: You may put an Aggression card from your discard pile on the bottom of your deck. If you do, deal 1 damage to each enemy base.
      const game174 = GetGame();
      if (!game174) return continuation;
      const discard174 = (attacker.controller === 1 ? game174.currentGameState.player1 : game174.currentGameState.player2).discard;
      const aggression174 = discard174.filter(d => CardAspects(d.cardId).includes("Aggression"));
      if (aggression174.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: attacker.cardId,
        player: attacker.controller,
        helperText: "Put an Aggression card from your discard on the bottom of your deck and deal 1 damage to each enemy base?",
        yesLabel: "Yes",
        noLabel: "Skip",
        onYes: {
          type: "return-from-discard",
          cardId: "LAW_174",
          player: attacker.controller,
          maxCount: 1,
          eligiblePlayIds: aggression174.map(d => d.playId),
          continuation,
        },
        continuation,
      };
    }
    case "LAW_238": { // Scavenging Sandcrawler — On Attack: you may put a card from your discard on the bottom of your deck; if you do, create a Credit token.
      const game238 = GetGame();
      if (!game238) return continuation;
      const gs238 = game238.currentGameState;
      const discard238 = (attacker.controller === 1 ? gs238.player1 : gs238.player2).discard;
      if (discard238.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: attacker.cardId,
        player: attacker.controller,
        helperText: "Put a card from your discard pile on the bottom of your deck and create a Credit token?",
        yesLabel: "Yes",
        noLabel: "Skip",
        onYes: {
          type: "return-from-discard",
          cardId: "LAW_238",
          player: attacker.controller,
          maxCount: 1,
          eligiblePlayIds: discard238.map(d => d.playId),
          continuation,
        },
        continuation,
      };
    }
    case "SOR_056": { // Bendu — next non-Heroism non-Villainy card you play this phase costs 2 less
      const game056 = GetGame();
      if (game056) {
        game056.currentGameState.currentEffects.push({
          cardId: "SOR_056",
          duration: "Phase",
          affectedPlayer: attacker.controller,
        });
        game056.gameLog.push(`${CardTitle("SOR_056")}: the next non-Heroism, non-Villainy card you play this phase costs 2 less.`);
      }
      return continuation;
    }
    case "SEC_110": { // GNK Power Droid — the next unit you play this phase costs 1 resource less
      const game110 = GetGame();
      if (game110) {
        game110.currentGameState.currentEffects.push({
          cardId: "SEC_110",
          duration: "Phase",
          affectedPlayer: attacker.controller,
        });
        game110.gameLog.push(`${CardTitle("SEC_110")}: the next unit you play this phase costs 1 resource less.`);
      }
      return continuation;
    }
    case "SOR_179": { // Boba Fett — if attacking an exhausted unit that didn't enter play this round, deal 3 damage.
      if (continuation.target.type !== "unit") return continuation;
      const defPlayId179 = continuation.target.playId;
      const game179 = GetGame();
      if (!game179) return continuation;
      const gs179 = game179.currentGameState;
      const defender179 = gs179.player1.groundArena.find(u => u.playId === defPlayId179)
        ?? gs179.player2.groundArena.find(u => u.playId === defPlayId179);
      if (
        defender179 &&
        !defender179.ready &&
        !gs179.roundState.cardsEnteredPlayThisPhase.some(c => c.playId === defender179.playId)
      ) {
        DealDamageToUnit(gs179, "SOR_179", defender179.playId, 3, game179.gameLog);
      }
      return continuation;
    }
    case "SOR_119": { // Reinforcement Walker — look at top card; draw (Yes) or discard + heal 3 (No).
      const game119 = GetGame();
      if (!game119) return continuation;
      const deck119 = attacker.controller === 1
        ? game119.currentGameState.player1.deck
        : game119.currentGameState.player2.deck;
      if (deck119.length === 0) return continuation;
      const topCard = deck119[deck119.length - 1];
      return {
        type: "ability-option",
        cardId: attacker.cardId,
        player: attacker.controller,
        helperText: `Draw ${CardTitle(topCard.cardId)}? Or discard it and heal 3 from your base.`,
        yesLabel: "Draw",
        noLabel: "Discard + Heal 3",
        onYes: null,
        continuation,
      };
    }
    case "SOR_188": { // Chopper — On Attack: Discard 1 card from the defending player's deck; if event, exhaust a resource.
      const game188 = GetGame();
      if (!game188) return continuation;
      const defenderPlayer188 = attacker.controller === 1 ? 2 : 1;
      const defenderState188 = game188.currentGameState[`player${defenderPlayer188}` as "player1" | "player2"];
      if (defenderState188.deck.length === 0) return continuation;
      return {
        type: "mill",
        cardId: attacker.cardId,
        player: attacker.controller,
        millingPlayer: defenderPlayer188,
        count: 1,
        continuation,
      } satisfies MillPending;
    }
    case "SOR_047": { // Kanan Jarrus — On Attack: You may discard 1 card from the defending player's deck
      // for each friendly SPECTRE unit. Heal 1 damage from your base for each different aspect.
      const game047 = GetGame();
      if (!game047) return continuation;
      const spectreCount = GetUnitsForPlayer(attacker.controller)
        .filter(u => CardTraits(u.cardId).includes("Spectre")).length;
      if (spectreCount === 0) return continuation;
      const defenderPlayer = attacker.controller === 1 ? 2 : 1;
      const defenderState = defenderPlayer === 1
        ? game047.currentGameState.player1
        : game047.currentGameState.player2;
      if (defenderState.deck.length === 0) return continuation;
      const millPending: MillPending = {
        type: "mill",
        cardId: attacker.cardId,
        player: attacker.controller,
        millingPlayer: defenderPlayer,
        count: spectreCount,
        continuation,
      };
      return {
        type: "ability-option",
        cardId: attacker.cardId,
        helperText: `Discard ${spectreCount} card(s) from the defending player's deck and heal your base for each different aspect?`,
        onYes: millPending,
        continuation,
      };
    }
    case "SOR_236": // R2-D2 — On Attack: Scry 1.
      return searchDeck("SOR_236", attacker.controller, 1, "scry", { continuation }) ?? continuation;
    case "SOR_040": { // Avenger On Attack — opponent chooses a non-leader unit they control to defeat.
      return chooseAndDefeatUnit("SOR_040", attacker.controller, false, continuation);
    }
    case "SEC_188": { // Darth Traya "On Attack: You may ready a non-unit leader."
      const game188 = GetGame();
      if (!game188) return continuation;
      const gs188 = game188.currentGameState;
      // "non-unit leader" = still in the leader zone (not deployed), and only an exhausted
      // one is worth readying. Either player's leader is a legal target.
      const eligible188: string[] = [];
      if (!gs188.player1.leader.deployed && !gs188.player1.leader.ready) eligible188.push("player1.leader");
      if (!gs188.player2.leader.deployed && !gs188.player2.leader.ready) eligible188.push("player2.leader");
      if (eligible188.length === 0) return continuation;
      return optionalTarget("SEC_188", attacker.controller, eligible188,
        "You may ready a non-unit leader.", { continuation });
    }
    case "LOF_045": { // Yaddle "On Attack: Each other friendly Jedi unit gains Restore 1 for this phase."
      const game045 = GetGame();
      if (!game045) return continuation;
      const otherJedi = GetUnitsForPlayer(attacker.controller).filter(
        u => u.playId !== attacker.playId && TraitContains(u.cardId, "Jedi", attacker.controller, u.playId),
      );
      // One targeted effect per unit — RestoreAmount() reads these by targetPlayId.
      for (const jedi of otherJedi) {
        game045.currentGameState.currentEffects.push({
          cardId: "LOF_045",
          duration: "Phase",
          affectedPlayer: attacker.controller,
          targetPlayId: jedi.playId,
        });
      }
      if (otherJedi.length > 0) {
        game045.gameLog.push(`${CardTitle("LOF_045")}: ${otherJedi.length} other friendly Jedi unit(s) gained Restore 1 this phase.`);
      }
      return continuation;
    }
    case "SEC_004": { // Leia Organa (deployed) — "On Attack: You may disclose ... If you do, give an
                      // Experience token to a unit that doesn't share an aspect with the disclosed card."
      if (!CanDiscloseAnyOf(attacker.controller, SEC_004_ASPECTS)) return continuation;
      return {
        type: "ability-option",
        cardId: "SEC_004",
        player: attacker.controller,
        sourcePlayId: attacker.playId,
        helperText: "Disclose an aspect to give an Experience token to a unit that doesn't share it?",
        yesLabel: "Disclose",
        noLabel: "Skip",
        onYes: { type: "play-from-hand", cardId: "SEC_004", player: attacker.controller },
        continuation,
      };
    }
    case "LOF_002": { // Mother Talzin (deployed) — "On Attack: You may give a unit -1/-1 for this phase."
      const units002 = AllUnits();
      if (units002.length === 0) return continuation;
      return optionalTarget("LOF_002", attacker.controller, units002.map(u => u.playId),
        "Give a unit -1/-1 for this phase?", { continuation });
    }
    case "JTL_147": { // Black One "On Attack: If you control Poe Dameron (as a unit, upgrade, or
                      // leader), you may deal 1 damage to a unit."
      if (!PlayerControlsCardWithTitle(attacker.controller, "Poe Dameron")) return continuation;
      return optionalTarget("JTL_147", attacker.controller, AllUnits().map(u => u.playId),
        "You may deal 1 damage to a unit.", { continuation });
    }
    case "JTL_151": { // Red Five "On Attack: You may deal 2 damage to a damaged unit."
      const damaged151 = AllUnits().filter(u => u.damage > 0);
      if (damaged151.length === 0) return continuation; // nothing damaged — no prompt
      return optionalTarget("JTL_151", attacker.controller, damaged151.map(u => u.playId),
        "You may deal 2 damage to a damaged unit.", { continuation });
    }
    case "SOR_010": { // Darth Vader "On Attack: You may deal 2 damage to a unit."
      return optionalTarget("SOR_010", attacker.controller, AllUnits().map(u => u.playId),
        "You may deal 2 damage to a unit.", { continuation });
    }
    case "SOR_131": { // Fifth Brother "On Attack: You may deal 1 damage to this unit and 1 damage to another ground unit."
      const otherGround131 = AllGroundUnits().filter(u => u.playId !== attacker.playId);
      return {
        type: "ability-option",
        cardId: "SOR_131",
        player: attacker.controller,
        helperText: "Deal 1 damage to Fifth Brother and 1 damage to another ground unit?",
        yesLabel: "Deal",
        noLabel: "Skip",
        onYes: otherGround131.length > 0
          ? { type: "ability-target", cardId: "SOR_131", player: attacker.controller, sourcePlayId: attacker.playId, fromPlayIds: otherGround131.map(u => u.playId), continuation }
          : { type: "ability-target", cardId: "SOR_131_self", player: attacker.controller, sourcePlayId: attacker.playId, fromPlayIds: [attacker.playId], continuation },
        continuation,
      };
    }
    case "TWI_094": { // Shaak Ti — On Attack: Create a Clone Trooper token.
      const game094 = GetGame();
      if (game094) CreateCloneTrooper(game094.currentGameState, attacker.controller, game094.gameLog, attacker.cardId);
      return continuation;
    }
    case "SOR_014": { // Sabine Wren "On Attack: Deal 1 damage to each enemy base."
      const game = GetGame();
      if (!game) return continuation;
      const gs = game.currentGameState;
      const opponentId = attacker.controller === 1 ? 2 : 1;
      const opponent = opponentId === 1 ? gs.player1 : gs.player2;
      opponent.base.damage += 1;
      return continuation;
    }
    case "SHD_012": { // Bo-Katan Kryze (deployed) "On Attack: You may deal 1 damage to a unit. If you attacked with another Mandalorian unit this phase, you may deal 1 damage to a unit."
      const allUnitPlayIds = AllUnits().map(u => u.playId);

      // "another Mandalorian" = a Mandalorian other than Bo-Katan herself
      const anotherMandalorianAttacked = UnitAttackedThisPhase(attacker.controller, "Mandalorian", true, attacker.playId);

      const secondStep: PendingResolution = anotherMandalorianAttacked
        ? {
            type: "ability-option",
            cardId: "SHD_012_2",
            helperText: "You may deal 1 damage to a unit. (Another Mandalorian attacked this phase.)",
            onYes: {
              type: "ability-target",
              cardId: "SHD_012_2",
              player: attacker.controller,
              fromPlayIds: allUnitPlayIds,
              continuation,
            },
            continuation,
          }
        : continuation;

      return {
        type: "ability-option",
        cardId: "SHD_012",
        helperText: "You may deal 1 damage to a unit.",
        onYes: {
          type: "ability-target",
          cardId: "SHD_012_1",
          player: attacker.controller,
          fromPlayIds: allUnitPlayIds,
          continuation: secondStep,
        },
        continuation: secondStep,
      };
    }
    case "TWI_186": { // San Hill — On Attack: For each friendly unit that was defeated this phase, ready a friendly resource.
      const game186 = GetGame();
      if (!game186) return continuation;
      const gs186 = game186.currentGameState;
      const defeatedCount = gs186.roundState.cardsLeftPlayThisPhase
        .filter(c => c.fromPlayer === attacker.controller && (c.reason === "defeated" || c.reason === "token-defeated"))
        .length;
      if (defeatedCount > 0) {
        const pState186 = attacker.controller === 1 ? gs186.player1 : gs186.player2;
        let readied = 0;
        for (const resource of pState186.resources) {
          if (!resource.ready && readied < defeatedCount) {
            resource.ready = true;
            readied++;
          }
        }
        if (readied > 0)
          game186.gameLog.push(`${CardTitle(attacker.cardId)}: readied ${readied} resource(s).`);
      }
      return continuation;
    }
    case "TWI_005": { // Count Dooku leader unit — On Attack: The next Separatist card you play this phase gains Exploit 3.
      const game = GetGame();
      if (!game) return continuation;
      game.currentGameState.currentEffects.push({
        cardId: "TWI_005-L",
        duration: "Phase",
        affectedPlayer: attacker.controller,
      });
      game.gameLog.push(`${CardTitle(attacker.cardId)}: The next Separatist card you play this phase gains Exploit 3.`);
      return continuation;
    }
    case "SOR_006": { // Emperor Palpatine — "On Attack: You may defeat another friendly unit. If you do, deal 1 damage to a unit and draw a card."
      const friendlies006 = GetUnitsForPlayer(attacker.controller)
        .filter(u => u.playId !== attacker.playId);
      if (friendlies006.length === 0) return continuation;
      const allUnits006 = AllUnits();
      return {
        type: "ability-option",
        cardId: "SOR_006_OA",
        helperText: "You may defeat another friendly unit. If you do, deal 1 damage to a unit and draw a card.",
        onYes: {
          type: "ability-target",
          cardId: "SOR_006_OA",
          player: attacker.controller,
          fromPlayIds: friendlies006.map(u => u.playId),
          continuation: {
            type: "ability-target",
            cardId: "SOR_006_OA2",
            player: attacker.controller,
            fromPlayIds: allUnits006.map(u => u.playId),
            continuation,
          },
        },
        continuation,
      };
    }
    case "JTL_018": // Kazuda Xiono (deployed) — "On Attack: Choose any number of friendly units. They lose all abilities for this round."
      return kazudaSilencePending(attacker, continuation);
    case "LAW_013": { // Chewbacca (deployed) — "On Attack: You may defeat a friendly resource. If you do, deal 2 damage to a unit and create a Credit token."
      const gs013 = GetGame()!.currentGameState;
      const resources013 = (attacker.controller === 1 ? gs013.player1 : gs013.player2).resources;
      if (resources013.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: "LAW_013_OA",
        player: attacker.controller,
        helperText: "You may defeat a friendly resource. If you do, deal 2 damage to a unit and create a Credit token.",
        yesLabel: "Defeat a resource",
        noLabel: "Skip",
        onYes: {
          // Shares the leader Action's resolution chain: defeat the resource, then damage + Credit.
          type: "ability-target",
          cardId: "LAW_013_resource",
          player: attacker.controller,
          fromPlayIds: resources013.map(r => r.playId),
          continuation,
        },
        continuation,
      };
    }
    case "SEC_065": { // Nala Se — On Attack: You may disclose Vigilance×Vigilance. If you do, heal up to 4 from other units.
      if (!CanDisclose(attacker.controller, ["Vigilance", "Vigilance"])) return continuation;
      const otherUnits065 = AllUnits()
        .filter(u => u.playId !== attacker.playId).map(u => u.playId);
      if (otherUnits065.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: attacker.cardId,
        player: attacker.controller,
        helperText: "Disclose Vigilance×Vigilance to heal up to 4 damage from other units?",
        yesLabel: "Disclose",
        noLabel: "Skip",
        onYes: {
          type: "spread-heal",
          cardId: "SEC_065",
          player: attacker.controller,
          maxHeal: 4,
          eligiblePlayIds: otherUnits065,
          continuation,
        } satisfies SpreadHealPending,
        continuation,
      };
    }
    case "SEC_085": { // Vice Admiral Rampart — On Attack: You may disclose CommandCommandVillainy. If you do, give an Experience token to each of up to 2 other units.
      if (!CanDisclose(attacker.controller, ["Command", "Command", "Villainy"])) return continuation;
      const otherUnits085 = AllUnits().filter(u => u.playId !== attacker.playId);
      if (otherUnits085.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: attacker.cardId,
        player: attacker.controller,
        helperText: "Disclose CommandCommandVillainy to give an Experience token to each of up to 2 other units?",
        yesLabel: "Disclose",
        noLabel: "Skip",
        onYes: {
          type: "give-xp-multiple",
          cardId: "SEC_085",
          player: attacker.controller,
          maxCount: 2,
          eligiblePlayIds: otherUnits085.map(u => u.playId),
          continuation,
        } satisfies GiveXpMultiplePending,
        continuation,
      };
    }
    case "SOR_059": { // 2-1B Surgical Droid — On Attack: You may heal 2 damage from another unit.
      const damagedOthers059 = AllUnits()
        .filter(u => u.playId !== attacker.playId && u.damage > 0);
      if (damagedOthers059.length === 0) return continuation;
      return optionalTarget(attacker.cardId, attacker.controller,
        damagedOthers059.map(u => u.playId),
        "Heal 2 damage from another unit?",
        { yesLabel: "Heal 2", sourcePlayId: attacker.playId, continuation });
    }
    case "JTL_004": { // Rose Tico (deployed) — On Attack: You may heal 2 damage from a Vehicle unit.
      const damagedVehicles004 = AllUnits()
        .filter(u => u.damage > 0 && TraitContains(u.cardId, "Vehicle", u.controller, u.playId));
      if (damagedVehicles004.length === 0) return continuation;
      return optionalTarget(attacker.cardId, attacker.controller,
        damagedVehicles004.map(u => u.playId),
        "Heal 2 damage from a Vehicle unit?",
        { yesLabel: "Heal 2", sourcePlayId: attacker.playId, continuation });
    }
    case "LOF_015": { // Cal Kestis (deployed) — On Attack: An opponent chooses a ready unit they
                      // control. Exhaust that unit.
      const opp015 = attacker.controller === 1 ? 2 : 1;
      const readyEnemy015 = GetUnitsForPlayer(opp015).filter(u => u.ready);
      if (readyEnemy015.length === 0) return continuation;
      return {
        type: "ability-target",
        cardId: "LOF_015",
        player: attacker.controller,
        fromPlayIds: readyEnemy015.map(u => u.playId),
        continuation,
      };
    }
    case "LOF_014": { // Grand Inquisitor (deployed) — On Attack: The defender gets -2/-0 for this attack.
      if (continuation.target.type === "unit") {
        const game014 = GetGame();
        const def014 = AllUnits().find(u => u.playId === (continuation.target as { playId: string }).playId);
        if (game014 && def014) {
          GivePowerMod("LOF_014", def014, -2, "ForAttack", game014.gameLog);
          game014.gameLog.push(`${CardTitle("LOF_014")}: defender gets -2/-0 for this attack.`);
        }
      }
      return continuation;
    }
    case "LOF_009": { // Darth Maul (deployed) — On Attack: Deal 1 damage to a unit and 1 damage to a
                      // different unit.
      const game009 = GetGame();
      if (!game009) return continuation;
      const units009 = AllUnits();
      if (units009.length === 0) return continuation;
      return {
        type: "ability-target",
        cardId: "LOF_009_a",
        player: attacker.controller,
        fromPlayIds: units009.map(u => u.playId),
        continuation,
      };
    }
    case "LOF_005": { // Morgan Elsbeth (deployed) — On Attack: The next unit you play this phase costs
                      // 1 resource less if it shares a keyword with a friendly unit.
      const game005 = GetGame();
      if (game005 && !game005.currentGameState.currentEffects.some(e => e.cardId === "LOF_005" && e.affectedPlayer === attacker.controller)) {
        game005.currentGameState.currentEffects.push({ cardId: "LOF_005", duration: "Phase", affectedPlayer: attacker.controller });
        game005.gameLog.push(`${CardTitle("LOF_005")}: next keyword-sharing unit you play this phase costs 1 less.`);
      }
      return continuation;
    }
    case "JTL_010": { // Captain Phasma (deployed) — On Attack: If you played another First Order card
                      // this phase, you may deal 1 damage to a unit. If you do, deal 1 damage to a base.
      if (!CardWasPlayedThisPhase(attacker.controller, "First Order")) return continuation;
      const units010 = AllUnits();
      if (units010.length === 0) return continuation; // no unit to deal to → the whole ability is skipped
      // Accept → 1 to a chosen unit, then 1 to a chosen base, then combat. Decline → straight to combat.
      const baseStep010: PendingResolution = {
        type: "ability-target",
        cardId: "JTL_010_base",
        player: attacker.controller,
        fromPlayIds: [],
        fromZones: ["Base"],
        continuation,
      };
      return {
        type: "ability-option",
        cardId: "JTL_010",
        player: attacker.controller,
        sourcePlayId: attacker.playId,
        helperText: "Deal 1 damage to a unit (then 1 to a base)?",
        yesLabel: "Deal 1",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: "JTL_010_unit",
          player: attacker.controller,
          fromPlayIds: units010.map(u => u.playId),
          continuation: baseStep010,
        },
        continuation,
      };
    }
    case "SOR_206": { // Mining Guild TIE Fighter — On Attack: You may pay 2. If you do, draw a card.
      const game206 = GetGame();
      if (!game206) return continuation;
      const pState206 = attacker.controller === 1 ? game206.currentGameState.player1 : game206.currentGameState.player2;
      if (pState206.resources.filter(r => r.ready).length < 2) return continuation;
      return {
        type: "ability-option",
        cardId: attacker.cardId,
        sourcePlayId: attacker.playId,
        helperText: "Pay 2 resources to draw a card?",
        yesLabel: "Pay 2",
        noLabel: "Skip",
        onYes: null,
        continuation,
      };
    }
    case "SOR_050": { // The Ghost — On Attack: You may give a Shield token to another SPECTRE unit.
      const spectres050 = GetUnitsForPlayer(attacker.controller)
        .filter(u => u.playId !== attacker.playId && TraitContains(u.cardId, "Spectre", attacker.controller, u.playId));
      if (spectres050.length === 0) return continuation;
      return optionalTarget(attacker.cardId, attacker.controller, spectres050.map(u => u.playId),
        "Give a Shield token to another Spectre unit?",
        { yesLabel: "Give Shield", sourcePlayId: attacker.playId, continuation });
    }
    case "SOR_116": { // Steadfast Battalion (General Grievous) — On Attack: If you control a leader unit, give a friendly unit +2/+2 for this phase.
      const leader116 = GetLeaderForPlayer(attacker.controller);
      if (!leader116.deployed) return continuation;
      const friendlies116 = GetUnitsForPlayer(attacker.controller);
      if (friendlies116.length === 0) return continuation;
      return optionalTarget(attacker.cardId, attacker.controller, friendlies116.map(u => u.playId),
        "Give a friendly unit +2/+2 for this phase?",
        { yesLabel: "Give +2/+2", sourcePlayId: attacker.playId, continuation });
    }
    case "SOR_158": { // Jedha Agitator (Cassian Andor) — On Attack: If you control a leader unit, deal 2 damage to a ground unit or base.
      const leader158 = GetLeaderForPlayer(attacker.controller);
      if (!leader158.deployed) return continuation;
      const game158 = GetGame();
      if (!game158) return continuation;
      const gs158 = game158.currentGameState;
      const groundAndBases158 = [
        ...gs158.player1.groundArena.map(u => u.playId),
        ...gs158.player2.groundArena.map(u => u.playId),
        "player1.base",
        "player2.base",
      ];
      return mandatoryTarget(attacker.cardId, attacker.controller, groundAndBases158, continuation);
    }
    case "SOR_208": { // Outer Rim Headhunter (Swoop Racer) — On Attack: If you control a leader unit, you may exhaust a non-leader unit.
      const leader208 = GetLeaderForPlayer(attacker.controller);
      if (!leader208.deployed) return continuation;
      const nonLeaders208 = AllUnits().filter(u => !CardIsLeader(u.cardId));
      if (nonLeaders208.length === 0) return continuation;
      return optionalTarget(attacker.cardId, attacker.controller, nonLeaders208.map(u => u.playId),
        "Exhaust a non-leader unit?",
        { yesLabel: "Exhaust", sourcePlayId: attacker.playId, continuation });
    }
    case "SOR_142": { // Explosives Artist — On Attack: You may deal 1 damage to the defender or to a base.
      const opponent142 = attacker.controller === 1 ? 2 : 1;
      // Build eligible targets: the defender (unit or base) + any base
      const targets142: string[] = [];
      if (continuation.target.type === "unit") targets142.push(continuation.target.playId);
      targets142.push(`player${opponent142}.base`, `player${attacker.controller}.base`);
      return optionalTarget("SOR_142", attacker.controller, targets142,
        "Deal 1 damage to the defender or a base?", { continuation });
    }
    case "SOR_244": { // Snowspeeder (Concord Dawn Interceptors) — On Attack: Exhaust an enemy Vehicle ground unit.
      const game244 = GetGame();
      if (!game244) return continuation;
      const gs244 = game244.currentGameState;
      const opponentId244 = attacker.controller === 1 ? 2 : 1;
      const enemyVehicles244 = (opponentId244 === 1 ? gs244.player1.groundArena : gs244.player2.groundArena)
        .filter(u => TraitContains(u.cardId, "Vehicle", opponentId244, u.playId));
      if (enemyVehicles244.length === 0) return continuation;
      return mandatoryTarget(attacker.cardId, attacker.controller, enemyVehicles244.map(u => u.playId), continuation);
    }
    default:
      return null; // this source has no innate On Attack ability
  }
}

/**
 * JTL_018 Kazuda Xiono — "On Attack: Choose any number of friendly units. They lose all
 * abilities for this round." Shared by his deployed side and his Pilot-upgrade side.
 * "Any number" includes zero, so the prompt is always satisfiable.
 */
function kazudaSilencePending(attacker: Unit, continuation: ResolveAttackPending): PendingResolution {
  const friendly = GetUnitsForPlayer(attacker.controller);
  if (friendly.length === 0) return continuation;
  return {
    type: "ability-target",
    cardId: "JTL_018_OA",
    player: attacker.controller,
    fromPlayIds: friendly.map(u => u.playId),
    needsMultiple: true,
    maxTargets: friendly.length,
    continuation,
  };
}
