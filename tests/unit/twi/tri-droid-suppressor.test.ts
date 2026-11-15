import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, CSF } = F;

// TWI_217 Tri-Droid Suppressor (4/7): "Exploit 2" / "When Played: Exhaust an enemy ground unit."
describe("TWI_217 Tri-Droid Suppressor", () => {
  it("exhausts an enemy ground unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, Cards.units.twi.triDroidSuppressor).Build());
    await F.playFromHand(g);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });
});
