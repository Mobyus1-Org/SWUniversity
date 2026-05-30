import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_065 Nala Se — On Attack: You may disclose Vigilance×Vigilance.
// If you do, heal up to 4 damage from among other units.
// Two AT-AT Suppressors (SOR_039, Vigilance+Villainy) in hand cover the disclose.

describe("SEC_065 Nala Se", () => {
  it("offers disclose option when hand has 2 Vigilance cards", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.directorKrennic) // Vigilance+Villainy
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sec.nalaSe)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 2) // a unit to potentially heal
        .WithCardInHandForPlayer(1, Cards.units.sor.atAtSuppressor)
        .WithCardInHandForPlayer(1, Cards.units.sor.atAtSuppressor)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Option");
  });

  it("heals another unit after disclosing", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sec.nalaSe)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.atAtSuppressor)
      .WithCardInHandForPlayer(1, Cards.units.sor.atAtSuppressor)
      .Build();
    g.loadNewState(state);

    const damagedMarinePlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1); // disclose
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: damagedMarinePlayId, damage: 3 }],
    });

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    // No rebound
    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });

  it("cannot target itself (Nala Se excluded from eligible)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sec.nalaSe, true, 2)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.sor.atAtSuppressor)
      .WithCardInHandForPlayer(1, Cards.units.sor.atAtSuppressor)
      .Build();
    g.loadNewState(state);

    const nalaSe = state.player1.groundArena[0];

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    const result = await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: nalaSe.playId, damage: 2 }],
    });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.groundArena[0].damage).toBe(2); // unchanged
  });

  it("skips ability when hand cannot disclose Vigilance×Vigilance", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.directorKrennic)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sec.nalaSe)
        // No Vigilance cards in hand
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
