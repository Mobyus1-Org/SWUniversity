import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_075 It Binds All Things — Heal up to 3 damage from a unit.
// If you control a FORCE unit, you may deal that much damage to another unit.
// Aspects: Vigilance. chirrutImwe (Vigilance+Heroism) covers it at cost 2.

describe("SOR_075 It Binds All Things", () => {
  it("heals a unit with no bonus damage when no Force unit is present", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.itBindsAllThings)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 3)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: marinePlayId, damage: 3 }],
    });

    expect(g.state.player1.groundArena[0].damage).toBe(0);
    // No Force unit — no follow-up damage pending
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("offers damage assignment when a Force unit is in play and heal > 0", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.itBindsAllThings)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 3)
      .WithGroundUnitForPlayer(1, Cards.units.lof.grogu) // Force unit
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: marinePlayId, damage: 2 }],
    });

    // Follow-up: spread-damage pending for the 2-damage assignment
    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("SpreadDamage");
    if (resolution?.type === "SpreadDamage") {
      expect(resolution.totalDamage).toBe(2);
      expect(resolution.optional).toBe(true);
    }
  });

  it("deals healed amount to a chosen unit after disclosing Force unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.itBindsAllThings)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 3)
      .WithGroundUnitForPlayer(1, Cards.units.lof.grogu)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const healTargetPlayId = state.player1.groundArena[0].playId;
    const damageTargetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: healTargetPlayId, damage: 2 }],
    });
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: damageTargetPlayId, damage: 2 }],
    });

    expect(g.state.player1.groundArena[0].damage).toBe(1); // 3 - 2 healed = 1 remaining
    expect(g.state.player2.groundArena[0].damage).toBe(2); // damaged
  });

  it("skips damage step when player passes on heal (zero healed)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.itBindsAllThings)
      .WithGroundUnitForPlayer(1, Cards.units.lof.grogu) // Force unit present
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [], // heal 0
    });

    // No damage step even though Force unit is present
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
