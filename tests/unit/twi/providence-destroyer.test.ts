import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, XWING } = F;

// TWI_038 Providence Destroyer (5/7 Space): "Exploit 2" / "On Attack: Give an enemy space unit –2/–2 for this phase."
describe("TWI_038 Providence Destroyer", () => {
  it("an enemy space unit gets –2/–2 (a 2/2 dies)", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, Cards.units.twi.providenceDestroyer).WithSpaceUnitForPlayer(2, XWING).Build());
    await F.attackBase(g, 0, "space");
    await pick(g, [g.state.player2.spaceArena[0].playId]);
    expect(g.state.player2.spaceArena.length).toBe(0);
  });
});
