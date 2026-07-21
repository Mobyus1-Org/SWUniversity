import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_193 Frozen in Carbonite (Upgrade, cost 3, Cunning/Villainy, Condition)
// "Attach to a non-leader unit.
//  Attached unit can't ready.
//  When Played: Exhaust attached unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14);
}

describe("SHD_193 Frozen in Carbonite", () => {
  it("exhausts the attached unit when played", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.upgrades.shd.frozenInCarbonite)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    state.player2.groundArena[0].ready = true;
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const target = g.state.player2.groundArena[0];
    expect(target.upgrades.some(u => u.cardId === Cards.upgrades.shd.frozenInCarbonite)).toBe(true);
    expect(target.ready).toBe(false);
  });

  it("can only be attached to non-leader units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .TheirLeader(Cards.leaders.ash.ahsokaTano, true, true)
        .WithCardInHandForPlayer(1, Cards.upgrades.shd.frozenInCarbonite)
        .WithGroundUnitForPlayer(2, Cards.units.ash.ahsokaTano) // deployed leader unit
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toEqual([
      g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.consularSecurityForce)!.playId,
    ]);
  });

  it("keeps the attached unit exhausted through the regroup ready step", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.upgrades.shd.frozenInCarbonite)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // control: readies normally
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});
    await g.passResourceAsync(1);
    await g.passResourceAsync(2);

    expect(g.state.gamePhase).toBe("ActionPhase");
    expect(g.state.player2.groundArena[0].ready).toBe(false); // frozen
    expect(g.state.player2.groundArena[1].ready).toBe(true); // control
  });

  it("blocks an explicit ready effect (Keep Fighting)", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.upgrades.shd.frozenInCarbonite)
      .WithCardInHandForPlayer(1, Cards.events.sor.keepFighting)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power — legal Keep Fighting target
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.groundArena[0].ready).toBe(false);

    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0); // Keep Fighting
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("lets the unit ready again once the upgrade leaves", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.upgrades.shd.frozenInCarbonite)
      .WithCardInHandForPlayer(1, Cards.events.sor.keepFighting)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    // Remove the Condition and the unit becomes readyable again.
    g.state.player1.groundArena[0].upgrades = [];

    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });
});
