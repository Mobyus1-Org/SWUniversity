import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_258 Grassroots Resistance — "Deal 3 damage to a unit. Heal 3 damage from your base."
// ASH_258 is an identical reprint.

function baseState(eventCardId: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 5) // 5 damage to heal from
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
    .WithCardInHandForPlayer(1, eventCardId);
}

describe("SEC_258 Grassroots Resistance", () => {
  it("deals 3 damage to a chosen enemy unit and heals 3 from your base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState(Cards.events.sec.grassrootsResistance)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // 4 HP — survives 3 damage
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.state.player1.base.damage).toBe(2); // 5 - 3
  });

  it("can target a friendly unit ('a unit', not 'an enemy unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState(Cards.events.sec.grassrootsResistance)
        .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(3);
    expect(g.state.player1.base.damage).toBe(2);
  });

  it("defeats a unit the 3 damage is lethal to, and still heals", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState(Cards.events.sec.grassrootsResistance)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 HP
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(2);
  });

  it("heals even when there is no unit to damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState(Cards.events.sec.grassrootsResistance).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(2); // heal happened with no target
    expect(g.state.player1.hand).toHaveLength(0); // the event still resolved
  });

  it("never heals past 0 damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP, 1) // only 1 damage on the base
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithCardInHandForPlayer(1, Cards.events.sec.grassrootsResistance)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.base.damage).toBe(0);
  });

  it("ASH_258 reprint behaves identically", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState(Cards.events.ash.grassrootsResistance)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.state.player1.base.damage).toBe(2);
  });
});
