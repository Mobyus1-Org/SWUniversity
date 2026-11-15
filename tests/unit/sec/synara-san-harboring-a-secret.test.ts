import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const SYNARA = Cards.units.sec.synaraSan; // 7/7

// SEC_225 Synara San: "On Attack: For each friendly unit, ready a friendly resource."
describe("SEC_225 Synara San (Harboring a Secret)", () => {
  it("readies one resource per friendly unit (herself included)", async () => {
    const s = board().WithGroundUnitForPlayer(1, SYNARA).WithGroundUnitForPlayer(1, MARINE).Build();
    for (let i = 0; i < 5; i++) s.player1.resources[i].ready = false;
    const g = load(s);
    await F.attackBase(g, 0);
    expect(g.state.player1.resources.filter(r => !r.ready)).toHaveLength(5 - 2);
  });
});
