import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { TargetIds } from "../../test-helpers";

// TWI_099 Synchronized Strike — Event (Command/Heroism, Tactic), cost 2.
// "Deal damage to an enemy unit equal to the number of units you control in its arena."
//
// Two clauses drive the tests: the target must be an ENEMY unit, and the amount is counted in
// the TARGET's arena only — a friendly unit in the other arena adds nothing.

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.twi.synchronizedStrike);
}

describe("TWI_099 Synchronized Strike", () => {
  it("offers only enemy units as targets", async () => {
    const g = new GameTestAdapter();
    const state = baseState()
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
      .WithSpaceUnitForPlayer(1, Cards.units.sec.contrabandStarhopper)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    const targets = TargetIds(g);
    expect(targets).toEqual(expect.arrayContaining([
      state.player2.groundArena[0].playId,
      state.player2.spaceArena[0].playId,
    ]));
    expect(targets).not.toContain(state.player1.groundArena[0].playId);
    expect(targets).not.toContain(state.player1.spaceArena[0].playId);
  });

  it("deals damage equal to the friendly units in the target's GROUND arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(1, Cards.units.sec.imperialOccupier)
        .WithSpaceUnitForPlayer(1, Cards.units.sec.contrabandStarhopper) // wrong arena — ignored
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7, survives
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("deals damage equal to the friendly units in the target's SPACE arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(1, Cards.units.sec.imperialOccupier) // wrong arena — ignored
        .WithSpaceUnitForPlayer(1, Cards.units.sec.contrabandStarhopper)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // 4/10, survives
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(1);
  });

  it("control — with no friendly unit in the target's arena it deals no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(1, Cards.units.sec.imperialOccupier)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });

  it("counts a friendly deployed leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .MyLeader(Cards.leaders.sor.sabineWren, true, true, true)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.sabineWren) // deployed leader unit
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("defeats the target when the count is lethal", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(1, Cards.units.sec.imperialOccupier)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce, true, 5) // 3/7 with 5 → 2 left
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("does nothing when the opponent controls no units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });
});
