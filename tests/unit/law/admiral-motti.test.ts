import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// LAW_139 Admiral Motti - Chain of Command (4/5 Ground, cost 5) —
//   "Friendly leader units get +2/+2."
//
// "Leader unit" follows Unit.IsLeader(), which counts a Vehicle carrying a pilot leader — the
// JTL pilot leaders print "Attached unit is a leader unit" on their deployed side.
describe("LAW_139 Admiral Motti - Chain of Command", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin, true, true) // Command/Villainy, deployed
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("gives a friendly deployed leader unit +2/+2", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.law.admiralMottiLaw)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.grandMoffTarkin)
        .Build(),
    );

    const tarkin = Unit.FromInterface(g.state.player1.groundArena[1]);
    expect(tarkin.CurrentPower()).toBe(2 + 2); // Tarkin deploys 2/7
    expect(tarkin.TotalHP()).toBe(7 + 2);
  });

  it("does NOT buff friendly non-leader units", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.law.admiralMottiLaw)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    const marine = Unit.FromInterface(g.state.player1.groundArena[1]);
    expect(marine.CurrentPower()).toBe(3);
    expect(marine.TotalHP()).toBe(3);
  });

  it("does NOT buff itself — Motti is not a leader unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.law.admiralMottiLaw).Build());

    const motti = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(motti.CurrentPower()).toBe(4);
    expect(motti.TotalHP()).toBe(5);
  });

  it("does NOT buff an ENEMY leader unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .TheirLeader(Cards.leaders.sor.sabineWren, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.law.admiralMottiLaw)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren)
        .Build(),
    );

    const sabine = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(sabine.CurrentPower()).toBe(2); // Sabine deploys 2/5, unbuffed
    expect(sabine.TotalHP()).toBe(5);
  });

  it("buffs a Vehicle carrying a pilot leader — that unit IS a leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.darthVader, true, false)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.law.admiralMottiLaw)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter) // 2/1
        .WithActivePlayer(1)
        .Build(),
    );

    const before = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(before.CurrentPower()).toBe(2);

    await g.deployLeaderAsync(1);
    await g.chooseOptionAsync(1, "Deploy as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);

    // 2 base + 5 from Vader-as-upgrade + 2 from Motti.
    const after = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(after.CurrentPower()).toBe(2 + 5 + 2);
    expect(after.TotalHP()).toBe(1 + 5 + 2);
  });

  it("control: without Motti the same leader unit is unbuffed", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.leaders.sor.grandMoffTarkin).Build());

    const tarkin = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(tarkin.CurrentPower()).toBe(2);
    expect(tarkin.TotalHP()).toBe(7);
  });

  it("stops buffing once Motti loses his abilities", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.law.admiralMottiLaw)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.shd.imprisoned, playId: "@", owner: 2, controller: 2 },
        ])
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.grandMoffTarkin)
        .Build(),
    );

    const tarkin = Unit.FromInterface(g.state.player1.groundArena[1]);
    expect(tarkin.CurrentPower()).toBe(2);
    expect(tarkin.TotalHP()).toBe(7);
  });
});
