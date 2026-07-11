import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";
import { Cards } from "../../card-helpers";

// SOR_145 K-2SO — "When Defeated: For each opponent, choose one: either deal 3 damage
// to that player's base, or that player discards a card from their hand."
describe("SOR_145 K-2SO", () => {
  function boardWithK2SO(opponentHand: string[], ourHand: string[]) {
    let b = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.k2so)   // 4/4
      .WithGroundUnitForPlayer(2, Cards.units.sor.wampa); // 4/5 — counter kills K-2SO
    for (const cardId of ourHand) b = b.WithCardInHandForPlayer(1, cardId);
    for (const cardId of opponentHand) b = b.WithCardInHandForPlayer(2, cardId);
    return b.Build();
  }

  it("When Defeated: the base-damage option deals 3 to the opponent's base", async () => {
    const g = new GameTestAdapter();
    const state = boardWithK2SO([Cards.units.sor.battlefieldMarine], []);
    g.loadNewState(state);
    const blockerPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [blockerPlayId] });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.dispatchAsync(1, "choose-option", { option: "deal_base_damage=2,3" });

    expect(g.state.player2.base.damage).toBe(3);
    expect(g.state.player2.hand).toHaveLength(1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("When Defeated: the discard prompt says whose hand it indexes, so a client cannot offer the wrong one", async () => {
    const g = new GameTestAdapter();
    const state = boardWithK2SO([Cards.units.sor.battlefieldMarine], [Cards.units.sor.wampa]);
    g.loadNewState(state);
    const blockerPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [blockerPlayId] });
    await g.dispatchAsync(1, "choose-option", { option: "player_discards_from_hand=2,1" });

    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Target");
    expect(resolution?.type === "Target" ? resolution.fromZones : undefined).toContain("Hand");
    // The indices address the OPPONENT's hand — not the human's.
    expect(resolution?.type === "Target" ? resolution.handOwner : undefined).toBe(2);
  });

  it("When Defeated: the discard option takes the card from the discarding player's own hand", async () => {
    const g = new GameTestAdapter();
    const state = boardWithK2SO([Cards.units.sor.battlefieldMarine], [Cards.units.sor.wampa]);
    g.loadNewState(state);
    const blockerPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [blockerPlayId] });
    await g.dispatchAsync(1, "choose-option", { option: "player_discards_from_hand=2,1" });

    // The opponent discards from their own hand — index 0 indexes THEIR hand, not ours.
    await g.dispatchAsync(2, "choose-target", { targetIndices: [0] });

    expect(g.state.player2.hand).toHaveLength(0);
    expect(g.state.player1.hand).toHaveLength(1); // our hand is untouched
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  // The Rebel Assault bug: the opponent's hand is empty, so there is nothing to discard.
  // The ability must resolve as a no-op rather than leaving a pending resolution that
  // nobody can ever satisfy.
  it("When Defeated: the discard option resolves as a no-op when the opponent's hand is empty", async () => {
    const g = new GameTestAdapter();
    const state = boardWithK2SO([], [Cards.units.sor.wampa]);
    g.loadNewState(state);
    const blockerPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [blockerPlayId] });
    await g.dispatchAsync(1, "choose-option", { option: "player_discards_from_hand=2,1" });

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player2.hand).toHaveLength(0);
  });
});

// Puzzle mode is single-player: when the discard option targets the opponent, the human must
// never be asked to pick a card out of a hand that isn't theirs. The opponent discards for
// themselves, deterministically.
describe("SOR_145 K-2SO — puzzle mode", () => {
  function rawPuzzle(p2Hand: { cardId: string }[]) {
    return {
      activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
      initiativePlayer: 2, initiativeClaimed: true,
      player1: {
        base: { cardId: "SOR_022", damage: 0, epicActionUsed: false },
        leader: { cardId: "SOR_014", ready: true, deployed: false, epicActionUsed: false },
        groundArena: [
          { cardId: "SOR_145", playId: "@", owner: 1, controller: 1, ready: true, damage: 0, upgrades: [], captives: [] },
        ],
        spaceArena: [],
        resources: [],
        discard: [], deck: [], hand: [{ cardId: "SOR_164" }],
        supplemental: {},
      },
      player2: {
        base: { cardId: "SOR_025", damage: 0, epicActionUsed: false },
        leader: { cardId: "SHD_014", ready: true, deployed: false, epicActionUsed: true },
        groundArena: [
          { cardId: "SOR_164", playId: "@", owner: 2, controller: 2, ready: false, damage: 0, upgrades: [], captives: [] },
        ],
        spaceArena: [],
        resources: [],
        discard: [], deck: [], hand: p2Hand,
        supplemental: {},
      },
      currentEffects: [], triggerBag: [],
    };
  }

  function newCtx(p2Hand: { cardId: string }[]): EngineContext {
    const gs = hydratePuzzleGame(rawPuzzle(p2Hand) as never);
    const game: Game = { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] };
    return { game, pending: null };
  }

  function dispatch(ctx: EngineContext, type: string, data: Record<string, unknown>) {
    return processPuzzleDispatch(
      { dispatchId: randomUUID(), dispatchType: type as never, dispatchData: data as never, fromPlayer: 1 },
      ctx,
    );
  }

  function attackIntoBlocker(ctx: EngineContext) {
    const gs = ctx.game.currentGameState;
    const res = dispatch(ctx, "initiate-attack", { playId: gs.player1.groundArena[0].playId });
    const blockerPlayId = res.context.game.currentGameState.player2.groundArena[0].playId;
    return dispatch(res.context, "choose-target", { targetPlayIds: [blockerPlayId] });
  }

  it("choosing Discard auto-resolves the opponent's discard without prompting the player", () => {
    let res = attackIntoBlocker(newCtx([{ cardId: "SOR_095" }]));
    res = dispatch(res.context, "choose-option", { option: "player_discards_from_hand=2,1" });

    expect(res.response.resolutionNeeded).toBeFalsy();
    expect(res.context.game.currentGameState.player2.hand).toHaveLength(0);
    expect(res.context.game.currentGameState.player1.hand).toHaveLength(1);
  });

  it("the opponent discards their cheapest card, keeping the expensive one", () => {
    // Battlefield Marine (cost 2) and Rebellious Hammerhead (cost 6).
    let res = attackIntoBlocker(newCtx([{ cardId: "JTL_153" }, { cardId: "SOR_095" }]));
    res = dispatch(res.context, "choose-option", { option: "player_discards_from_hand=2,1" });

    expect(res.context.game.currentGameState.player2.hand.map(c => c.cardId)).toEqual(["JTL_153"]);
  });

  it("on a cost tie the opponent discards the least rare card", () => {
    // All cost 1: Heroic Sacrifice (Rare), Rebel Assault (Uncommon), Precision Fire (Common).
    let res = attackIntoBlocker(newCtx([
      { cardId: "SOR_150" }, { cardId: "SOR_103" }, { cardId: "SOR_168" },
    ]));
    res = dispatch(res.context, "choose-option", { option: "player_discards_from_hand=2,1" });

    const remaining = res.context.game.currentGameState.player2.hand.map(c => c.cardId);
    expect(remaining).toEqual(["SOR_150", "SOR_103"]); // the Common went
  });

  it("is deterministic — the same board always discards the same card", () => {
    const hand = [{ cardId: "SOR_150" }, { cardId: "SOR_168" }, { cardId: "SOR_095" }];
    const discarded = () => {
      let res = attackIntoBlocker(newCtx(hand));
      res = dispatch(res.context, "choose-option", { option: "player_discards_from_hand=2,1" });
      return res.context.game.currentGameState.player2.hand.map(c => c.cardId);
    };
    expect(discarded()).toEqual(discarded());
    expect(discarded()).toEqual(discarded());
  });

  it("choosing Discard against an empty opponent hand does not get stuck (Rebel Assault)", () => {
    let res = attackIntoBlocker(newCtx([]));
    res = dispatch(res.context, "choose-option", { option: "player_discards_from_hand=2,1" });

    expect(res.response.resolutionNeeded).toBeFalsy();
    expect(res.context.game.currentGameState.player1.hand).toHaveLength(1);
  });
});
