import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_167 Force Throw (Event, Aggression, cost 1)
// Choose a player. That player discards a card from their hand.
// Then, if you control a FORCE unit, you may deal damage to a unit equal to the cost of the discarded card.

describe("SOR_167 Force Throw", () => {
  it("chosen opponent discards a card from their hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP) // Aggression base
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(1, Cards.events.sor.forceThrow)
      .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue) // opponent has 1 card
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0); // play Force Throw
    await g.dispatchAsync(1, "choose-option", { option: "Yes" }); // choose opponent to discard
    await g.chooseCardFromHandAsync(2, 0); // opponent discards their card

    expect(g.state.player2.hand.length).toBe(0); // opponent's card is gone
  });

  it("chosen self discards a card from their own hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(1, Cards.events.sor.forceThrow)
      .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0); // play Force Throw
    await g.dispatchAsync(1, "choose-option", { option: "No" }); // choose self
    await g.chooseCardFromHandAsync(1, 0); // player 1 discards their remaining card

    expect(g.state.player1.hand.length).toBe(0);
  });

  it("with a Force unit in play, offers damage equal to discarded card's cost", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.yoda) // FORCE unit
      .WithGroundUnitForPlayer(2, Cards.units.sor.wampa) // 4/4 — survives 3 damage
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(1, Cards.events.sor.forceThrow)
      .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue) // cost 3
      .Build();
    g.loadNewState(state);

    const wampaPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Yes" }); // opponent discards
    await g.chooseCardFromHandAsync(2, 0); // opponent discards strikeTrue (cost 3)
    await g.dispatchAsync(1, "choose-option", { option: "Yes" }); // yes, deal damage
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampaPlayId] });

    expect(g.state.player2.groundArena[0].damage).toBe(3); // 3 damage from cost of strikeTrue
  });

  it("without a Force unit, no damage offer after discard", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(1, Cards.events.sor.forceThrow)
      .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Yes" }); // opponent discards
    await g.chooseCardFromHandAsync(2, 0); // opponent discards

    // No pending — game should be fully resolved (no damage option prompt)
    expect(g.state.player2.hand.length).toBe(0);
    // No further action needed — state should be settled
  });

  it("choosing an opponent with an empty hand resolves as a no-op instead of hanging", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(1, Cards.events.sor.forceThrow)
      .Build(); // the opponent holds no cards
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Yes" }); // opponent discards — but has nothing

    // There is no card to pick, so the ability must not leave a pending resolution behind.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.hand.length).toBe(0);
  });
});
