import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, XWING } = F;
const DENGAR = Cards.units.jtl.dengar;
const IG2000 = Cards.units.jtl.ig2000; // Underworld Vehicle, 3/4

// JTL_139 Dengar (piloting) — attached unit gains "On Attack: Deal 2 indirect damage to a player. If this
// unit is an Underworld unit, deal 3 indirect damage instead."
describe("JTL_139 Dengar (piloting)", () => {
  it("2 indirect damage to the opponent", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithUpgradesOnSpaceUnitForPlayer(1, 0, [F.up(DENGAR, 1)]).Build());
    await F.attackBase(g, 0, "space");
    expect(g.state.player2.base.damage).toBe(10 + 2 + (2 + 1));
  });

  it("an Underworld host deals 3 instead", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, IG2000).WithUpgradesOnSpaceUnitForPlayer(1, 0, [F.up(DENGAR, 1)]).Build());
    await F.attackBase(g, 0, "space");
    expect(g.state.player2.base.damage).toBe(10 + 3 + (3 + 1));
  });
});
