import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_076 Covering the Wing (Event, cost 2, Vigilance)
//   "Create an X-Wing token. You may give a Shield token to another unit."
//
// "Another" is relative to the X-Wing just created: any other unit, either side, may take it.

const XWING = Cards.units.token.xWing;
const SHIELD = Cards.upgrades.token.shield;
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, Cards.events.jtl.coveringTheWing)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithGroundUnitForPlayer(2, MARINE);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];

describe("JTL_076 Covering the Wing", () => {
  it("creates an X-Wing, then may give a Shield to another unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([XWING]);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].upgrades.map(u => u.cardId)).toEqual([SHIELD]);
  });

  it("the new X-Wing is not offered; units on both sides are", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect([...offer(g)].sort()).toEqual([g.state.player1.groundArena[0].playId, g.state.player2.groundArena[0].playId].sort());
  });

  it("declining the Shield still leaves the X-Wing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([XWING]);
    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
  });
});
