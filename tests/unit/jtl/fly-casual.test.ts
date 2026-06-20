import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("JTL_206 Fly Casual", () => {
  it("readies a chosen Vehicle and marks it unable to attack bases this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      // Exhausted Vehicle to be readied
      .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler, false)
      .WithCardInHandForPlayer(1, Cards.events.jtl.flyCasual)
      .Build();
    g.loadNewState(state);

    expect(g.state.player1.groundArena[0].ready).toBe(false);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // ready the Sandcrawler

    const sandcrawlerPlayId = g.state.player1.groundArena[0].playId;
    expect(g.state.player1.groundArena[0].ready).toBe(true);
    expect(
      g.state.currentEffects.some(
        e => e.cardId === "JTL_206_no_base" && e.targetPlayId === sandcrawlerPlayId,
      ),
    ).toBe(true);
  });

  it("does nothing when the player controls no Vehicle", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, false) // not a Vehicle
      .WithCardInHandForPlayer(1, Cards.events.jtl.flyCasual)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // Event fizzles; the non-Vehicle stays exhausted and the event is in discard.
    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player1.discard.some(c => c.cardId === Cards.events.jtl.flyCasual)).toBe(true);
  });
});
