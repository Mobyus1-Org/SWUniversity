import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_229 Ma Klounkee (Event, cost 1, Cunning)
// "Return a friendly non-leader Underworld unit to its owner's hand.
//  If you do, deal 3 damage to a unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("SHD_229 Ma Klounkee", () => {
  it("returns a friendly Underworld unit to hand, then deals 3 damage to a chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.shd.maKlounkee)
        .WithGroundUnitForPlayer(1, Cards.units.shd.hylobonEnforcer) // Underworld
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // bounce the Enforcer

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.shd.hylobonEnforcer);

    await g.chooseGroundUnitAsync(2, 0); // then damage the enemy

    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("can deal the 3 damage to a friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.shd.maKlounkee)
        .WithGroundUnitForPlayer(1, Cards.units.shd.hylobonEnforcer)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // the Security Force is now the only unit left

    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });

  it("only offers friendly non-leader Underworld units as the bounce target", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ash.ahsokaTano, true, true)
        .WithCardInHandForPlayer(1, Cards.events.shd.maKlounkee)
        .WithGroundUnitForPlayer(1, Cards.units.shd.hylobonEnforcer) // Underworld — eligible
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not Underworld
        .WithGroundUnitForPlayer(1, Cards.units.ash.ahsokaTano) // leader unit
        .WithGroundUnitForPlayer(2, Cards.units.shd.hylobonEnforcer) // enemy Underworld
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toEqual([
      g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.hylobonEnforcer)!.playId,
    ]);
  });

  it("does nothing when there is no friendly Underworld unit to return", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.shd.maKlounkee)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("returns the unit to its OWNER's hand, not the caster's", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.events.shd.maKlounkee)
      .WithGroundUnitForPlayer(1, Cards.units.shd.hylobonEnforcer)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    state.player1.groundArena[0].owner = 2; // controlled by P1, owned by P2
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player2.hand.map(c => c.cardId)).toContain(Cards.units.shd.hylobonEnforcer);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("may deal the 3 damage to a leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .TheirLeader(Cards.leaders.ash.ahsokaTano, true, true)
        .WithCardInHandForPlayer(1, Cards.events.shd.maKlounkee)
        .WithGroundUnitForPlayer(1, Cards.units.shd.hylobonEnforcer)
        .WithGroundUnitForPlayer(2, Cards.units.ash.ahsokaTano)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });
});
