import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_158 Millennium Falcon — Ya-Hoo! (4/4 Space, cost 4, Cunning/Heroism)
//   "When Attack Ends: You may pay 1 resource. If you do, return a friendly unit that costs 3 or
//    less to its owner's hand. If it's returned to your hand, you may play it for free."

const FALCON = Cards.units.ic27.millenniumFalconYaHoo;
const MARINE = Cards.units.sor.battlefieldMarine; // cost 2
const CSF = Cards.units.sor.consularSecurityForce; // cost 4 — not eligible

function board(resources = 3) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithSpaceUnitForPlayer(1, FALCON);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as { type?: string; fromPlayIds?: string[] } | undefined;
const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

async function falconAttacks(g: GameTestAdapter) {
  await g.attackWithSpaceUnitAsync(1, 0);
  await g.chooseBaseAsync(1, 2);
}

describe("IC27_158 Millennium Falcon — Ya-Hoo!", () => {
  it("pay 1, return a cost-2 unit, replay it for free", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE, false, 2).Build()); // exhausted and damaged

    await falconAttacks(g);
    await g.chooseYesAsync(1);
    expect(ready(g)).toBe(2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena[0].damage).toBe(0); // a fresh copy
    expect(ready(g)).toBe(2); // the replay was free
  });

  it("only units costing 3 or less are offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, CSF).Build());

    await falconAttacks(g);
    await g.chooseYesAsync(1);

    expect(res(g)?.fromPlayIds).toEqual([g.state.player1.groundArena[0].playId]);
  });

  it("declining the payment changes nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    await falconAttacks(g);
    await g.chooseNoAsync(1);

    expect(ready(g)).toBe(3);
    expect(g.state.player1.groundArena).toHaveLength(1);
  });

  it("declining the free play leaves the unit in hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    await falconAttacks(g);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(ready(g)).toBe(2);
  });

  it("no unit costing 3 or less: no offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, CSF).Build());

    await falconAttacks(g);

    expect(res(g)).toBeFalsy();
    expect(ready(g)).toBe(3);
  });

  it("nothing to pay with: no offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(0).WithGroundUnitForPlayer(1, MARINE).Build());

    await falconAttacks(g);

    expect(res(g)).toBeFalsy();
  });

  it("a unit the opponent owns goes to THEIR hand, with no free play", async () => {
    const g = new GameTestAdapter();
    // P1 controls a Marine that P2 owns.
    const state = board().WithGroundUnitForPlayer(1, MARINE).Build();
    state.player1.groundArena[0].owner = 2;
    g.loadNewState(state);
    const stolen = g.state.player1.groundArena[0].playId;

    await falconAttacks(g);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [stolen] });

    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.hand).toHaveLength(0);
    expect(res(g)).toBeFalsy();
  });
});
