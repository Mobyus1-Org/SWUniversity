import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../../card-helpers";
import { NeedsTarget } from "@/lib/engine/message-types";

describe("Upgrade target tests", () => {
  it("can attach to any eligible unit", async () => {
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
      .WithSpaceUnitForPlayer(1, Cards.units.sor.brightHope)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.brightHope)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    // assert
    const lastDispatch = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(lastDispatch!.fromPlayIds!.length).toBe(4);
  });

  it("can attach to any Force unit", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(1, Cards.upgrades.lof.bolsteredEndurance)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.jtl.lukeSkywalker)
      .WithGroundUnitForPlayer(2, Cards.units.jtl.lukeSkywalker)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    // assert
    const lastDispatch = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(lastDispatch!.fromPlayIds!.length).toBe(2);
  });

  it("can attach to only friendly eligible units", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.brightHope)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.brightHope)
      .WithCardInHandForPlayer(1, Cards.upgrades.shd.legalAuthority)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 0);
    // assert
    const lastDispatch = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(lastDispatch!.fromPlayIds!.length).toBe(2);
  });
});