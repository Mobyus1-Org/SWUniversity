import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_059 Leia Organa (3/4 Ground, cost 3)
// "Support (…)"
// "On Attack: You may deal 1 damage to this unit. If you do, heal 2 damage from your base."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 5)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("ASH_059 Leia Organa", () => {
  it("On Attack: accepting deals 1 to herself and heals 2 from your base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.ash.leiaOrgana).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    expect(g.state.player1.base.damage).toBe(3); // 5 – 2
    expect(g.state.player1.groundArena[0].damage).toBe(1);
  });

  it("declining leaves her undamaged and the base unhealed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.ash.leiaOrgana).Build());

    const attacked = await g.attackWithGroundUnitAsync(1, 0);
    expect(attacked.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    const targeted = await g.chooseBaseAsync(1, 2);
    expect(targeted.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.base.damage).toBe(5);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });

  it("Support grants the On Attack — the supported attacker takes the damage and heals your base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.ash.leiaOrgana)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);            // use Support
    await g.chooseGroundUnitAsync(1, 0);  // the Marine attacks
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);            // use the granted On Attack

    expect(g.state.player1.base.damage).toBe(3); // 5 – 2
    // "this unit" in the granted text means the attacker — the Marine, not Leia.
    const marine = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    const leia = g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.leiaOrgana)!;
    expect(marine.damage).toBe(1);
    expect(leia.damage).toBe(0);
  });
});
