import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_038 Admiral Holdo — We Are the Spark (3/7 Ground, cost 5, Vigilance/Heroism)
//   "Draw 1 more card during the regroup phase."

const HOLDO = Cards.units.ic27.admiralHoldo;
const MARINE = Cards.units.sor.battlefieldMarine;

function board(p1DeckSize: number) {
  const b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
  for (let i = 0; i < p1DeckSize; i++) b.WithCardInDeckForPlayer(1, MARINE);
  for (let i = 0; i < 5; i++) b.WithCardInDeckForPlayer(2, MARINE);
  return b;
}

async function toRegroup(g: GameTestAdapter) {
  await g.dispatchAsync(1, "pass-action", {});
  await g.dispatchAsync(2, "pass-action", {});
}

describe("IC27_038 Admiral Holdo — We Are the Spark", () => {
  it("her controller draws 3 in the regroup phase; the opponent still draws 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(5).WithGroundUnitForPlayer(1, HOLDO).Build());

    await toRegroup(g);

    expect(g.state.player1.hand).toHaveLength(3);
    expect(g.state.player2.hand).toHaveLength(2);
  });

  it("control: without her it is the normal 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(5).Build());

    await toRegroup(g);

    expect(g.state.player1.hand).toHaveLength(2);
  });

  it("an enemy Holdo doesn't give you the extra draw", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(5).WithGroundUnitForPlayer(2, HOLDO).Build());

    await toRegroup(g);

    expect(g.state.player1.hand).toHaveLength(2);
    expect(g.state.player2.hand).toHaveLength(3);
  });

  it("the extra card counts against an empty deck: 2 cards left = 3 damage for the third", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(2).WithGroundUnitForPlayer(1, HOLDO).Build());

    await toRegroup(g);

    expect(g.state.player1.hand).toHaveLength(2);
    expect(g.state.player1.base.damage).toBe(3);
  });
});
