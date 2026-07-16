import type { GameState, PlayerState } from "@/lib/engine/game";
import type { DiscardedCard, PlayerId } from "@/lib/engine/core-models";
import { CardTitle } from "@/server/engine/card-db/generated";
import { CapBaseDamage } from "@/server/engine/core-functions";

function ps(gs: GameState, player: PlayerId): PlayerState {
  return player === 1 ? gs.player1 : gs.player2;
}

export function executeRegroupDraw(gs: GameState, log: string[]): void {
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
    if (!eff.targetPlayId) continue;

    if (eff.cardId === "SOR_219" || eff.cardId === "TWI_189") {
      // Sneak Attack (SOR_219) / Unnatural Life (TWI_189): defeat the unit at start of regroup.
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
      p.base.damage += CapBaseDamage(player, penalty); // ASH_070 At Attin Safety Droid
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
      const prevented = gs.currentEffects.some(
        e => e.cardId === "SOR_186_no_ready" && e.targetPlayId === unit.playId,
      );
      if (!prevented) unit.ready = true;
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
