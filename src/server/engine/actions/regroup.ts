import type { GameState, PlayerState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";

function ps(gs: GameState, player: PlayerId): PlayerState {
  return player === 1 ? gs.player1 : gs.player2;
}

export function executeRegroupDraw(gs: GameState, log: string[]): void {
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
      p.base.damage += penalty;
      log.push(`Player ${player} drew from an empty deck: ${penalty} damage to base.`);
    }
  }
  gs.gamePhase = "RegroupResource";
  gs.activePlayer = gs.initiativePlayer;
  gs.roundState.regroupResourcedPlayers = [];
  log.push("Regroup phase: draw step complete. Players may now resource a card.");
}

function executeRegroupReady(gs: GameState, log: string[]): void {
  // Ready all units in all arenas for both players
  for (const player of [1, 2] as PlayerId[]) {
    const p = ps(gs, player);
    for (const unit of [...p.groundArena, ...p.spaceArena]) {
      unit.ready = true;
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
    cardsEnteredPlayThisPhase: [],
    cardsLeftPlayThisPhase: [],
    unitsAttackedThisPhase: [],
    lastActionWasPass: false,
    regroupResourcedPlayers: [],
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
