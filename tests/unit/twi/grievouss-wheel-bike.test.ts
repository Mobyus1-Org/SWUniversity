import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
import { HostDependentUpgradeCost } from "@/server/engine/card-playability";

// TWI_236 Grievous's Wheel Bike (+3/+3): "While playing this upgrade on General Grievous, it costs 2 resources less to play."
describe("TWI_236 Grievous's Wheel Bike", () => {
  it("2 less on General Grievous only", () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.generalGrievousTrophyCollector).WithGroundUnitForPlayer(1, MARINE).Build());
    const cost = HostDependentUpgradeCost(g.state, 1, Cards.upgrades.twi.grievousWheelBike)!;
    expect(cost.waived).toBe(cost.full - 2);
    expect(cost.waivedHostPlayIds).toEqual([g.state.player1.groundArena[0].playId]);
  });
});
