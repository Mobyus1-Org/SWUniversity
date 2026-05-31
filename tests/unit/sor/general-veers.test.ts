import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_230 General Veers — 3/3 Ground (Imperial/Command), cost 3
// "Other friendly Imperial units get +1/+1."

describe("SOR_230 General Veers", () => {
  it("grants +1 power to another friendly Imperial unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalVeers)
      .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper) // Imperial unit, 3/3
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9 target
      .Build();
    g.loadNewState(state);
    const deathTrooperPlayId = state.player1.groundArena[1].playId;
    const targetPlayId = state.player2.groundArena[0].playId;

    // Death Trooper attacks with +1 power (4 total instead of 3)
    await g.attackWithGroundUnitAsync(1, 1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.groundArena[0].damage).toBe(4);
  });

  it("grants +1 HP to another friendly Imperial unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalVeers)
      .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper) // Imperial, base 3/3 → 3/4 with Veers
      .WithGroundUnitForPlayer(2, Cards.units.sor.deathTrooper) // 3 power attacker
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);
    const deathTrooperP1PlayId = state.player1.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [deathTrooperP1PlayId] });

    // Death Trooper normally has 3 HP. With Veers it has 4. After taking 3 damage it survives.
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.deathTrooper)).toBe(true);
  });

  it("does not buff non-Imperial units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalVeers)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel, not Imperial
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);
    const marinePlayId = state.player1.groundArena[1].playId;
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    // Marine base power is 3, no bonus from Veers
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });
});
