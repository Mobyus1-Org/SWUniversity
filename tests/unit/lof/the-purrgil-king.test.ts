import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const PURRGIL = Cards.units.lof.thePurrgilKing; // 4/12

// LOF_121 The Purrgil King: "When Played: Draw a card for each friendly unit with 7 or more remaining HP."
describe("LOF_121 The Purrgil King", () => {
  const deck = (b: ReturnType<typeof board>) => { for (let i = 0; i < 4; i++) b = b.WithCardInDeckForPlayer(1, MARINE); return b; };

  it("draws for each friendly unit with 7+ remaining HP (itself included)", async () => {
    const g = load(deck(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, PURRGIL)).Build());
    await F.playFromHand(g);
    expect(g.state.player1.hand).toHaveLength(2);
  });

  it("damage counts against remaining HP", async () => {
    const g = load(deck(board().WithGroundUnitForPlayer(1, CSF, true, 1).WithCardInHandForPlayer(1, PURRGIL)).Build());
    await F.playFromHand(g);
    expect(g.state.player1.hand).toHaveLength(1);
  });
});
