import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackBase, pick, MARINE, CSF } from "./scan-fixtures";

// SHD_191 Xanadu Blood (4/6 Space): "Raid 2" / "When Played/On Attack: You may return another friendly
// non-leader Underworld unit to its owner's hand. If you do, exhaust an enemy unit or resource."
describe("SHD_191 Xanadu Blood", () => {
  it("On Attack: bounce a friendly Underworld unit, then exhaust an enemy unit", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, Cards.units.shd.xanaduBlood).WithGroundUnitForPlayer(1, Cards.units.shd.lomPyke).WithGroundUnitForPlayer(2, CSF).Build());
    await attackBase(g, 0, "space");
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([Cards.units.shd.lomPyke]);
    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });
  it("…or an enemy resource", async () => {
    const g = load(board().FillResourcesForPlayer(2, MARINE, 3).WithSpaceUnitForPlayer(1, Cards.units.shd.xanaduBlood).WithGroundUnitForPlayer(1, Cards.units.shd.lomPyke).Build());
    await attackBase(g, 0, "space");
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    await pick(g, [g.state.player2.resources[0].playId]);
    expect(g.state.player2.resources[0].ready).toBe(false);
  });
});
