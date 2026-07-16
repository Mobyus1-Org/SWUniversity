import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_079 K-2SO (3/5 Ground) —
//   "Ambush
//    On Attack: You may deal 3 damage to a damaged ground unit."
describe("LAW_079 K-2SO", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
  }

  it("On Attack: deals 3 damage to a chosen damaged ground unit (accept)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.law.k2so)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards, true, 2) // damaged enemy
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(5); // 2 + 3
  });

  it("On Attack: may decline the damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.law.k2so)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards, true, 2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("control: no prompt when no ground unit is damaged", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.law.k2so)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // undamaged
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("Ambush: may attack an enemy unit when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.law.k2so)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // accept Ambush attack
    await g.chooseGroundUnitAsync(2, 0);

    // 3-power K-2SO vs 3/3 Marine: Marine defeated; K-2SO (5 HP) took 3, survives.
    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(false);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.law.k2so)).toBe(true);
  });
});
