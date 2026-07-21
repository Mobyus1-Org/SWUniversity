import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { ADVANTAGE_TOKEN } from "@/server/engine/token-helpers";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// ASH_251 Zealous Soldier (2/3 Ground, cost 2)
// "When Played: Give an Advantage token to this unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_251 Zealous Soldier", () => {
  it("gives itself exactly one Advantage token when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.zealousSoldier)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const soldier = g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.zealousSoldier)!;
    // Exactly one — resolveWhenPlayed runs twice for units (preview + drain), so a token added
    // in the wrong place would double up here.
    expect(soldier.upgrades.filter(u => u.cardId === ADVANTAGE_TOKEN)).toHaveLength(1);

    // ...and it goes to itself, not to another friendly unit.
    const marine = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    expect(marine.upgrades.filter(u => u.cardId === ADVANTAGE_TOKEN)).toHaveLength(0);
  });

  it("is 3 power with its Advantage token (2 base + 1)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.zealousSoldier)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(3);
  });
});
