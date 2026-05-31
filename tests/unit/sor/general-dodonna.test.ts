import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_242 General Dodonna — 4/4 Ground (Rebel/Command), cost 4
// "Other friendly Rebel units get +1/+1."

describe("SOR_242 General Dodonna", () => {
  it("grants +1 power to another friendly Rebel unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalDodonna)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel, 3/3 → 4/4
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);
    const marinePlayId = state.player1.groundArena[1].playId;
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    // Marine has 4 power with Dodonna bonus
    expect(g.state.player2.groundArena[0].damage).toBe(4);
  });

  it("does not buff non-Rebel units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalDodonna)
      .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper) // Imperial, not Rebel
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    // Death Trooper has base 3 power, no bonus
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });
});
