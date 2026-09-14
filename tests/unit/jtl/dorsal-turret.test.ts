import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_120 Dorsal Turret (Upgrade +0/+0, cost 1, Command)
//   "Attach to a Vehicle unit.
//    Attached unit gains: 'When this unit deals combat damage to a unit while attacking: Defeat
//    that unit.'"

const TURRET = Cards.upgrades.jtl.dorsalTurret;
const AWING = Cards.units.jtl.phoenixSquadronAWing;   // 3/2 Space Vehicle
const WAYFARER = Cards.units.lof.hyperspaceWayfarer;  // 4/10 Space — survives 3 damage normally
const RAIDER = Cards.units.ash.atStRaider;            // 4/5 Ground Vehicle
const MARINE = Cards.units.sor.battlefieldMarine;     // not a Vehicle
const up = (id: string, p: 1 | 2) => GameStateBuilder.Upgrade(id, p);

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10);
}

describe("JTL_120 Dorsal Turret", () => {
  it("attaches only to a Vehicle unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, TURRET).WithSpaceUnitForPlayer(1, AWING).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toEqual([g.state.player1.spaceArena[0].playId]);
  });

  it("its unit's combat damage while attacking defeats the defender", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithSpaceUnitForPlayer(1, AWING).WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(TURRET, 1)])
        .WithSpaceUnitForPlayer(2, WAYFARER).Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(0);
  });

  it("control: without the Turret the defender survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, Cards.units.lof.hyperspaceWayfarer).WithSpaceUnitForPlayer(2, WAYFARER).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(1);
  });

  it("a Shield that absorbs the combat damage stops it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithSpaceUnitForPlayer(1, AWING).WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(TURRET, 1)])
        .WithSpaceUnitForPlayer(2, WAYFARER).WithUpgradesOnSpaceUnitForPlayer(2, 0, [up(Cards.upgrades.token.shield, 2)])
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(1);
  });

  it("only while ATTACKING — as the defender it defeats nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithActivePlayer(2).WithSpaceUnitForPlayer(1, AWING).WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(TURRET, 1)])
        .WithSpaceUnitForPlayer(2, WAYFARER).Build(),
    );

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player2.spaceArena).toHaveLength(1);
  });

  it("defeats a leader unit too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().TheirLeader(Cards.leaders.sor.sabineWren, true, true)
        .WithGroundUnitForPlayer(1, RAIDER).WithUpgradesOnGroundUnitForPlayer(1, 0, [up(TURRET, 1)])
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.leader.deployed).toBe(false);
  });
});
