import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("LAW_238 Scavenging Sandcrawler", () => {
  it("On Attack: moves a chosen discard card to the bottom of the deck and creates a Credit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler) // ready, 1/7
      .WithCardInDiscardForPlayer(1, Cards.events.jtl.flyCasual)
      // an enemy unit to attack so combat resolves on a unit
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    expect(g.state.player1.deck).toHaveLength(0);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack the enemy Marine
    await g.chooseOptionAsync(1, "Yes"); // use the On Attack ability
    await g.dispatchAsync(1, "choose-target", {
      targetPlayIds: [g.state.player1.discard[0]?.playId ?? state.player1.discard[0].playId],
    });

    expect(g.state.player1.supplemental.creditTokens).toBe(1);
    // Fly Casual moved from discard to the bottom of the deck (deck top is the last element)
    expect(g.state.player1.discard).toHaveLength(0);
    expect(g.state.player1.deck).toHaveLength(1);
    expect(g.state.player1.deck[0].cardId).toBe(Cards.events.jtl.flyCasual);
  });

  it("On Attack: declining the ability creates no Credit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler)
      .WithCardInDiscardForPlayer(1, Cards.events.jtl.flyCasual)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseOptionAsync(1, "No");

    expect(g.state.player1.supplemental.creditTokens ?? 0).toBe(0);
    expect(g.state.player1.discard).toHaveLength(1);
  });
});
