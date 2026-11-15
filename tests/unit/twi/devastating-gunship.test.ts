import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, prompt, CSF } = F;

// TWI_036 Devastating Gunship (3/5 Space): "Grit" / "When Played: Defeat an enemy unit with 2 or less remaining HP."
describe("TWI_036 Devastating Gunship", () => {
  it("defeats an enemy unit with 2 remaining HP", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, CSF, true, 5).WithCardInHandForPlayer(1, Cards.units.twi.devastatingGunship).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena.length).toBe(0);
  });
  it("3 remaining HP is out of range", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, CSF, true, 4).WithCardInHandForPlayer(1, Cards.units.twi.devastatingGunship).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(prompt(g)).toBeNull();
  });
});
