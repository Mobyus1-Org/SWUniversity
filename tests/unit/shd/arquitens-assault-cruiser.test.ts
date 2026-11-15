import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackUnit } from "./scan-fixtures";

// SHD_122 Arquitens Assault Cruiser (7/8 Space): "Ambush" / "When this unit attacks and defeats a
// non-leader unit: Put the defeated unit into play as a resource under your control."
describe("SHD_122 Arquitens Assault Cruiser", () => {
  it("the defeated unit becomes your resource (its owner keeps it)", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, Cards.units.shd.arquitensAssaultCruiser).WithSpaceUnitForPlayer(2, Cards.units.shd.valiantAssaultShip).Build());
    await attackUnit(g, 0, g.state.player2.spaceArena[0].playId, "space");
    const res = g.state.player1.resources.find(r => r.cardId === Cards.units.shd.valiantAssaultShip)!;
    expect(res).toBeDefined();
    expect(res.owner).toBe(2);
    expect(g.state.player2.discard.length).toBe(0);
  });
});
