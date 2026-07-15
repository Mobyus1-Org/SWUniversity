import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_168 Migs Mayfeld (2/3 Ground, cost 2)
// "Support (…)"
// "On Attack: Deal 1 damage to the defending unit. If this unit is upgraded, deal 2 damage to the
//  defending unit instead."

function ownUpgrade(cardId: string) {
  return { cardId, playId: "@", owner: 1 as const, controller: 1 as const };
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("ASH_168 Migs Mayfeld", () => {
  it("On Attack: deals 1 damage to the defending unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.migsMayfeld)          // 2 power
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)  // big enough to survive
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // 1 from the On Attack + 2 combat damage.
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("deals 2 instead while it is upgraded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.migsMayfeld)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [ownUpgrade(Cards.upgrades.token.experience)]) // +1/+1
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // 2 from the On Attack + 3 combat damage (2 power +1 Experience).
    expect(g.state.player2.groundArena[0].damage).toBe(5);
  });

  it("Support grants the On Attack — the supported attacker deals the extra damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power, unupgraded
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)
        .WithCardInHandForPlayer(1, Cards.units.ash.migsMayfeld)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4); // 1 On Attack + 3 combat
  });
});
