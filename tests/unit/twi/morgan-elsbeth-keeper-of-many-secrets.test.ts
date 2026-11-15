import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, MARINE, GUNGAN } = F;

// TWI_035 Morgan Elsbeth (3/6): "Restore 1" / "On Attack: You may defeat another friendly unit. If you do, draw a card."
describe("TWI_035 Morgan Elsbeth", () => {
  it("defeats another friendly unit and draws", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.morganElsbethKeeper).WithGroundUnitForPlayer(1, GUNGAN).WithCardInDeckForPlayer(1, MARINE).Build());
    await F.attackBase(g);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player1.groundArena[1].playId]);
    expect(g.state.player1.groundArena.length).toBe(1);
    expect(g.state.player1.hand.length).toBe(1);
  });
});
