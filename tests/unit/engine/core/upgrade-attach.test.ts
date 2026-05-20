import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import { NeedsTarget } from "@/lib/engine/message-types";

describe("Simple Upgrade Attach", () => {
  it("should deal 5 damage to base on attack due to buffed stats", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.academyTraining)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithInitiativePlayerBeing(2)
      .WithInitiativeClaimed()
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    // assert
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("should only return Force units when choosing target for Bolstered Endurance", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP, 5)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.upgrades.lof.bolsteredEndurance)
      .WithGroundUnitForPlayer(1, Cards.units.lof.gungi)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithInitiativePlayerBeing(2)
      .WithInitiativeClaimed()
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    const lastDispatch = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(lastDispatch.fromPlayIds!.length).toBe(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    // assert
    expect(g.state.player1.base.damage).toBe(5);
    expect(g.state.player2.base.damage).toBe(3);
    expect(g.state.player1.resources.filter((r) => r.ready).length).toBe(2);
  });
});