import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF, GUNGAN } = F;
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// TWI_033 Calculating MagnaGuard (3/4): "When Played/When a friendly unit is defeated: This unit gains Sentinel for this phase."
describe("TWI_033 Calculating MagnaGuard", () => {
  it("When Played: gains Sentinel", async () => {
    const g = load(board().WithCardInHandForPlayer(1, Cards.units.twi.calculatingMagnaGuard).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(HasSentinel(Cards.units.twi.calculatingMagnaGuard, g.state.player1.groundArena[0].playId, 1)).toBe(true);
  });
  it("a friendly unit defeated: gains Sentinel", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.calculatingMagnaGuard).WithGroundUnitForPlayer(1, GUNGAN).WithGroundUnitForPlayer(2, CSF).Build());
    const guard = g.state.player1.groundArena[0].playId;
    expect(HasSentinel(Cards.units.twi.calculatingMagnaGuard, guard, 1)).toBeFalsy();
    await F.attackUnit(g, 1, g.state.player2.groundArena[0].playId); // the 2/2 dies to the 3/7
    expect(HasSentinel(Cards.units.twi.calculatingMagnaGuard, guard, 1)).toBe(true);
  });
});
