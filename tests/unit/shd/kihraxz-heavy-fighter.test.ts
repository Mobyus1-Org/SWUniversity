import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackBase, pick, XWING } from "./scan-fixtures";

// SHD_118 Kihraxz Heavy Fighter (3/3 Space): "Overwhelm" / "On Attack: You may exhaust another friendly
// unit. If you do, this unit gets +3/+0 for this attack."
describe("SHD_118 Kihraxz Heavy Fighter", () => {
  it("exhausting another friendly unit gives +3/+0 for the attack", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, Cards.units.shd.kihraxzHeavyFighter).WithSpaceUnitForPlayer(1, XWING).Build());
    await attackBase(g, 0, "space");
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player1.spaceArena[1].playId]);
    expect(g.state.player1.spaceArena[1].ready).toBe(false);
    expect(g.state.player2.base.damage).toBe(10 + 6);
  });
  it("declined: 3 damage", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, Cards.units.shd.kihraxzHeavyFighter).WithSpaceUnitForPlayer(1, XWING).Build());
    await attackBase(g, 0, "space");
    await g.chooseNoAsync(1);
    expect(g.state.player2.base.damage).toBe(13);
  });
});
