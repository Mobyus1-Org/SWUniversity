import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_101 The Great Mothers (6/7 Ground, cost 7)
// "Support"
// "When Attack Ends: If this unit dealt combat damage to 1 or more non-leader units, defeat those units."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_101 The Great Mothers", () => {
  it("defeats a non-leader unit it damaged, even one that survived the damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.theGreatMothers)
        // A 4/6 with a Shield would absorb; use a big HP unit that survives 6 damage:
        .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0); // damaged → defeated outright
  });

  it("defeats nothing when a Shield absorbed the damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.theGreatMothers)
        .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.token.shield, playId: "@", owner: 2 as const, controller: 2 as const },
        ])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // No combat damage was dealt, so there is nothing for the ability to defeat.
    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("Support grants it — the supported attacker defeats what it damaged", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power
        // Doctor Pershing: 0 power, 4 HP — survives the 3 combat damage and deals none back,
        // so the attacker lives to fire the granted ability that defeats what it damaged.
        .WithGroundUnitForPlayer(2, Cards.units.ash.doctorPershing)
        .WithCardInHandForPlayer(1, Cards.units.ash.theGreatMothers)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });
});
