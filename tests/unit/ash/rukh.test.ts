import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_036 Rukh (1/5 Ground, cost 3)
// "Support (…)"
// "When Attack Ends: If the defending unit was defeated, you may give 3 Advantage tokens to a unit."

function advantage(unit: { upgrades: { cardId: string }[] }): number {
  return unit.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage).length;
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("ASH_036 Rukh", () => {
  it("gives 3 Advantage tokens to a chosen unit after defeating the defender", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.rukh)                        // 1 power
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 2)  // 1 HP left → dies
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // give them to Rukh himself

    expect(advantage(g.state.player1.groundArena[0])).toBe(3);
  });

  it("declining gives no tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.rukh)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    const res = await g.chooseGroundUnitAsync(2, 0);
    expect(res.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(advantage(g.state.player1.groundArena[0])).toBe(0);
  });

  it("no prompt when the defender survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.rukh)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // survives 1 damage
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    const res = await g.chooseGroundUnitAsync(2, 0);

    expect(res.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
