import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF, GUNGAN } = F;
const CLONE = Cards.units.token.cloneTrooper;   // 2/2 Republic Clone Trooper token

// TWI_169 Clone Cohort: "Attached unit gains Raid 2 and: 'When Defeated: Create a Clone Trooper token.'"
describe("TWI_169 Clone Cohort", () => {
  it("the host's controller gets a Clone Trooper when it's defeated", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, GUNGAN).WithUpgradesOnGroundUnitForPlayer(2, 0, [F.up(Cards.upgrades.twi.cloneCohort, 2)]).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([CLONE]);
  });
});
