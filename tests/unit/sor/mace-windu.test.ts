import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_149 Mace Windu (5/7) — "Ambush. When this unit attacks and defeats a unit: Ready him."
describe("SOR_149 Mace Windu — ready on attack + defeat", () => {
  it("readies himself after attacking and defeating an enemy unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.maceWinduUnit)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3, defeated by Mace's 5 power
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0); // Marine defeated
    expect(g.state.player1.groundArena[0].ready).toBe(true); // Mace readied by his ability
  });

  it("does NOT ready himself when attacking the base (no unit defeated)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.maceWinduUnit)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5); // Mace hit the base
    expect(g.state.player1.groundArena[0].ready).toBe(false); // stayed exhausted
  });
});
