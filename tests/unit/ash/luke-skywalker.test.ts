import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_112 Luke Skywalker (5/6/5 Ground, cost 6) —
// "Restore 1\nWhen Played: If you control at least 4 units, deal 3 damage to each enemy unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 6) // damage for Restore
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
    .WithCardInHandForPlayer(1, Cards.units.ash.lukeSkywalker);
}

describe("ASH_112 Luke Skywalker — Restore 1", () => {
  it("heals 1 damage from your base when it attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.ash.lukeSkywalker).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(5); // 6 - 1 restored
  });
});

describe("ASH_112 Luke Skywalker — When Played: 4+ units → 3 damage to each enemy unit", () => {
  it("deals 3 damage to each enemy unit when you control at least 4 units (defeats the weak one, damages the tough one)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid)
        .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid)
        .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid) // 3 friendly units + Luke = 4
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/2 — dies to 3 damage
        .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft) // 3/4 — survives, damaged
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(false);
    const craft = g.state.player2.spaceArena.find(u => u.cardId === Cards.units.sor.systemPatrolCraft)!;
    expect(craft.damage).toBe(3);
  });

  it("does not deal damage when you control fewer than 4 units (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid) // 1 friendly unit + Luke = 2
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const marine = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    expect(marine.damage).toBe(0);
  });

  it("does not damage friendly units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid)
        .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid)
        .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.token.battleDroid && u.damage > 0)).toBe(false);
  });
});
