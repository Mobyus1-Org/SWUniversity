import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// ASH_056 Huyang (2/4 Ground) —
//   "On Attack: You may give an upgraded unit –4/–0 for this phase."
describe("ASH_056 Huyang", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("may give a chosen upgraded unit -4/-0 for this phase (accept)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.huyang)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // 4 power
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
        ])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(2); // 4 + 2 (XP) - 4
  });

  it("may decline the debuff", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.huyang)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
        ])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(6); // 4 + 2 (XP), no debuff
  });

  it("control: fizzles when no upgraded unit exists", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.huyang)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // not upgraded
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
