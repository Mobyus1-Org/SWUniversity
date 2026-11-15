import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackBase, MARINE } from "./scan-fixtures";

// SHD_151 Valiant Assault Ship (3/4 Space): "Saboteur" / "On Attack: If the defending player controls more
// resources than you, this unit gets +2/+0 for this attack."
describe("SHD_151 Valiant Assault Ship", () => {
  it("+2/+0 when the defending player controls more resources", async () => {
    const g = load(board().FillResourcesForPlayer(2, MARINE, 20).WithSpaceUnitForPlayer(1, Cards.units.shd.valiantAssaultShip).Build());
    await attackBase(g, 0, "space");
    expect(g.state.player2.base.damage).toBe(15);
  });
  it("no bonus with fewer or equal resources", async () => {
    const g = load(board().FillResourcesForPlayer(2, MARINE, 14).WithSpaceUnitForPlayer(1, Cards.units.shd.valiantAssaultShip).Build());
    await attackBase(g, 0, "space");
    expect(g.state.player2.base.damage).toBe(13);
  });
});
