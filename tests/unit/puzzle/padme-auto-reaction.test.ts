import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";
import { Cards } from "../../card-helpers";

// SEC_016 Padmé Amidala deployed on Player 2's side: the solver's Pillage makes P2 discard 2 cards.
// P2 is automated — it discards, takes Padmé's 1 damage once, and aims it at a solver unit.

const PADME = Cards.leaders.sec.padmeAmidala;
const MARINE = Cards.units.sor.battlefieldMarine;
const CONSULAR = Cards.units.sor.consularSecurityForce;

function newCtx(): EngineContext {
  const unit = (cardId: string, playId: string, player: 1 | 2) =>
    ({ cardId, playId, owner: player, controller: player, ready: true, damage: 0, upgrades: [], captives: [] });
  const raw = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 100, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: Cards.bases.common.red30HP, damage: 0, epicActionUsed: false },
      leader: { cardId: Cards.leaders.sor.sabineWren, ready: true, deployed: false, epicActionUsed: false },
      groundArena: [unit(CONSULAR, "10", 1)], spaceArena: [],
      resources: Array.from({ length: 8 }, (_, i) => ({ cardId: MARINE, playId: `r${i}`, owner: 1, controller: 1, ready: true })),
      discard: [], deck: [], hand: [{ cardId: Cards.events.shd.pillage }],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    player2: {
      base: { cardId: Cards.bases.common.green30HP, damage: 0, epicActionUsed: false },
      leader: { cardId: PADME, ready: true, deployed: true, epicActionUsed: true, deployedPlayId: "20" },
      groundArena: [unit(PADME, "20", 2)], spaceArena: [], resources: [], discard: [], deck: [],
      hand: [{ cardId: MARINE }, { cardId: MARINE }, { cardId: MARINE }],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    currentEffects: [], triggerBag: [],
  };
  const gs = hydratePuzzleGame(raw as never);
  const game: Game = { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] };
  return { game, pending: null };
}

function dispatch(ctx: EngineContext, type: string, data: Record<string, unknown>) {
  return processPuzzleDispatch(
    { dispatchId: randomUUID(), dispatchType: type as never, dispatchData: data as never, fromPlayer: 1 },
    ctx,
  );
}

describe("SEC_016 Padmé Amidala — P2's reaction is automated in puzzles", () => {
  it("P2 discards to the solver's Pillage and Padmé deals 1 to a solver unit, once", () => {
    const ctx = newCtx();
    const played = dispatch(ctx, "play-card", { cardId: Cards.events.shd.pillage, fromZone: "Hand" });
    const res = dispatch(played.context, "choose-option", { option: "No" }); // the opponent discards

    expect(res.response.resolutionNeeded).toBeFalsy();
    expect(res.context.game.currentGameState.player2.hand).toHaveLength(1);
    expect(res.context.game.currentGameState.player1.groundArena[0].damage).toBe(1);
  });
});
