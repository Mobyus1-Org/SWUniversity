import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_116 Black One — Draw Fire, Twice (2/2 Space, cost 3, Aggression/Heroism)
//   "When Played/When Defeated: Draw a card."

const BLACK_ONE = Cards.units.ic27.blackOne;
const MARINE = Cards.units.sor.battlefieldMarine;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, MARINE);
}

describe("IC27_116 Black One", () => {
  it("When Played: draws exactly one card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, BLACK_ONE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([BLACK_ONE]);
    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player1.deck).toHaveLength(1);
  });

  it("When Defeated in combat: draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithSpaceUnitForPlayer(1, BLACK_ONE)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.allianceXWing) // 2/3 — survives, kills Black One
      .Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player1.hand).toHaveLength(1);
  });

  it("When Defeated on the opponent's turn: its controller draws", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithSpaceUnitForPlayer(1, BLACK_ONE)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.allianceXWing)
      .WithActivePlayer(2)
      .Build());

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [g.state.player1.spaceArena[0].playId] });

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player2.hand).toHaveLength(0);
  });
});
