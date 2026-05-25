import { Unit } from "@/server/engine/unit";
import { OnAttackOrderPending, OnAttackTriggerEntry, PendingResolution, ResolveAttackPending, SpreadDamagePending } from "@/server/engine/pending-resolution";
import { GetGame, UnitAttackedThisPhase, TraitContains } from "@/server/engine/core-functions";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";
import { CardTitle } from "@/server/engine/card-db/generated";

/**
 * Give an Experience token to each other friendly Mandalorian unit (Darksaber On Attack).
 * Safe to call when game singleton may not be set — returns silently if no game.
 */
export function applyDarksaberOnAttack(attacker: Unit): void {
  const game = GetGame();
  if (!game) return;
  const gs = game.currentGameState;
  const player = attacker.controller;
  const friendly = player === 1
    ? [...gs.player1.groundArena, ...gs.player1.spaceArena]
    : [...gs.player2.groundArena, ...gs.player2.spaceArena];
  for (const unit of friendly) {
    if (unit.playId === attacker.playId) continue;
    if (TraitContains(unit.cardId, "Mandalorian", player, unit.playId)) {
      unit.upgrades.push({
        cardId: "SOR_T01",
        playId: String(gs.nextPlayId++),
        owner: player,
        controller: player,
      });
    }
  }
}

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
  const hasDarksaber = attacker.upgrades.some(u => u.cardId === "SHD_126");
  const hasVambrace = attacker.upgrades.some(u => u.cardId === "SHD_177");
  const hasHardpointBlaster = attacker.upgrades.some(u => u.cardId === "SOR_121");
  const hasNativeAbility = ["SOR_010", "SOR_014", "SHD_012", "TWI_005", "TWI_186"].includes(attacker.cardId);
  const hasOtherTrigger = hasDarksaber || hasVambrace || hasHardpointBlaster || hasNativeAbility;

  // When attacking a unit: if this attacker has Saboteur AND another on-attack trigger,
  // give the player ordering choice before resolving either.
  if (!opts.skipOrderingPrompt && hasOtherTrigger && continuation.target.type === "unit") {
    const hasSab = (() => {
      try { return HasSaboteur(attacker.cardId, attacker.playId, attacker.controller); }
      catch { return false; }
    })();
    if (hasSab) {
      const triggers: OnAttackTriggerEntry[] = [
        { id: "saboteur", label: `${CardTitle(attacker.cardId)} — Saboteur` },
      ];
      if (hasVambrace) triggers.push({ id: "vambrace", label: "Vambrace Flamethrower — On Attack" });
      if (hasDarksaber) triggers.push({ id: "darksaber", label: "The Darksaber — On Attack" });
      if (hasHardpointBlaster) triggers.push({ id: "hardpoint", label: "Hardpoint Heavy Blaster — On Attack" });
      if (hasNativeAbility) triggers.push({ id: "native", label: `${CardTitle(attacker.cardId)} — On Attack` });
      return {
        type: "on-attack-order",
        attackerPlayId: attacker.playId,
        player: attacker.controller,
        triggers,
        continuation,
      } satisfies OnAttackOrderPending;
    }
  }

  // Upgrade-granted: Darksaber — give XP to each other friendly Mandalorian (automatic, no player input)
  if (hasDarksaber) {
    applyDarksaberOnAttack(attacker);
  }

  // Upgrade-granted: Hardpoint Heavy Blaster — optionally deal 2 damage to a unit in the defender's arena
  if (hasHardpointBlaster && continuation.target.type === "unit") {
    const game121 = GetGame();
    if (game121) {
      const gs121 = game121.currentGameState;
      const defenderPlayId = continuation.target.playId;
      const inGround = [...gs121.player1.groundArena, ...gs121.player2.groundArena].some(u => u.playId === defenderPlayId);
      const arenaUnits = inGround
        ? [...gs121.player1.groundArena, ...gs121.player2.groundArena]
        : [...gs121.player1.spaceArena, ...gs121.player2.spaceArena];
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

  // Upgrade-granted: Vambrace Flamethrower — optionally deal 3 damage split among enemy ground units
  if (hasVambrace) {
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
  }

  switch (attacker.cardId) {
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
    default:
      // If an upgrade-only trigger fired but no native ability, return continuation so combat proceeds.
      return (hasDarksaber || hasVambrace || hasHardpointBlaster) ? continuation : null;
  }
}
