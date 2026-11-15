import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, CSF } = F;

// TWI_167 Heavy Persuader Tank (6/5): "Exploit 2" / "When Played: You may deal 2 damage to a ground unit."
describe("TWI_167 Heavy Persuader Tank", () => {
  it("may deal 2 to a ground unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, Cards.units.twi.heavyPersuaderTank).Build());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });
});
