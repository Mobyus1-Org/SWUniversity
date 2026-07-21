import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_163 Reckless Sacrifice (Event, cost 2, Aggression/Heroism)
// "Discard a unit from your hand. Deal 5 damage to a unit that costs more than the discarded card."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

describe("ASH_163 Reckless Sacrifice", () => {
  it("discards an off-aspect unit and deals 5 damage to any unit costing more than it", async () => {
    // QA case: Imperial Door Technician (LAW_097) is Vigilance/Villainy — off-aspect for this
    // Aggression/Heroism event — and costs 1, so every unit costing 2+ is a legal target.
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.recklessSacrifice)
        .WithCardInHandForPlayer(1, Cards.units.law.imperialDoorTechnician) // cost 1, off-aspect
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)  // cost 4, 3/7
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0); // discard the Technician
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(Cards.units.law.imperialDoorTechnician);
    expect(g.state.player2.groundArena[0].damage).toBe(5);
  });

  it("cannot target a unit that costs the SAME as the discarded card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.recklessSacrifice)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)      // cost 2
        .WithGroundUnitForPlayer(2, Cards.units.ash.zealousSoldier)         // cost 2 — equal, illegal
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)  // cost 4 — legal
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toEqual([g.state.player2.groundArena[1].playId]);
  });

  it("discards the unit even when no unit costs more (no damage target)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.recklessSacrifice)
        .WithCardInHandForPlayer(1, Cards.units.sor.consularSecurityForce) // cost 4
        .WithGroundUnitForPlayer(2, Cards.units.ash.mouseDroid)            // cost 1
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.discard.map(c => c.cardId)).toContain(Cards.units.sor.consularSecurityForce);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("only offers UNITS in hand as the discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.recklessSacrifice)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.events.ash.reckoning) // an event — not discardable here
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    // Index 1 is the event — the engine must reject it rather than discard it.
    await g.chooseCardFromHandAsync(1, 1);
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);

    await g.chooseCardFromHandAsync(1, 0);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
  });

  it("does nothing when there is no unit in hand to discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.recklessSacrifice)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("can defeat a bigger unit outright", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.recklessSacrifice)
        .WithCardInHandForPlayer(1, Cards.units.ash.mouseDroid)            // cost 1
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)     // cost 2, 3/3
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });
});
