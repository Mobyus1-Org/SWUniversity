import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, XP, count } = F;
const RUNNER = Cards.units.lof.blockadeRunner; // 4/4 Space

// LOF_166 Blockade Runner: "When this unit deals combat damage to a base: You may give an Experience token to this unit."
describe("LOF_166 Blockade Runner", () => {
  it("damaging a base: may give itself an Experience token", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, RUNNER).Build());
    await F.attackBase(g, 0, "space");
    await g.chooseYesAsync(1);
    expect(count(g.state.player1.spaceArena[0], XP)).toBe(1);
  });

  it("declining: none", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, RUNNER).Build());
    await F.attackBase(g, 0, "space");
    await g.chooseNoAsync(1);
    expect(count(g.state.player1.spaceArena[0], XP)).toBe(0);
  });

  it("attacking a unit: no offer", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, RUNNER).WithSpaceUnitForPlayer(2, Cards.units.jtl.tantiveIV).Build());
    await F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId, "space");
    expect(F.prompt(g)).toBeNull();
  });
});
