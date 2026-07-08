import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_131 Fifth Brother — "This unit gains Raid 1 for each damage on him.
// On Attack: You may deal 1 damage to this unit and 1 damage to another ground unit."
describe("SOR_131 Fifth Brother — On Attack self + ground damage", () => {
  it("deals 1 to himself and 1 to another chosen ground unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.fifthBrother)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // the "another ground unit"
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);           // attack the base (isolates the On Attack effect)
    await g.chooseYesAsync(1);               // opt into the ability
    await g.chooseGroundUnitAsync(2, 0);     // "another ground unit" = enemy Marine

    expect(g.state.player1.groundArena[0].damage).toBe(1); // Fifth Brother took 1 (self)
    expect(g.state.player2.groundArena[0].damage).toBe(1); // Marine took 1
  });

  it("deals no damage when the player declines", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.fifthBrother)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
