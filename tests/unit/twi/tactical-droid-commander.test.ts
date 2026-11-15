import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, MARINE } = F;

// TWI_184 Tactical Droid Commander (4/4): "Exploit 2" / "When you play another Separatist unit: You may exhaust a
// unit that costs the same as or less than the played unit."
describe("TWI_184 Tactical Droid Commander", () => {
  it("playing a 3-cost Separatist: may exhaust a unit costing 3 or less", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.tacticalDroidCommander).WithGroundUnitForPlayer(2, MARINE)
      .WithCardInHandForPlayer(1, Cards.units.twi.generalGrievousTrophyCollector).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });
});
