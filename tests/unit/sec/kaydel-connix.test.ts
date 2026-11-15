import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { CardIsUnique } from "@/server/engine/card-db/generated";
const { board, load, MARINE, XP, SHIELD } = F;
const KAYDEL = Cards.units.sec.kaydelConnix;
const DARKSABER = Cards.upgrades.ts26.theDarksaber; // unique

// SEC_149 Kaydel Connix: "When Played: You may defeat all non-unique upgrades on a unit."
describe("SEC_149 Kaydel Connix", () => {
  it("defeats every non-unique upgrade on the unit, keeping unique ones", async () => {
    expect(CardIsUnique(DARKSABER)).toBe(true);
    const g = load(board().WithGroundUnitForPlayer(2, F.CSF).WithUpgradesOnGroundUnitForPlayer(2, 0, [F.up(XP, 2), F.up(SHIELD, 2), F.up(DARKSABER, 2)]).WithCardInHandForPlayer(1, KAYDEL).Build());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].upgrades.map(u => u.cardId)).toEqual([DARKSABER]);
  });

  it("declining keeps them", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithUpgradesOnGroundUnitForPlayer(2, 0, [F.up(XP, 2)]).WithCardInHandForPlayer(1, KAYDEL).Build());
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(1);
  });
});
