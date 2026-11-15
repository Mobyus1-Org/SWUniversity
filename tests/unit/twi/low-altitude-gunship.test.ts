import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, CSF } = F;
const CLONE = Cards.units.token.cloneTrooper;   // 2/2 Republic Clone Trooper token

// TWI_149 Low Altitude Gunship (6/5): "Overwhelm" / "When Played: Choose an enemy unit. Deal 1 damage to it for each friendly Republic unit."
describe("TWI_149 Low Altitude Gunship", () => {
  it("1 damage per friendly Republic unit — the Gunship itself is one", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CLONE).WithGroundUnitForPlayer(1, CLONE).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, Cards.units.twi.lowAltitudeGunship).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });
});
