import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// JTL_060 Desperate Commando (2/2 Ground, cost 2)
// "When Defeated: You may give a unit –1/–1 for this phase."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    // Commando (2/2) attacks a Battlefield Marine (3/3) — the Commando takes 3 and dies,
    // leaving the Marine on 2 damage. A second, undamaged Marine is the clean debuff target.
    .WithGroundUnitForPlayer(1, Cards.units.jtl.desperateCommando)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine);
}

describe("JTL_060 Desperate Commando — When Defeated", () => {
  it("gives a unit –1/–1 for this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 1); // the untouched Marine

    const target = Unit.FromInterface(g.state.player2.groundArena[1]);
    expect(target.CurrentPower()).toBe(2); // 3 - 1
    expect(target.TotalHP()).toBe(2); // 3 - 1
  });

  it("defeats a unit whose remaining HP drops to 0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0); // the Marine that traded — 2 damage on a 3 HP body

    // –1/–1 puts it at 2 HP with 2 damage → defeated.
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("declining leaves stats untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    const traded = await g.chooseGroundUnitAsync(2, 0);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(traded.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    const target = Unit.FromInterface(g.state.player2.groundArena[1]);
    expect(target.CurrentPower()).toBe(3);
    expect(target.TotalHP()).toBe(3);
  });

  it("can target a friendly unit ('a unit' — either side)", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // own Marine (Commando is gone)

    const friendly = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(friendly.CurrentPower()).toBe(2);
    expect(friendly.TotalHP()).toBe(2);
  });
});
