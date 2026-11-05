import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";
import { Cards } from "../../card-helpers";

// SEC_038 Condemn on the solver's attacker hands "the defending player may disclose" to Player 2.
// In a puzzle P2 is automated: when they can disclose they always do, so the solver is never asked
// and the attacker gets –6/–0. With nothing to disclose there is no prompt at all.

function newCtx(p2Hand: string[]): EngineContext {
  const raw = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: Cards.bases.common.green30HP, damage: 0, epicActionUsed: false },
      leader: { cardId: Cards.leaders.sor.sabineWren, ready: true, deployed: false, epicActionUsed: false },
      groundArena: [{
        cardId: Cards.units.ash.dinosaurTurtle, playId: "@", owner: 1, controller: 1, ready: true, damage: 0,
        upgrades: [{ cardId: Cards.upgrades.sec.condemn, playId: "@", owner: 2, controller: 2 }], captives: [],
      }],
      spaceArena: [], resources: [], discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    player2: {
      base: { cardId: Cards.bases.common.green30HP, damage: 0, epicActionUsed: false },
      leader: { cardId: Cards.leaders.sor.grandMoffTarkin, ready: true, deployed: false, epicActionUsed: false },
      groundArena: [], spaceArena: [], resources: [], discard: [], deck: [],
      hand: p2Hand.map(cardId => ({ cardId })),
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

function attackTheBase(ctx: EngineContext) {
  const turtle = ctx.game.currentGameState.player1.groundArena[0].playId;
  const declared = dispatch(ctx, "initiate-attack", { playId: turtle });
  return dispatch(declared.context, "choose-target", { targetZones: ["Base"], targetPlayers: [2] });
}

describe("SEC_038 Condemn — the defending player's disclose is automated in puzzles", () => {
  it("P2 discloses whenever they can: the solver is not asked, and the attacker gets –6/–0", () => {
    const res = attackTheBase(newCtx([Cards.units.sor.deathTrooper])); // Vigilance + Villainy

    expect(res.response.resolutionNeeded).toBeFalsy();
    expect(res.context.game.currentGameState.player2.base.damage).toBe(1); // 7 – 6
  });

  it("control: with nothing to disclose there is no prompt and full damage", () => {
    const res = attackTheBase(newCtx([]));

    expect(res.response.resolutionNeeded).toBeFalsy();
    expect(res.context.game.currentGameState.player2.base.damage).toBe(7);
  });
});
