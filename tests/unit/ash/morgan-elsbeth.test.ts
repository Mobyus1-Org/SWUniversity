import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// ASH_050 Morgan Elsbeth (5/6 Ground, cost 6)
// "Support (…)"
// "When Defeated: You may give a unit –2/–2 for this phase."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_050 Morgan Elsbeth", () => {
  it("When Defeated: gives a chosen unit –2/–2 for the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.morganElsbeth, true, 5) // 1 HP left
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)    // 4/6 kills her back
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)      // the debuff target
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // she dies to the counter-damage
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 1); // debuff the undamaged Marine

    expect(g.state.player1.groundArena).toHaveLength(0); // Morgan died
    const marine = Unit.FromInterface(g.state.player2.groundArena[1]);
    expect(marine.CurrentPower()).toBe(1); // 3 – 2
    expect(marine.TotalHP()).toBe(1);      // 3 – 2
  });

  it("declining gives no debuff", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.morganElsbeth, true, 5)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    const res = await g.chooseGroundUnitAsync(2, 0);
    expect(res.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(Unit.FromInterface(g.state.player2.groundArena[1]).CurrentPower()).toBe(3);
  });
});
