import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";

// SOR_174 Smoke and Cinders (Event, Aggression, cost 5)
// "Each player discards all but 2 cards (of their choice) from their hand."

describe("SOR_174 Smoke and Cinders", () => {
  it("each player with more than 2 cards discards down to 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        // P1: SOR_174 + 3 filler cards = 4 in hand; after playing: 3 remain → discard 1
        .WithCardInHandForPlayer(1, Cards.events.sor.smokeAndCinders)
        .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
        .WithCardInHandForPlayer(1, Cards.events.sor.openFire)
        .WithCardInHandForPlayer(1, Cards.events.sor.disarm)
        // P2: 4 cards → discard 2
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithCardInHandForPlayer(2, Cards.events.sor.openFire)
        .WithCardInHandForPlayer(2, Cards.events.sor.disarm)
        .WithCardInHandForPlayer(2, Cards.events.sor.bombingRun)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // play Smoke and Cinders (P1 hand goes from 4 → 3)
    // P1 must discard 1 (keep 2): discard index 0
    await g.chooseCardFromHandAsync(1, 0);
    // P2 must discard 2: discard index 0 twice
    await g.chooseCardFromHandAsync(2, 0);
    const res = await g.chooseCardFromHandAsync(2, 0);

    expect(g.state.player1.hand.length).toBe(2);
    expect(g.state.player2.hand.length).toBe(2);
    expect(res.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("a player with 2 or fewer cards discards nothing (no-op, no error)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithCardInHandForPlayer(1, Cards.events.sor.smokeAndCinders)
        .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
        // P2: exactly 2 cards
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithCardInHandForPlayer(2, Cards.events.sor.openFire)
        .Build(),
    );

    const res = await g.playCardFromHandAsync(1, 0); // P1 hand: 2 → 1 after play (no discard needed)
    // No discard choices needed — state resolves immediately

    expect(g.state.player1.hand.length).toBe(1);
    expect(g.state.player2.hand.length).toBe(2);
    expect(res.lastDispatchResponse?.invalidAction).toBeFalsy();
  });

  it("both players at or below 2 cards resolves with no prompt at all", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithCardInHandForPlayer(1, Cards.events.sor.smokeAndCinders)
        .Build(),
    );

    const res = await g.playCardFromHandAsync(1, 0); // P1 hand: 1 → 0, P2 hand: 0

    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player2.hand.length).toBe(0);
    expect(res.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});

// Puzzle mode: P2 is the AI opponent and must auto-discard down to 2, keeping its 2 highest-value
// cards (lowest-cost/lowest-rarity discarded first) without any prompt to the human.
describe("SOR_174 Smoke and Cinders — puzzle mode (P2 auto-discards)", () => {
  const rawPuzzle = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: "SOR_029", damage: 0, epicActionUsed: false },
      leader: { cardId: "SOR_007", ready: true, deployed: false, epicActionUsed: false },
      groundArena: [], spaceArena: [],
      resources: Array(14).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
      discard: [], deck: [],
      hand: [{ cardId: "SOR_174", playId: "@", owner: 1, controller: 1 }],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    player2: {
      base: { cardId: "SOR_023", damage: 0, epicActionUsed: false },
      leader: { cardId: "JTL_014", ready: true, deployed: false, epicActionUsed: false },
      groundArena: [], spaceArena: [],
      resources: Array(3).fill(null).map(() => ({ cardId: "LAW_174", playId: "@", owner: 2, controller: 2, ready: true })),
      discard: [], deck: [],
      // Ant Droid (cost 1, Common) and Rukh (cost 3, Rare) should go first; Executor (cost 8) survives.
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

  it("P2 auto-discards down to its 2 highest-value cards without prompting the human", () => {
    const ctx = newCtx();

    const res = dispatch(ctx, "play-card", { cardId: "SOR_174", fromZone: "Hand" });

    const gs = res.context.game.currentGameState;
    expect(res.context.pending).toBeNull();
    expect(gs.player2.hand).toHaveLength(2);
    expect(gs.player2.hand.map(c => c.cardId).sort()).toEqual(["ASH_036", "ASH_197"]); // Ant Droid discarded first
  });
});
