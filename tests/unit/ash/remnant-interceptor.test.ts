import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_095 Remnant Interceptor (2/2 Space, cost 2)
// "Support (When you play this unit, you may attack with another unit. It gains this unit's other
//  abilities for this attack.)"
// "Restore 1 (When this unit attacks, heal 1 damage from your base.)"

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 5) // 5 damage to heal from
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, Cards.units.ash.remnantInterceptor);
}

describe("ASH_095 Remnant Interceptor", () => {
  it("Support grants Restore 1: the supported attacker heals your base when it attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(4); // 5 – 1 from the granted Restore
    expect(g.state.player2.base.damage).toBe(3); // the Marine's own 3 power
  });

  it("the same attacker heals nothing without the grant", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(5);
  });

  it("has Restore 1 on its own attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithSpaceUnitForPlayer(1, Cards.units.ash.remnantInterceptor).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(4);
    expect(g.state.player2.base.damage).toBe(2); // its own 2 power
  });
});
