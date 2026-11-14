import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_165 Commandeered Tour Shuttle (2/2 Space, cost 3, Aggression/Heroism) —
//   "When Played: You may ready another unit with 3 or less power."
//
// "Another unit" — either side's, never the Shuttle itself.

const SHUTTLE = Cards.units.hmw.commandeeredTourShuttle;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const CATAMARANS = Cards.units.hmw.coastalCatamarans; // 8/8

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren) // Aggression/Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, SHUTTLE)
    .WithActivePlayer(1);
}

describe("HMW_165 Commandeered Tour Shuttle", () => {
  it("readies an exhausted friendly unit with 3 power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE, false).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("can ready an enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE, false).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });

  it("can be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE, false).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("asks nothing when the only exhausted unit has more than 3 power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CATAMARANS, false).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});
