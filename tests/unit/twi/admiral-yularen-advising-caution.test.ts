import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;

// TWI_092 Admiral Yularen — Advising Caution (2/5): "Restore 1" / "Each other friendly Heroism unit gets +0/+1."
describe("TWI_092 Admiral Yularen", () => {
  it("other friendly Heroism units +0/+1; not himself, not enemies", () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.admiralYularenAdvising).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());
    expect(F.hp(g.state.player1.groundArena[1])).toBe(4);
    expect(F.hp(g.state.player1.groundArena[0])).toBe(5);
    expect(F.hp(g.state.player2.groundArena[0])).toBe(3);
  });
});
