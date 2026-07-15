import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_223 Halo (4/4 Space, cost 5)
// "Support (…)"
// "When Attack Ends: If the defending unit was defeated, give a Shield token to this unit."

function shields(unit: { upgrades: { cardId: string }[] }): number {
  return unit.upgrades.filter(u => u.cardId === Cards.upgrades.token.shield).length;
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_223 Halo", () => {
  it("gains a Shield token after defeating the defending unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.halo)
        .WithSpaceUnitForPlayer(2, Cards.units.token.xWing) // 2/2, dies to 4 power
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(shields(g.state.player1.spaceArena[0])).toBe(1);
  });

  it("gains nothing when the defender survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.halo)
        .WithSpaceUnitForPlayer(2, Cards.units.ash.unsanctionedPatrol) // 4/4 survives? 4 dmg = lethal
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // attack the base instead — no defending unit at all

    expect(shields(g.state.player1.spaceArena[0])).toBe(0);
  });

  it("Support grants it — the supported attacker gets the Shield", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.token.xWing)  // 2/2
        .WithSpaceUnitForPlayer(2, Cards.units.token.tieFighter) // 1/1, dies
        .WithCardInHandForPlayer(1, Cards.units.ash.halo)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    const xwing = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.token.xWing)!;
    expect(shields(xwing)).toBe(1);
  });
});
