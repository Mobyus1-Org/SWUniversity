import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const CLONE = Cards.units.token.cloneTrooper;   // 2/2 Republic Clone Trooper token
import { playCost } from "@/server/engine/card-playability";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// TWI_051 For The Republic (+2/+2): "If you control 3 or more Republic units, this upgrade costs 2 resources
// less to play." / "Attached unit gains: 'Coordinate — Restore 2.'"
describe("TWI_051 For The Republic", () => {
  it("costs 2 less with 3 Republic units", () => {
    const two = load(board().WithGroundUnitForPlayer(1, CLONE).WithGroundUnitForPlayer(1, CLONE).Build());
    const three = load(board().WithGroundUnitForPlayer(1, CLONE).WithGroundUnitForPlayer(1, CLONE).WithGroundUnitForPlayer(1, CLONE).Build());
    expect(playCost(three.state, 1, Cards.upgrades.twi.forTheRepublic)).toBe(playCost(two.state, 1, Cards.upgrades.twi.forTheRepublic) - 2);
  });
  it("the host gains Restore 2 while Coordinate is on", () => {
    const g = load(board().WithGroundUnitForPlayer(1, CLONE).WithGroundUnitForPlayer(1, CLONE).WithGroundUnitForPlayer(1, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(1, 2, [F.up(Cards.upgrades.twi.forTheRepublic, 1)]).Build());
    expect(RestoreAmount(MARINE, g.state.player1.groundArena[2].playId, 1)).toBe(2);
  });
});
