import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_109 Supreme Leader Snoke — Darkness Rising (8/6 Ground, cost 8, Aggression/Villainy)
//   "Overwhelm. When Played: Deal 4 damage to each other unit. Draw a card for each friendly unit
//    defeated this way."

const SNOKE = Cards.units.ic27.snoke;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const CSF = Cards.units.sor.consularSecurityForce; // 3/7
const XWING = Cards.units.sor.allianceXWing;       // 2/3 space
const TIE = Cards.units.sor.tieLnFighter;          // 2/1 space

function board(deckCards = 3) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 12)
    .WithCardInHandForPlayer(1, SNOKE);
  for (let i = 0; i < deckCards; i++) b = b.WithCardInDeckForPlayer(1, CSF);
  return b;
}

describe("IC27_109 Snoke — When Played", () => {
  it("4 to each other unit, both sides and arenas; draws one card per FRIENDLY unit defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, XWING)
      .WithGroundUnitForPlayer(2, CSF).WithSpaceUnitForPlayer(2, TIE)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([SNOKE]);
    expect(g.state.player1.groundArena[0].damage).toBe(0); // "other" — Snoke is spared
    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player2.groundArena[0].damage).toBe(4);  // CSF survives
    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player1.hand).toHaveLength(2);           // Marine + X-Wing
  });

  it("only enemy units defeated: no draw", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).WithSpaceUnitForPlayer(2, TIE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("a friendly survivor and a Shielded friendly do not count", async () => {
    const g = new GameTestAdapter();
    const state = board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(1, MARINE).Build();
    state.player1.groundArena[1].upgrades = [{ cardId: Cards.upgrades.token.shield, playId: "sh", owner: 1, controller: 1 }];
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(3);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("drawing from an empty deck costs 3 per card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(0).WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, XWING).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(6);
  });
});

describe("IC27_109 Snoke — Overwhelm", () => {
  it("excess combat damage spills to the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP).MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.green30HP).TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .WithGroundUnitForPlayer(1, SNOKE)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.base.damage).toBe(5);
  });
});
