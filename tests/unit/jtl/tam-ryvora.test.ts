import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, XWING } = F;

// JTL_035 Tam Ryvora — Searching For Purpose: Piloting / "Attached unit gains: 'On Attack: Give an enemy unit in this arena –1/–1 for this phase.'"
describe("JTL_035 Tam Ryvora (piloting)", () => {
  it("the Vehicle she pilots gives an enemy unit in its arena –1/–1", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithUpgradesOnSpaceUnitForPlayer(1, 0, [F.up(Cards.units.jtl.tamRyvora, 1)]).WithSpaceUnitForPlayer(2, XWING).Build());
    await F.attackBase(g, 0, "space");
    await pick(g, [g.state.player2.spaceArena[0].playId]);
    expect(F.power(g.state.player2.spaceArena[0])).toBe(1);
  });
});
