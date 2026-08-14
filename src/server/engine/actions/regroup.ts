import type { GameState, PlayerState } from "@/lib/engine/game";
import type { DiscardedCard, PlayerId } from "@/lib/engine/core-models";
import { CardTitle, CardHp, CardUpgradeHp } from "@/server/engine/card-db/generated";
import { DealDamageToBase, DefeatResource, ReadyUnit } from "@/server/engine/core-functions";

function ps(gs: GameState, player: PlayerId): PlayerState {
  return player === 1 ? gs.player1 : gs.player2;
}

/**
 * Units with "When the regroup phase starts: Deal N damage to this unit."
 *
 * A data table rather than a case per card — the engine previously had only a LEADER-specific
 * regroup-start hook (SHD_015 below), so this is the unit-level equivalent. An upgrade that
 * grants the ability to its host is handled separately (see REGROUP_START_BASE_DAMAGE_UPGRADES).
 */
const REGROUP_START_SELF_DAMAGE: Record<string, number> = {
  JTL_198: 1, // Fireball — An Explosion With Wings
};

/**
 * Upgrades granting "When the regroup phase starts: Deal N damage to your base" to the unit
 * they are attached to. The damage lands on the ATTACHED UNIT'S CONTROLLER's base, which is not
 * necessarily the upgrade's owner — Shadow of Stygeon Prime is played onto an ENEMY unit.
 */
const REGROUP_START_BASE_DAMAGE_UPGRADES: Record<string, number> = {
  LAW_077: 2, // Shadow of Stygeon Prime
};

/**
 * Fires every unit-scoped "when the regroup phase starts" ability, before the draw.
 * Damage is applied first and dead units swept once, so a unit that kills itself here does not
 * linger at 0 HP into the new round.
 */
function resolveRegroupStartUnitAbilities(gs: GameState, log: string[]): void {
  for (const player of [1, 2] as PlayerId[]) {
    const p = ps(gs, player);
    for (const unit of [...p.groundArena, ...p.spaceArena]) {
      const selfDamage = REGROUP_START_SELF_DAMAGE[unit.cardId];
      if (selfDamage) {
        unit.damage += selfDamage;
        log.push(`${CardTitle(unit.cardId)}: took ${selfDamage} damage as the regroup phase started.`);
      }
      for (const upg of unit.upgrades) {
        const baseDamage = REGROUP_START_BASE_DAMAGE_UPGRADES[upg.cardId];
        if (!baseDamage) continue;
        // The attached unit's controller takes it — the upgrade is typically on an ENEMY unit.
        DealDamageToBase(gs, unit.controller as PlayerId, baseDamage);
        log.push(`${CardTitle(upg.cardId)}: dealt ${baseDamage} damage to Player ${unit.controller}'s base.`);
      }
    }
  }

  // Sweep anything the self-damage killed.
  for (const player of [1, 2] as PlayerId[]) {
    const p = ps(gs, player);
    for (const zone of ["groundArena", "spaceArena"] as const) {
      for (let i = p[zone].length - 1; i >= 0; i--) {
        const u = p[zone][i];
        const maxHp = CardHp(u.cardId) || 0;
        const upgradeHp = u.upgrades.reduce((sum, up) => sum + (CardUpgradeHp(up.cardId) || 0), 0);
        if (u.damage >= maxHp + upgradeHp) {
          const [dead] = p[zone].splice(i, 1);
          const ownerState = ps(gs, dead.owner as PlayerId);
          ownerState.discard.unshift({
            cardId: dead.cardId,
            playId: dead.playId,
            owner: dead.owner,
            controller: dead.owner,
            turnDiscarded: gs.currentRound,
            discardEffect: "",
          });
          log.push(`${CardTitle(dead.cardId)} was defeated at the start of regroup.`);
        }
      }
    }
  }
}

export function executeRegroupDraw(gs: GameState, log: string[]): void {
  resolveRegroupStartUnitAbilities(gs, log);

  // SHD_015 Doctor Aphra (leader): "When the regroup phase starts: Discard a card from your deck."
  // Only the undeployed leader side carries this; the deployed side has different abilities.
  for (const player of [1, 2] as PlayerId[]) {
    const p = ps(gs, player);
    if (p.leader.cardId === "SHD_015" && !p.leader.deployed && p.deck.length > 0) {
      const card = p.deck.pop()!;
      p.discard.unshift({
        cardId: card.cardId,
        playId: String(gs.nextPlayId++),
        owner: player,
        controller: player,
        turnDiscarded: gs.currentRound,
        discardEffect: "",
      });
      log.push(`${CardTitle("SHD_015")}: discarded ${CardTitle(card.cardId)} from the deck.`);
    }
  }

  // Revert "UntilStartOfRegroup" effects before drawing (e.g. Change of Heart).
  const revertEffects = gs.currentEffects.filter(e => e.duration === "UntilStartOfRegroup");
  for (const eff of revertEffects) {
    // TS26_12 Sundari Palace — "defeat that many friendly resources at the start of the regroup
    // phase". Carries a count rather than a targetPlayId, so it is handled before the guard below.
    if (eff.cardId === "TS26_12") {
      const debtor = eff.affectedPlayer === 1 ? gs.player1 : gs.player2;
      let owed = eff.value ?? 0;
      // Defeat from the back so the resources readied by the Epic Action are the ones paid back.
      while (owed > 0 && debtor.resources.length > 0) {
        const last = debtor.resources[debtor.resources.length - 1];
        DefeatResource(gs, eff.affectedPlayer as PlayerId, last.playId, log, "TS26_12");
        owed -= 1;
      }
      continue;
    }

    if (!eff.targetPlayId) continue;

    if (eff.cardId === "SOR_219" || eff.cardId === "TWI_189" || eff.cardId === "SHD_226") {
      // Sneak Attack (SOR_219) / Unnatural Life (TWI_189) / Unrefusable Offer (SHD_226): defeat the
      // unit at start of regroup. It goes to its OWNER's discard, which for SHD_226 is not the
      // player who was controlling it.
      outer219: for (const pState of [gs.player1, gs.player2]) {
        for (const zone of ["groundArena", "spaceArena"] as const) {
          const idx = pState[zone].findIndex(u => u.playId === eff.targetPlayId);
          if (idx !== -1) {
            const [unit] = pState[zone].splice(idx, 1);
            const ownerState = unit.owner === 1 ? gs.player1 : gs.player2;
            const discarded: DiscardedCard = {
              cardId: unit.cardId,
              playId: unit.playId,
              owner: unit.owner,
              controller: unit.owner,
              turnDiscarded: gs.currentRound,
              discardEffect: "",
            };
            ownerState.discard.unshift(discarded);
            gs.roundState.cardsLeftPlayThisPhase.push({ fromPlayer: unit.owner as PlayerId, cardId: unit.cardId, playId: unit.playId, reason: "defeated" });
            log.push(`${CardTitle(eff.cardId)}: ${CardTitle(unit.cardId)} was defeated at start of regroup.`);
            break outer219;
          }
        }
      }
      continue;
    }

    const ownerPlayer = eff.affectedPlayer;
    const ownerState = ownerPlayer === 1 ? gs.player1 : gs.player2;
    outer: for (const pState of [gs.player1, gs.player2]) {
      for (const zone of ["groundArena", "spaceArena"] as const) {
        const idx = pState[zone].findIndex(u => u.playId === eff.targetPlayId);
        if (idx !== -1) {
          const [unit] = pState[zone].splice(idx, 1);
          unit.controller = ownerPlayer;
          ownerState[zone].push(unit);
          log.push(`${CardTitle(unit.cardId)} returned to Player ${ownerPlayer}'s control (Change of Heart expired).`);
          break outer;
        }
      }
    }
  }
  gs.currentEffects = gs.currentEffects.filter(e => e.duration !== "UntilStartOfRegroup");

  for (const player of [1, 2] as PlayerId[]) {
    const p = ps(gs, player);
    const toDraw = 2;
    const drawn = Math.min(toDraw, p.deck.length);
    for (let i = 0; i < drawn; i++) {
      const card = p.deck.pop()!;
      p.hand.push(card);
    }
    const penalty = (toDraw - drawn) * 3;
    if (drawn > 0) {
      log.push(`Player ${player} drew ${drawn} card(s).`);
    }
    if (penalty > 0) {
      DealDamageToBase(gs, player, penalty); // ASH_070 At Attin Safety Droid
      log.push(`Player ${player} drew from an empty deck: ${penalty} damage to base.`);
    }
  }
  gs.gamePhase = "RegroupResource";
  gs.activePlayer = gs.initiativePlayer;
  gs.roundState.regroupResourcedPlayers = [];
  log.push("Regroup phase: draw step complete. Players may now resource a card.");
}

function executeRegroupReady(gs: GameState, log: string[]): void {
  // Ready all units in all arenas for both players (unless prevented by a Round-scoped effect)
  for (const player of [1, 2] as PlayerId[]) {
    const p = ps(gs, player);
    for (const unit of [...p.groundArena, ...p.spaceArena]) {
      ReadyUnit(gs, unit);
    }
    p.leader.ready = true;
    for (const resource of p.resources) {
      resource.ready = true;
    }
  }

  // Clear Phase- and Round-scoped effects at end of regroup
  gs.currentEffects = gs.currentEffects.filter(
    e => e.duration !== "Phase" && e.duration !== "Round"
  );

  gs.currentRound++;
  gs.initiativeClaimed = false;
  gs.activePlayer = gs.initiativePlayer;
  gs.roundState = {
    cardsPlayedThisPhase: [],
    cardsPlayedThisRound: [],
    cardsEnteredPlayThisPhase: [],
    cardsLeftPlayThisPhase: [],
    unitsAttackedThisPhase: [],
    baseDamagedThisPhase: [],
    unitsDamagedThisPhase: [],
    cardsDrawnThisPhase: { 1: 0, 2: 0 },
    lastActionWasPass: false,
    regroupResourcedPlayers: [],
    forceUsedThisPhase: 0,
  };
  gs.gamePhase = "ActionPhase";
  log.push(`Regroup phase complete. Round ${gs.currentRound} begins.`);
}

function advanceRegroupResource(gs: GameState, log: string[]): void {
  if (gs.roundState.regroupResourcedPlayers.length === 1) {
    gs.activePlayer = gs.activePlayer === 1 ? 2 : 1;
    log.push(`Regroup phase: resource step — waiting for Player ${gs.activePlayer}.`);
  } else if (gs.roundState.regroupResourcedPlayers.length === 2) {
    executeRegroupReady(gs, log);
  }
}

export function tryRegroupResource(
  gs: GameState,
  log: string[],
  fromPlayer: PlayerId,
  handIndex: number,
): string | null {
  if (gs.gamePhase !== "RegroupResource")
    return "Cannot resource: not in RegroupResource phase.";
  if (fromPlayer !== gs.activePlayer)
    return "Cannot resource: it is not your turn.";
  const p = ps(gs, fromPlayer);
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= p.hand.length)
    return `Cannot resource: hand index ${handIndex} is out of range.`;

  const [card] = p.hand.splice(handIndex, 1);
  p.resources.push({
    cardId: card.cardId,
    playId: String(gs.nextPlayId++),
    owner: fromPlayer,
    controller: fromPlayer,
    ready: false,
    stolen: false,
  });
  log.push(`Player ${fromPlayer} resourced a card.`);
  gs.roundState.regroupResourcedPlayers.push(fromPlayer);
  advanceRegroupResource(gs, log);
  return null;
}

export function tryPassResource(
  gs: GameState,
  log: string[],
  fromPlayer: PlayerId,
): string | null {
  if (gs.gamePhase !== "RegroupResource")
    return "Cannot pass resource: not in RegroupResource phase.";
  if (fromPlayer !== gs.activePlayer)
    return "Cannot pass resource: it is not your turn.";

  log.push(`Player ${fromPlayer} passed the resource step.`);
  gs.roundState.regroupResourcedPlayers.push(fromPlayer);
  advanceRegroupResource(gs, log);
  return null;
}
