import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

describe("SHD_056 Follower of The Way", () => {
  it("has base stats 3/1 with no upgrades", () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.shd.followerOfTheWay)
      .Build();
    g.loadNewState(state);

    const unit = Unit.FromInterface(state.player1.groundArena[0]);
    expect(unit.CurrentPower()).toBe(1);
    expect(unit.TotalHP()).toBe(3);
  });

  it("gets +1/+1 while upgraded (becomes 2/4)", () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.shd.followerOfTheWay)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 1),
      ])
      .Build();
    g.loadNewState(state);

    const unit = Unit.FromInterface(state.player1.groundArena[0]);
    expect(unit.CurrentPower()).toBe(2);  // 1 base + 1 (while upgraded)
    expect(unit.TotalHP()).toBe(4);       // 3 base + 1 (while upgraded)
  });

  it("loses the bonus when the upgrade is removed", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.shd.followerOfTheWay)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 1),
      ])
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.sor.confiscate)
      .Build();
    g.loadNewState(state);

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(2);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseUpgradeOnGroundUnitAsync(1, 1, 0, 0);

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(1);
  });
});
