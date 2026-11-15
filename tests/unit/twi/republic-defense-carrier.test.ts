import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XWING } = F;
import { playCost } from "@/server/engine/card-playability";

// TWI_098 Republic Defense Carrier (6/7 Space, cost 11): "This unit costs 1 resource less to play for each unit
// controlled by the opponent who controls the most units." / Sentinel
describe("TWI_098 Republic Defense Carrier", () => {
  it("1 less per enemy unit", () => {
    const none = load(board().Build());
    const three = load(board().WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, MARINE).WithSpaceUnitForPlayer(2, XWING).Build());
    expect(playCost(three.state, 1, Cards.units.twi.republicDefenseCarrier)).toBe(playCost(none.state, 1, Cards.units.twi.republicDefenseCarrier) - 3);
  });
});
