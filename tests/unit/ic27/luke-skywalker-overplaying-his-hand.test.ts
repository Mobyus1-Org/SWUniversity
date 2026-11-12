import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_165 Luke Skywalker — Overplaying His Hand (9/9 Ground, cost 8, Cunning/Heroism)
//   "When Played: You may put an enemy non-leader unit on the bottom of its owner's deck. Its owner
//    draws 2 cards."  Bottom first, then the draws.

const LUKE = Cards.units.ic27.lukeOverplaying;
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;
const SWOOP = Cards.units.sor.swoopRacer;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, LUKE)
    .WithGroundUnitForPlayer(1, MARINE);
}

const res = (g: GameTestAdapter) =>
  g.lastDispatchResponse?.resolutionNeeded as { type?: string; fromPlayIds?: string[] } | undefined;

describe("IC27_165 Luke Skywalker", () => {
  it("bottoms the unit, THEN its owner draws 2 — with one card in deck, the unit comes back", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, SWOOP).WithCardInDeckForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.hand.map(c => c.cardId).sort()).toEqual([CSF, SWOOP].sort());
    expect(g.state.player2.deck).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.hand).toHaveLength(0); // you draw nothing
  });

  it("the unit sits at the bottom when the owner's deck is deeper", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, SWOOP)
      .WithCardInDeckForPlayer(2, CSF).WithCardInDeckForPlayer(2, CSF).WithCardInDeckForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([CSF, CSF]);
    expect(g.state.player2.deck.map(c => c.cardId)).toEqual([SWOOP, CSF]); // index 0 is the bottom
  });

  it("offers only enemy units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, SWOOP).WithSpaceUnitForPlayer(2, Cards.units.sor.allianceXWing).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect([...(res(g)?.fromPlayIds ?? [])].sort()).toEqual(
      [g.state.player2.groundArena[0].playId, g.state.player2.spaceArena[0].playId].sort());
  });

  it("declining moves nothing and nobody draws", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, SWOOP).WithCardInDeckForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player2.hand).toHaveLength(0);
  });

  it("no enemy unit: no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(res(g)).toBeFalsy();
  });
});
