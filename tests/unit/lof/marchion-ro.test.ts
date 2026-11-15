import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load } = F;
const MARCHION = Cards.units.lof.marchionRo;
const TRACKER = Cards.units.lof.tuskenTracker; // 2/4, Raid 2

// LOF_186 Marchion Ro: "Each friendly unit's Raid is doubled."
describe("LOF_186 Marchion Ro", () => {
  it("doubles a friendly unit's Raid", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, TRACKER).WithGroundUnitForPlayer(1, MARCHION).Build());
    await F.attackBase(g, 0);
    expect(g.state.player2.base.damage).toBe(10 + 2 + 4);
  });

  it("control: Raid 2 without him", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, TRACKER).Build());
    await F.attackBase(g, 0);
    expect(g.state.player2.base.damage).toBe(10 + 2 + 2);
  });
});
