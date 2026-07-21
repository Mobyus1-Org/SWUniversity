import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_097 Imperial Door Technician (2/2 Ground, cost 1, Imperial Trooper)
// "When Defeated: Heal 2 damage from your base."
//
// "your base" = the base of whoever CONTROLS the unit when it is defeated.

function baseSetup() {
  return new GameStateBuilder()
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14);
}

describe("LAW_097 Imperial Door Technician", () => {
  it("heals 2 damage from its controller's base when defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyBase(Cards.bases.common.green30HP, 8)
        .TheirBase(Cards.bases.common.green30HP, 8)
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, Cards.units.law.imperialDoorTechnician)   // 2/2
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)    // 3 power — kills it
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(6); // 8 - 2
    expect(g.state.player2.base.damage).toBe(8); // the opponent's base is untouched
  });

  it("a unit without the ability heals nothing (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyBase(Cards.bases.common.green30HP, 8)
        .TheirBase(Cards.bases.common.green30HP, 8)
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)        // 3/3, no ability
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(8);
  });

  it("heals only the damage that is there — never below zero", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyBase(Cards.bases.common.green30HP, 1) // only 1 damage to heal
        .TheirBase(Cards.bases.common.green30HP)
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, Cards.units.law.imperialDoorTechnician)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(0);
  });

  it("is a no-op on an undamaged base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyBase(Cards.bases.common.green30HP)
        .TheirBase(Cards.bases.common.green30HP)
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, Cards.units.law.imperialDoorTechnician)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(0);
  });

  it("heals the CONTROLLER's base when the opponent controls it", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .MyBase(Cards.bases.common.green30HP, 8)
      .TheirBase(Cards.bases.common.green30HP, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // 3 power attacker
      .WithGroundUnitForPlayer(2, Cards.units.law.imperialDoorTechnician)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.base.damage).toBe(6); // P2 controlled it, so P2's base healed
    expect(g.state.player1.base.damage).toBe(8);
  });

  it("does not heal while base healing is prevented", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyBase(Cards.bases.common.green30HP, 8)
        .TheirBase(Cards.bases.common.green30HP, 8)
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, Cards.units.law.imperialDoorTechnician)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithSpaceUnitForPlayer(2, Cards.units.twi.confederateTriFighter) // "Bases can't be healed."
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(8);
  });
});
