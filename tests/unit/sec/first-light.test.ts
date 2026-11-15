import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XWING } = F;
const FIRST_LIGHT = Cards.units.sec.firstLight; // 5/7 Space

// SEC_088 First Light: "When this unit attacks and defeats a unit: You may draw a card."
describe("SEC_088 First Light", () => {
  const setup = (defender: string) => load(board().WithSpaceUnitForPlayer(1, FIRST_LIGHT).WithSpaceUnitForPlayer(2, defender).WithCardInDeckForPlayer(1, MARINE).Build());

  it("defeating a unit: may draw", async () => {
    const g = setup(XWING);
    await F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId, "space");
    await g.chooseYesAsync(1);
    expect(g.state.player1.hand).toHaveLength(1);
  });

  it("declining: no draw", async () => {
    const g = setup(XWING);
    await F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId, "space");
    await g.chooseNoAsync(1);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("not defeating it: no offer", async () => {
    const g = setup(Cards.units.jtl.tantiveIV);
    await F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId, "space");
    expect(F.prompt(g)).toBeNull();
  });
});
