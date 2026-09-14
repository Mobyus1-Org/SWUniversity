import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_131 Turbolaser Salvo (Event, cost 7, Command)
//   "Choose an arena. A friendly space unit deals damage equal to its power to each enemy unit in
//    that arena."
//
// The space unit can fire into the ground arena.

const AWING = Cards.units.jtl.phoenixSquadronAWing;  // 3/2 Space
const WAYFARER = Cards.units.lof.hyperspaceWayfarer; // 4/10 Space
const DURABLE = Cards.units.sor.consularSecurityForce;
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 12)
    .WithCardInHandForPlayer(1, Cards.events.jtl.turbolaserSalvo)
    .WithSpaceUnitForPlayer(1, AWING)
    .WithGroundUnitForPlayer(1, DURABLE)
    .WithGroundUnitForPlayer(2, DURABLE)
    .WithGroundUnitForPlayer(2, DURABLE)
    .WithSpaceUnitForPlayer(2, WAYFARER);
}

describe("JTL_131 Turbolaser Salvo", () => {
  it("ground: the chosen space unit deals its power to each ENEMY ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "ground");
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player2.groundArena.map(u => u.damage)).toEqual([3, 3]);
    expect(g.state.player1.groundArena[0].damage).toBe(0); // friendly untouched
    expect(g.state.player2.spaceArena[0].damage).toBe(0);  // other arena untouched
  });

  it("space: hits the enemy space units instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "space");
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(3);
    expect(g.state.player2.groundArena.map(u => u.damage)).toEqual([0, 0]);
  });

  it("only friendly SPACE units can fire", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "ground");

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toEqual([g.state.player1.spaceArena[0].playId]);
  });

  it("no friendly space unit — no prompt at all", async () => {
    const g = new GameTestAdapter();
    const state = setup().Build();
    state.player1.spaceArena = [];
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
