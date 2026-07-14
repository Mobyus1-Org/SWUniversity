import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { CardInPlay } from "@/lib/engine/core-models";

// JTL_147 Black One (2/3 Space, cost 2)
// "While this unit is upgraded, it gets +1/+0."
// "On Attack: If you control Poe Dameron (as a unit, upgrade, or leader), you may deal 1 damage to a unit."

function shieldOn(): CardInPlay[] {
  return [{ cardId: Cards.upgrades.token.shield, playId: "@", owner: 1, controller: 1 }];
}

function base(leader = Cards.leaders.sor.sabineWren) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren);
}

describe("JTL_147 Black One — while upgraded", () => {
  it("gets +1/+0 while it has an upgrade", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.blackOne)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, shieldOn())
        .Build(),
    );

    const unit = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(unit.CurrentPower()).toBe(3); // 2 + 1
    expect(unit.TotalHP()).toBe(3); // +0 HP
  });

  it("gets no bonus while it has no upgrade", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, Cards.units.jtl.blackOne).Build());

    const unit = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(unit.CurrentPower()).toBe(2);
  });
});

describe("JTL_147 Black One — On Attack", () => {
  it("deals 1 damage to a unit when you control Poe Dameron as a leader", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(Cards.leaders.jtl.poeDameron)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.blackOne)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("counts Poe Dameron controlled as a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.blackOne)
        .WithGroundUnitForPlayer(1, Cards.units.jtl.poeDameron)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("declining deals no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(Cards.leaders.jtl.poeDameron)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.blackOne)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    const attacked = await g.chooseBaseAsync(1, 2);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(attacked.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("does not trigger at all without a Poe Dameron", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.blackOne)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    const attacked = await g.chooseBaseAsync(1, 2);

    expect(attacked.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(2); // the attack still happened
  });
});
