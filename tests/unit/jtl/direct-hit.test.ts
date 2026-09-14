import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_078 Direct Hit (Event, cost 4, Vigilance) — "Defeat a non-leader Vehicle unit."
//
// A Vehicle with a leader Pilot on it IS a leader unit, so it can't be chosen.

const TIE = Cards.units.sor.tieLnFighter;        // Vehicle
const AWING = Cards.units.jtl.phoenixSquadronAWing; // Vehicle — a pilot host
const MARINE = Cards.units.sor.battlefieldMarine; // not a Vehicle

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, Cards.events.jtl.directHit);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];

describe("JTL_078 Direct Hit", () => {
  it("defeats the chosen Vehicle unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, TIE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(0);
  });

  it("offers Vehicles on either side — not non-Vehicles, not a Vehicle with a leader Pilot", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, TIE)
        .WithSpaceUnitForPlayer(2, AWING)
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.leaders.jtl.lukeSkywalker, 2)])
        .WithSpaceUnitForPlayer(2, TIE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect([...offer(g)].sort()).toEqual([g.state.player1.spaceArena[0].playId, g.state.player2.spaceArena[1].playId].sort());
  });

  it("an enemy Vehicle that can't be defeated by enemy abilities isn't offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(2, AWING)
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.units.jtl.chewbacca, 2)]) // Chewbacca as Pilot
        .WithSpaceUnitForPlayer(2, TIE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(offer(g)).toEqual([g.state.player2.spaceArena[1].playId]);
  });
});
