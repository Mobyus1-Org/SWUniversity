import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";
import { Cards } from "../../card-helpers";

// SHD_172 Krayt Dragon — Legendary Creature, 10/10, cost 9, Ground, Aggression.
// "Overwhelm
//  When an opponent plays a card: You may deal damage equal to that card's cost to their
//  base or a ground unit they control."

describe("SHD_172 Krayt Dragon", () => {
  it("has Overwhelm", () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.shd.kraytDragon)
      .Build();
    g.loadNewState(state);
    const krayt = state.player1.groundArena[0];
    expect(HasOverwhelm(krayt.cardId, krayt.playId, 1)).toBe(true);
  });

  it("when an opponent plays a card, may deal damage equal to its cost to their base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
      .WithGroundUnitForPlayer(2, Cards.units.shd.kraytDragon)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "choose-option", { option: "Yes" });
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: ["player1.base"] });

    expect(g.state.player1.base.damage).toBe(2); // = Battlefield Marine's cost
  });

  it("can instead deal that damage to a ground unit the opponent controls", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
      .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards) // P1 ground unit (4 HP)
      .WithGroundUnitForPlayer(2, Cards.units.shd.kraytDragon)
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player1.groundArena[0].playId; // gamorrean

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "choose-option", { option: "Yes" });
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [targetPlayId] });

    const gamorrean = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.gamorreanGuards)!;
    expect(gamorrean.damage).toBe(2);
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("may decline — no damage dealt", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.shd.kraytDragon)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "choose-option", { option: "No" });

    expect(g.state.player1.base.damage).toBe(0);
  });

  it("does not trigger off its own controller playing a card", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.shd.kraytDragon)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(2, 0);

    // Krayt's controller (P2) played — no reaction against anyone.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(0);
  });
});

// Puzzle mode: the opponent (P2) controls Krayt Dragon. Playing a card must offer the active
// player a trigger-order choice between their own triggers and the opponent's Krayt reaction
// (CR 7.6.10), and the opponent's Krayt auto-resolves onto the human's base.
describe("SHD_172 Krayt Dragon — puzzle mode (opponent controls it)", () => {
  // P1 base SOR_029 at 20 damage; P1 has the Force and Darth Tyranus (LOF_231, cost 4) in hand
  // — with the Force, Tyranus has Shielded + Ambush. P2 controls Krayt Dragon.
  const rawPuzzle = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
    initiativePlayer: 2, initiativeClaimed: true,
    player1: {
      base: { cardId: "SOR_029", damage: 20, epicActionUsed: false },
      leader: { cardId: "LOF_017", ready: true, deployed: false, epicActionUsed: false },
      groundArena: [
        { cardId: "LOF_183", playId: "@", owner: 1, controller: 1, ready: true, damage: 1,
          upgrades: [{ cardId: "SOR_T02", playId: "@", owner: 1, controller: 1 }], captives: [] },
      ],
      spaceArena: [],
      resources: Array(4).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
      discard: [], deck: [], hand: [{ cardId: "LOF_231" }],
      supplemental: { creditTokens: 0, forceToken: true },
    },
    player2: {
      base: { cardId: "SOR_023", damage: 10, epicActionUsed: false },
      leader: { cardId: "JTL_014", ready: true, deployed: false, epicActionUsed: false },
      groundArena: [
        { cardId: "SOR_059", playId: "@", owner: 2, controller: 2, ready: true, damage: 1, upgrades: [], captives: [] },
        { cardId: "SHD_172", playId: "@", owner: 2, controller: 2, ready: true, damage: 0, upgrades: [], captives: [] },
      ],
      spaceArena: [],
      resources: Array(3).fill(null).map(() => ({ cardId: "LAW_174", playId: "@", owner: 2, controller: 2, ready: true })),
      discard: [], deck: [], hand: [],
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

  it("playing Tyranus asks which player's triggers resolve first (Mine/Theirs), not per-trigger", () => {
    const res = dispatch(newCtx(), "play-card", { cardId: "LOF_231", fromZone: "Hand" });
    const needed = res.response.resolutionNeeded;
    const options = needed?.type === "Option" ? needed.options : [];
    expect(needed?.type === "Option" ? needed.helperText : undefined).toBe("Which Triggers Should Resolve First?");
    expect(options).toEqual(["Mine", "Theirs"]);
  });

  it("choosing 'Theirs' takes 4 to the base before resolving Tyranus's own triggers", () => {
    let res = dispatch(newCtx(), "play-card", { cardId: "LOF_231", fromZone: "Hand" });
    // Opponent's stack first — the Krayt reaction auto-resolves onto P1's base.
    res = dispatch(res.context, "choose-option", { option: "Theirs" });
    // Tyranus costs 4 → base 20 + 4 = 24, applied before P1 resolves their own triggers.
    expect(res.context.game.currentGameState.player1.base.damage).toBe(24);
  });

  it("choosing 'Mine' resolves your own triggers before the 4 to the base", () => {
    let res = dispatch(newCtx(), "play-card", { cardId: "LOF_231", fromZone: "Hand" });
    // Your stack first — the Krayt base damage has NOT happened yet.
    res = dispatch(res.context, "choose-option", { option: "Mine" });
    expect(res.context.game.currentGameState.player1.base.damage).toBe(20);
    // Next up is ordering P1's own two triggers (Shielded / Ambush), not the opponent's damage.
    const needed = res.response.resolutionNeeded;
    const options = needed?.type === "Option" ? needed.options : [];
    expect(options).toContain("Darth Tyranus — Shielded");
    expect(options).toContain("Darth Tyranus — Ambush");
    expect(options).not.toContain("Krayt Dragon — Reaction");
  });
});
