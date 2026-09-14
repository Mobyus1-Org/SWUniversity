import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Board wipes are card abilities: an enemy unit that "can't be defeated by enemy card abilities"
// (JTL_103 Chewbacca, printed or as a Pilot) survives them. The wiping player's own copy doesn't.

const MARINE = Cards.units.sor.battlefieldMarine;
const CHEWIE = Cards.units.jtl.chewbacca;

function setup(event: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, event);
}

describe("board wipes respect 'can't be defeated by enemy card abilities'", () => {
  it("Superlaser Blast: the enemy Chewbacca survives, everything else dies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.events.sor.superlaserBlast).WithGroundUnitForPlayer(1, CHEWIE).WithGroundUnitForPlayer(2, CHEWIE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([CHEWIE]);
  });

  it("Invasion of Christophsis: the enemy Chewbacca survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.events.twi.christophsis).WithGroundUnitForPlayer(2, CHEWIE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    if (g.lastDispatchResponse?.resolutionNeeded?.type === "Option") await g.chooseNoAsync(1); // decline Exploit 4

    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([CHEWIE]);
  });

  it("Hyperspace Disaster: an enemy Vehicle piloted by Chewbacca survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.events.sec.hyperspaceDisaster)
        .WithSpaceUnitForPlayer(2, Cards.units.jtl.phoenixSquadronAWing)
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(CHEWIE, 2)])
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.spaceArena.map(u => u.cardId)).toEqual([Cards.units.jtl.phoenixSquadronAWing]);
  });

  it("Single Reactor Ignition: the survivor isn't counted for the base damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.events.law.singleReactorIgnition).WithGroundUnitForPlayer(2, CHEWIE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([CHEWIE]);
    expect(g.state.player2.base.damage).toBe(1); // only the Marine was defeated
  });
});
