import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_183 Bounty Hunter Crew (Han Solo) — 3/3 Ground (Cunning+Villainy), cost 6
// "Ambush. When Played: You may return an event from a discard pile to its owner's hand."

describe("SOR_183 Bounty Hunter Crew", () => {
  it("returns an event from own discard to hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)    // Cunning base
      .MyLeader(Cards.leaders.sor.bobaFett)     // Cunning+Villainy — covers both aspects
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.bountyHunterCrew)
      .Build();
    g.loadNewState(state);

    state.player1.discard.push({ cardId: Cards.events.sor.openFire, playId: "9001", owner: 1, controller: 1, turnDiscarded: 1, discardEffect: "" });

    await g.playCardFromHandAsync(1, 0);
    const handBefore = g.state.player1.hand.length;
    await g.chooseOptionAsync(1, "Bounty Hunter Crew — When Played"); // trigger-order: When Played first
    await g.chooseYesAsync(1); // ability-option: return an event
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["9001"] });

    expect(g.state.player1.hand.length).toBe(handBefore + 1);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.events.sor.openFire)).toBe(true);
  });

  it("returns an event from opponent's discard to their hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.bountyHunterCrew)
      .Build();
    g.loadNewState(state);

    state.player2.discard.push({ cardId: Cards.events.sor.bombingRun, playId: "9002", owner: 2, controller: 2, turnDiscarded: 1, discardEffect: "" });

    const handBefore2 = g.state.player2.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Bounty Hunter Crew — When Played"); // trigger-order: When Played first
    await g.chooseYesAsync(1); // ability-option: return an event
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["9002"] });

    expect(g.state.player2.hand.length).toBe(handBefore2 + 1);
  });

  it("skips when player declines", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.bountyHunterCrew)
      .Build();
    g.loadNewState(state);

    state.player1.discard.push({ cardId: Cards.events.sor.openFire, playId: "9003", owner: 1, controller: 1, turnDiscarded: 1, discardEffect: "" });

    await g.playCardFromHandAsync(1, 0);
    const handBefore = g.state.player1.hand.length;
    await g.chooseOptionAsync(1, "Bounty Hunter Crew — When Played"); // trigger-order: When Played first
    await g.chooseNoAsync(1); // decline: skip returning

    expect(g.state.player1.hand.length).toBe(handBefore);
  });

  it("no prompt when both discards have no events", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.bountyHunterCrew)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
