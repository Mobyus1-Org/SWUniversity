import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load } = F;
const CLONE = Cards.units.token.cloneTrooper;   // 2/2 Republic Clone Trooper token
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// TWI_250 Sword and Shield Maneuver (Event): "Give each friendly Trooper unit Raid 1 for this phase. Give each friendly Jedi unit Sentinel for this phase."
describe("TWI_250 Sword and Shield Maneuver", () => {
  it("Troopers Raid 1, Jedi Sentinel", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CLONE).WithGroundUnitForPlayer(1, Cards.units.twi.ahsokaTanoUnit).WithCardInHandForPlayer(1, Cards.events.twi.swordAndShieldManeuver).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(RaidAmount(CLONE, g.state.player1.groundArena[0].playId, 1)).toBe(1);
    expect(HasSentinel(Cards.units.twi.ahsokaTanoUnit, g.state.player1.groundArena[1].playId, 1)).toBe(true);
  });
});
