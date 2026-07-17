import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";

// SHD_181 Pillage (Event, Aggression, cost 4)
// "Choose a player. They discard 2 cards from their hand."

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.shd.pillage);
}

describe("SHD_181 Pillage", () => {
  it("choosing self: the playing player is prompted to discard 2 cards", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
        .WithCardInHandForPlayer(1, Cards.events.sor.openFire)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // hand: [pillage, strikeTrue, openFire] -> plays pillage
    await g.chooseYesAsync(1); // Yes = self discards
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.length).toBe(0);
  });

  it("choosing opponent: the opponent is prompted to discard 2 cards", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithCardInHandForPlayer(2, Cards.events.sor.openFire)
        .WithCardInHandForPlayer(2, Cards.events.sor.disarm)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // No = opponent discards
    await g.chooseCardFromHandAsync(2, 0);
    await g.chooseCardFromHandAsync(2, 0);

    expect(g.state.player2.hand.length).toBe(1);
    expect(g.state.player1.hand.length).toBe(0); // P1 only lost the played card
  });

  it("target player with fewer than 2 cards in hand discards all of them, no error", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue) // only 1 card
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);
    const res = await g.chooseCardFromHandAsync(2, 0);

    expect(g.state.player2.hand.length).toBe(0);
    // No further discard prompt remains — resolved cleanly.
    expect(res.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("target player with 0 cards in hand resolves with no prompt or error", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().Build());

    const res = await g.playCardFromHandAsync(1, 0);
    const res2 = await g.chooseNoAsync(1);

    expect(g.state.player2.hand.length).toBe(0);
    expect(res.lastDispatchResponse?.invalidAction).toBeFalsy();
    expect(res2.lastDispatchResponse?.invalidAction).toBeFalsy();
  });
});

// Puzzle mode: P2 is the AI opponent. When P1 targets P2 with Pillage, P2 must auto-discard
// its 2 lowest-cost cards (breaking ties by lowest rarity) without any prompt to the human.
describe("SHD_181 Pillage — puzzle mode (P2 auto-discards)", () => {
  const rawPuzzle = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: "SOR_029", damage: 0, epicActionUsed: false },
      leader: { cardId: "SOR_007", ready: true, deployed: false, epicActionUsed: false },
      groundArena: [], spaceArena: [],
      resources: Array(14).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
      discard: [], deck: [],
      hand: [{ cardId: "SHD_181", playId: "@", owner: 1, controller: 1 }],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    player2: {
      base: { cardId: "SOR_023", damage: 0, epicActionUsed: false },
      leader: { cardId: "JTL_014", ready: true, deployed: false, epicActionUsed: false },
      groundArena: [], spaceArena: [],
      resources: Array(3).fill(null).map(() => ({ cardId: "LAW_174", playId: "@", owner: 2, controller: 2, ready: true })),
      discard: [], deck: [],
      // Ant Droid (cost 1, Common) and Rukh (cost 3, Rare) — Ant Droid is the cheaper, lower-rarity card.
      hand: [
        { cardId: "ASH_036", playId: "@", owner: 2, controller: 2 }, // Rukh, cost 3, Rare
        { cardId: "ASH_116", playId: "@", owner: 2, controller: 2 }, // Ant Droid, cost 1, Common
        { cardId: "ASH_197", playId: "@", owner: 2, controller: 2 }, // Executor, cost 8 — should survive
      ],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    currentEffects: [], triggerBag: [],
  };

  function newCtx(): EngineContext {
    const gs = hydratePuzzleGame(rawPuzzle as never);
    const game: Game = { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] };
    return { game, pending: null };
  }

  function dispatch(ctx: EngineContext, type: string, data: Record<string, unknown>) {
    return processPuzzleDispatch(
      { dispatchId: randomUUID(), dispatchType: type as never, dispatchData: data as never, fromPlayer: 1 },
      ctx,
    );
  }

  it("P2 auto-discards its 2 lowest-cost/lowest-rarity cards without prompting the human", () => {
    const ctx = newCtx();

    let res = dispatch(ctx, "play-card", { cardId: "SHD_181", fromZone: "Hand" });
    res = dispatch(res.context, "choose-option", { option: "No" }); // target opponent (P2)

    const gs = res.context.game.currentGameState;
    expect(res.context.pending).toBeNull();
    expect(gs.player2.hand).toHaveLength(1);
    expect(gs.player2.hand[0].cardId).toBe("ASH_197"); // Executor (cost 8) survives — 2 cheapest cards were discarded
  });
});
