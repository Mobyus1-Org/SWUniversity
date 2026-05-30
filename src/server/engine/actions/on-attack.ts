import { Unit } from "@/server/engine/unit";
import { OnAttackOrderPending, OnAttackTriggerEntry, PendingResolution, ResolveAttackPending, SpreadDamagePending, GiveXpMultiplePending, SpreadHealPending } from "@/server/engine/pending-resolution";
import { GetGame, UnitAttackedThisPhase, HasOnAttack, UpgradeGrantsOnAttack, GetCurrentEffectsForPlayer, CanDisclose, chooseAndDefeatUnit, searchDeck } from "@/server/engine/core-functions";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";
import { CardTitle } from "@/server/engine/card-db/generated";
import { applyDarksaberOnAttack } from "../on-attack-helper";

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

  // When attacking a unit: if this attacker has Saboteur AND another on-attack trigger,
  // give the player ordering choice before resolving either.
  if (!opts.skipOrderingPrompt && hasOtherTrigger && continuation.target.type === "unit") {
    const hasSab = (() => {
      try { return HasSaboteur(attacker.cardId, attacker.playId, attacker.controller); }
      catch { return false; }
    })();
    if (hasSab) {
      const triggers: OnAttackTriggerEntry[] = [
        { cardId: "saboteur", label: `${CardTitle(attacker.cardId)} — Saboteur` },
        ...activeUpgrades.map(u => ({ cardId: u.cardId, label: `${CardTitle(u.cardId)} — On Attack` })),
      ];
      if (HasOnAttack(attacker.cardId)) triggers.push({ cardId: attacker.cardId, label: `${CardTitle(attacker.cardId)} — On Attack` });
      return {
        type: "on-attack-order",
        attackerPlayId: attacker.playId,
        player: attacker.controller,
        triggers,
        continuation,
      } satisfies OnAttackOrderPending;
    }
  }

  // Effect-granted On Attack abilities
  for(const currentEffect of GetCurrentEffectsForPlayer(attacker.controller)) {
    if (currentEffect.targetPlayId && currentEffect.targetPlayId !== attacker.playId) continue;
    switch (currentEffect.cardId) {
      //TODO effects that grant on-attack triggers
    }
  }

  //Upgrade-granted On Attack abilities
  for (const upgrade of activeUpgrades) {
    switch (upgrade.cardId) {
      case "SOR_121": { // Hardpoint Heavy Blaster
        if (continuation.target.type === "unit") {
          const game = GetGame();
          if (game) {
            const gs = game.currentGameState;
            const defenderPlayId = continuation.target.playId;
            const inGround = [...gs.player1.groundArena, ...gs.player2.groundArena].some(u => u.playId === defenderPlayId);
            const arenaUnits = inGround
              ? [...gs.player1.groundArena, ...gs.player2.groundArena]
              : [...gs.player1.spaceArena, ...gs.player2.spaceArena];
            if (arenaUnits.length > 0) {
              return {
                type: "ability-option",
                cardId: "SOR_121",
                helperText: "Deal 2 damage to a unit in the defender's arena?",
                onYes: {
                  type: "ability-target",
                  cardId: "SOR_121",
                  fromPlayIds: arenaUnits.map(u => u.playId),
                  continuation,
                },
                continuation,
              };
            }
          }
        }
        break;
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
  // innate On Attack abilities
  switch (attacker.cardId) {
    case "SOR_236": // R2-D2 — On Attack: Scry 1.
      return searchDeck("SOR_236", attacker.controller, 1, "scry", { continuation }) ?? continuation;
    case "SOR_040": { // Avenger On Attack — opponent chooses a non-leader unit they control to defeat.
      return chooseAndDefeatUnit("SOR_040", attacker.controller, false, continuation);
    }
    case "SOR_010": { // Darth Vader "On Attack: You may deal 2 damage to a unit."
      const game = GetGame();
      if (!game) return null;
      const gs = game.currentGameState;
      const allUnitPlayIds = [
        ...gs.player1.groundArena,
        ...gs.player1.spaceArena,
        ...gs.player2.groundArena,
        ...gs.player2.spaceArena,
      ].map(u => u.playId);
      return {
        type: "ability-option",
        cardId: "SOR_010",
        helperText: "You may deal 2 damage to a unit.",
        onYes: {
          type: "ability-target",
          cardId: "SOR_010",
          fromPlayIds: allUnitPlayIds,
          continuation,
        },
        continuation,
      };
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
      const game = GetGame();
      if (!game) return null;
      const gs = game.currentGameState;
      const allUnitPlayIds = [
        ...gs.player1.groundArena,
        ...gs.player1.spaceArena,
        ...gs.player2.groundArena,
        ...gs.player2.spaceArena,
      ].map(u => u.playId);

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
      const game006 = GetGame();
      if (!game006) return continuation;
      const gs006 = game006.currentGameState;
      const friendlies006 = (attacker.controller === 1
        ? [...gs006.player1.groundArena, ...gs006.player1.spaceArena]
        : [...gs006.player2.groundArena, ...gs006.player2.spaceArena]
      ).filter(u => u.playId !== attacker.playId);
      if (friendlies006.length === 0) return continuation;
      const allUnits006 = [
        ...gs006.player1.groundArena, ...gs006.player1.spaceArena,
        ...gs006.player2.groundArena, ...gs006.player2.spaceArena,
      ];
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
    case "SEC_065": { // Nala Se — On Attack: You may disclose Vigilance×Vigilance. If you do, heal up to 4 from other units.
      if (!CanDisclose(attacker.controller, ["Vigilance", "Vigilance"])) return continuation;
      const game065 = GetGame();
      if (!game065) return continuation;
      const gs065 = game065.currentGameState;
      const otherUnits065 = [
        ...gs065.player1.groundArena, ...gs065.player1.spaceArena,
        ...gs065.player2.groundArena, ...gs065.player2.spaceArena,
      ].filter(u => u.playId !== attacker.playId).map(u => u.playId);
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
      const game085 = GetGame();
      if (!game085) return continuation;
      const gs085 = game085.currentGameState;
      const otherUnits085 = [
        ...gs085.player1.groundArena, ...gs085.player1.spaceArena,
        ...gs085.player2.groundArena, ...gs085.player2.spaceArena,
      ].filter(u => u.playId !== attacker.playId);
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
      const game059 = GetGame();
      if (!game059) return continuation;
      const gs059 = game059.currentGameState;
      const damagedOthers059 = [
        ...gs059.player1.groundArena, ...gs059.player1.spaceArena,
        ...gs059.player2.groundArena, ...gs059.player2.spaceArena,
      ].filter(u => u.playId !== attacker.playId && u.damage > 0);
      if (damagedOthers059.length === 0) return continuation;
      return {
        type: "ability-option",
        cardId: attacker.cardId,
        sourcePlayId: attacker.playId,
        helperText: "Heal 2 damage from another unit?",
        yesLabel: "Heal 2",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId: attacker.cardId,
          fromPlayIds: damagedOthers059.map(u => u.playId),
          continuation,
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
    default:
      // If an upgrade-only trigger fired but no native ability, return continuation so combat proceeds.
      return activeUpgrades.length > 0 ? continuation : null;
  }
}
