import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF, XWING } = F;
const CASSIAN = Cards.units.jtl.cassianAndor;

// JTL_048 Cassian Andor (piloting) — attached unit gains "On Attack: Discard a card from the defending
// player's deck. If that card costs 3 or less, draw a card."
describe("JTL_048 Cassian Andor (piloting)", () => {
  const setup = (top: string) => load(board().WithSpaceUnitForPlayer(1, XWING).WithUpgradesOnSpaceUnitForPlayer(1, 0, [F.up(CASSIAN, 1)])
    .WithCardInDeckForPlayer(2, top).WithCardInDeckForPlayer(1, MARINE).Build());

  it("mills the defender's top card; a cost-3-or-less card draws you one", async () => {
    const g = setup(MARINE);
    await F.attackBase(g, 0, "space");
    expect(g.state.player2.discard.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.hand).toHaveLength(1);
  });

  it("a card costing 4 or more is milled but draws nothing", async () => {
    const g = setup(CSF);
    await F.attackBase(g, 0, "space");
    expect(g.state.player2.discard.map(c => c.cardId)).toEqual([CSF]);
    expect(g.state.player1.hand).toHaveLength(0);
  });
});
