import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_173 Fight Fire With Fire (Event, cost 1, Aggression)
//   "Choose a friendly unit and an enemy unit in the same arena. If you do, deal 3 damage to each of them."

const MARINE = Cards.units.sor.battlefieldMarine;        // 3/3 Ground
const SECURITY = Cards.units.sor.consularSecurityForce;  // 3/7 Ground
const AWING = Cards.units.jtl.phoenixSquadronAWing;      // 3/2 Space
const WAYFARER = Cards.units.lof.hyperspaceWayfarer;     // 4/10 Space

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, Cards.events.jtl.fightFireWithFire);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];

describe("JTL_173 Fight Fire With Fire", () => {
  it("deals 3 damage to the friendly unit and to an enemy unit in its arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, SECURITY).WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(3);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("only friendly units that share an arena with an enemy are offered first", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(1, SECURITY)
      .WithSpaceUnitForPlayer(1, AWING)
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(offer(g)).toEqual([g.state.player1.groundArena[0].playId]);
  });

  it("the enemy pick is limited to the friendly unit's arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithSpaceUnitForPlayer(1, WAYFARER)
      .WithGroundUnitForPlayer(1, SECURITY)
      .WithGroundUnitForPlayer(2, SECURITY)
      .WithSpaceUnitForPlayer(2, WAYFARER)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(offer(g)).toEqual([g.state.player2.spaceArena[0].playId]);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player1.spaceArena[0].damage).toBe(3);
    expect(g.state.player2.spaceArena[0].damage).toBe(3);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("both units can be defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("no friendly/enemy pair in any arena: nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, SECURITY).WithSpaceUnitForPlayer(2, AWING).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });
});
