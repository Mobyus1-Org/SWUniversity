import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF, XWING } = F;
const BOSSK = Cards.units.jtl.bossk;        // 4/4; as a pilot +2/+2
const TANTIVE = Cards.units.jtl.tantiveIV;  // 5/7

// JTL_187 Bossk: "On Attack: Exhaust the defender and deal 1 damage to it (if it's a unit)." Piloting grants
// the same On Attack.
describe("JTL_187 Bossk", () => {
  it("exhausts the defending unit and deals it 1 damage before combat", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, BOSSK).WithGroundUnitForPlayer(2, CSF).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(g.state.player2.groundArena[0].damage).toBe(1 + 4);
  });

  it("attacking a base: nothing extra", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, BOSSK).Build());
    await F.attackBase(g);
    expect(g.state.player2.base.damage).toBe(10 + 4);
  });

  it("the Vehicle he pilots gains the On Attack", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).WithUpgradesOnSpaceUnitForPlayer(1, 0, [F.up(BOSSK, 1)]).WithSpaceUnitForPlayer(2, TANTIVE).Build());
    await F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId, "space");
    expect(g.state.player2.spaceArena[0].ready).toBe(false);
    expect(g.state.player2.spaceArena[0].damage).toBe(1 + 4);
  });
});
