import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// ASH_209 Ezra Bridger (6/6 Ground, cost 6)
// "Support (…)"
// "On Attack: If this unit is upgraded, you may give a unit –3/–0 for this phase."

function ownUpgrade(cardId: string) {
  return { cardId, playId: "@", owner: 1 as const, controller: 1 as const };
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_209 Ezra Bridger", () => {
  it("On Attack: while upgraded, gives a unit –3/–0 for the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.ezraBridger)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [ownUpgrade(Cards.upgrades.token.shield)])
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0); // debuff the enemy guard

    const guard = Unit.FromInterface(g.state.player2.groundArena[0]);
    // Power drops by 3; HP is untouched (–3/–0, not –3/–3).
    expect(guard.CurrentPower()).toBe(1); // 4 – 3
    expect(guard.TotalHP()).toBe(6);   // HP untouched by a –3/–0
  });

  it("no prompt when it is not upgraded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.ezraBridger)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    const res = await g.chooseBaseAsync(1, 2);

    expect(res.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("declining gives no debuff", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.ezraBridger)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [ownUpgrade(Cards.upgrades.token.shield)])
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)
        .Build(),
    );

    const res = await g.attackWithGroundUnitAsync(1, 0).then(() => g.chooseBaseAsync(1, 2));
    expect(res.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(4);
  });
});
