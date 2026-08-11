import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_145 BB-8 — Happy Beeps (1/4 Ground Resistance Droid Pilot)
//   "Piloting [1 resource Aggression Heroism]
//    When played as an upgrade: You may pay 2 resources. If you do, ready a Resistance unit."
//
// Three gates: it fires ONLY when played as a Pilot upgrade (not as a unit), the payment is
// optional, and the ready target must be a RESISTANCE unit.

const MARINE = Cards.units.sor.battlefieldMarine;
const BB8 = Cards.units.jtl.bb8;
const AWING = Cards.units.jtl.phoenixSquadronAWing; // Rebel Vehicle Fighter — a legal Pilot host
const PAIGE = Cards.units.jtl.paigeTico;            // Resistance — a legal ready target
const readyRes = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, BB8);
}

describe("JTL_145 BB-8", () => {
  it("readies a Resistance unit when the 2 resources are paid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, AWING)
        .WithGroundUnitForPlayer(1, PAIGE, false) // exhausted Resistance unit
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.chooseSpaceUnitAsync(1, 0);
    const afterAttach = readyRes(g);
    await g.chooseYesAsync(1);            // pay 2
    await g.chooseGroundUnitAsync(1, 0);  // ready Paige

    expect(g.state.player1.groundArena[0].ready).toBe(true);
    expect(readyRes(g)).toBe(afterAttach - 2);
  });

  it("can decline the payment — nothing readies and nothing is spent", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, AWING)
        .WithGroundUnitForPlayer(1, PAIGE, false)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.chooseSpaceUnitAsync(1, 0);
    const afterAttach = readyRes(g);
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(readyRes(g)).toBe(afterAttach);
  });

  it("does NOT fire when played as a unit rather than a Pilot", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, PAIGE, false).Build());

    await g.playCardFromHandAsync(1, 0); // no Vehicle in play — enters as a unit

    expect(g.state.player1.groundArena.some(u => u.cardId === BB8)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.groundArena.find(u => u.cardId === PAIGE)!.ready).toBe(false);
  });

  it("does not offer a non-Resistance unit as the ready target", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, AWING)
        .WithGroundUnitForPlayer(1, MARINE, false) // exhausted, but not Resistance
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.chooseSpaceUnitAsync(1, 0);

    // No legal Resistance target, so the optional payment is never offered.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});
