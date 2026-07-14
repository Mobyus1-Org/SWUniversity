import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// LOF_031 Karis (2/4 Ground, cost 2)
// "When Defeated: You may use the Force (lose your Force token).
//  If you do, give a unit –2/–2 for this phase."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    // Karis (2/4) already has 2 damage — attacking a Battlefield Marine (3/3) takes her to 5 and she dies.
    .WithGroundUnitForPlayer(1, Cards.units.lof.karis, true, 2)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine);
}

describe("LOF_031 Karis — When Defeated", () => {
  it("uses the Force to give a unit –2/–2 for this phase", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup().Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 1); // the untouched Marine

    expect(g.state.player1.supplemental.forceToken).toBe(false); // the Force was used
    const target = Unit.FromInterface(g.state.player2.groundArena[1]);
    expect(target.CurrentPower()).toBe(1); // 3 - 2
    expect(target.TotalHP()).toBe(1); // 3 - 2
  });

  it("declining keeps the Force token and applies no debuff", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup().Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    const traded = await g.chooseGroundUnitAsync(2, 0);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(traded.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.supplemental.forceToken).toBe(true); // kept
    const target = Unit.FromInterface(g.state.player2.groundArena[1]);
    expect(target.CurrentPower()).toBe(3);
    expect(target.TotalHP()).toBe(3);
  });

  it("no prompt at all without a Force token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build()); // no Force token

    await g.attackWithGroundUnitAsync(1, 0);
    const traded = await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena).toHaveLength(0); // Karis died
    expect(traded.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    const target = Unit.FromInterface(g.state.player2.groundArena[1]);
    expect(target.CurrentPower()).toBe(3);
  });
});
