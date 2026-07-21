import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_208 Sabine Wren — I Learned the Hard Way (4/5 Ground, cost 5)
// "Shielded (When you play this unit, give a Shield token to her.)"
// "When 1 or more upgrades attach to this unit (including from Shielded): You may exhaust a ground unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

describe("ASH_208 Sabine Wren", () => {
  it("enters play with a Shield token (Shielded)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.sabineWren)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // decline the exhaust her Shield triggers

    expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === "SOR_T02")).toHaveLength(1);
  });

  it("the Shield token itself triggers the exhaust — an enemy ground unit is exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.sabineWren)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });

  it("may decline the exhaust", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.sabineWren)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });

  it("triggers again when a later upgrade is played on her", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.sabineWren)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.academyTraining)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // attach the upgrade to Sabine
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });

  it("does not trigger when the upgrade attaches to a DIFFERENT unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.academyTraining)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 1); // attach to the Marine instead

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });

  it("can exhaust a FRIENDLY ground unit too, but never a space unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toContain(g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!.playId);
    expect(targets).not.toContain(g.state.player2.spaceArena[0].playId);
  });
});
