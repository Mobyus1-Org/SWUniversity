import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_101 Rogue Squadron Skirmisher — 4/6 Ground (Command+Heroism), cost 6
// "Ambush. When Played: Return a unit that costs 2 or less from your discard pile to your hand."
// Note: Ambush + WP → trigger-order prompt when played.

describe("SOR_101 Rogue Squadron Skirmisher", () => {
  it("returns a unit costing 2 or less from discard to hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)   // Command base
      .MyLeader(Cards.leaders.sor.chewbacca)  // Vigilance+Heroism covers Command+Heroism with base
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.rogueSquadronSkirmisher)
      .Build();
    g.loadNewState(state);

    state.player1.discard.push({ cardId: Cards.units.sor.battlefieldMarine, playId: "9001", owner: 1, controller: 1, turnDiscarded: 1, discardEffect: "" });

    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    // Trigger-order: Ambush + WP both queue; choose WP first to return from discard
    await g.chooseOptionAsync(1, "Rogue Squadron Skirmisher — When Played");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["9001"] });
    // Ambush fires: may attack (decline)
    await g.chooseNoAsync(1);

    // Squad removed from hand (-1), marine returned from discard (+1) → net 0
    expect(g.state.player1.hand.length).toBe(handBefore);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    expect(g.state.player1.discard.length).toBe(0);
  });

  it("does nothing when no eligible units in discard", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.rogueSquadronSkirmisher)
      .Build();
    g.loadNewState(state);

    // Only an expensive unit in discard
    state.player1.discard.push({ cardId: Cards.units.sor.reinforcementWalker, playId: "9002", owner: 1, controller: 1, turnDiscarded: 1, discardEffect: "" });

    await g.playCardFromHandAsync(1, 0);
    // Trigger-order; choose WP first (no eligible discard, auto-resolves)
    await g.chooseOptionAsync(1, "Rogue Squadron Skirmisher — When Played");
    // Then ambush fires; decline
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.reinforcementWalker)).toBe(false);
  });
});
