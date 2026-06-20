import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("ASH_229 Camtono", () => {
  it("When Attack Ends: plays a top card costing 2 or less for free", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        { cardId: Cards.upgrades.ash.camtono, playId: "@", owner: 1, controller: 1 },
      ])
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // top of deck, cost 2
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack the enemy Marine
    await g.chooseOptionAsync(1, "Yes"); // Camtono: play top card free

    // Battlefield Marine entered play; Sandcrawler still there → 2 friendly units
    expect(g.state.player1.groundArena).toHaveLength(2);
    expect(g.state.player1.deck).toHaveLength(0);
    // Free play exhausted no resources
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(5);
  });

  it("When Attack Ends: does not offer a card costing more than 2", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        { cardId: Cards.upgrades.ash.camtono, playId: "@", owner: 1, controller: 1 },
      ])
      .WithCardInDeckForPlayer(1, Cards.units.sor.gamorreanGuards) // top of deck, cost 4
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack; no Camtono prompt should appear

    // Top card too expensive → stays in deck, nothing played
    expect(g.state.player1.deck).toHaveLength(1);
    expect(g.state.player1.groundArena).toHaveLength(1);
  });
});
