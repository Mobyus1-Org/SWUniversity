import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF, MARINE, XWING } = F;
const TRACE = Cards.units.jtl.traceMartez;

// JTL_066 Trace Martez (piloting) — attached unit gains "On Attack: You may heal 2 total damage from any
// number of units."
describe("JTL_066 Trace Martez (piloting)", () => {
  const setup = () => load(board().WithSpaceUnitForPlayer(1, XWING).WithUpgradesOnSpaceUnitForPlayer(1, 0, [F.up(TRACE, 1)])
    .WithGroundUnitForPlayer(1, CSF, true, 3).WithGroundUnitForPlayer(1, MARINE, true, 2).Build());

  it("splits 2 healing across units", async () => {
    const g = setup();
    await F.attackBase(g, 0, "space");
    await g.spreadDamageAsync(1, [[1, "Ground", 0, 1], [1, "Ground", 1, 1]]);
    expect(g.state.player1.groundArena.map(u => u.damage)).toEqual([2, 1]);
  });

  it("cannot heal more than 2 in total", async () => {
    const g = setup();
    await F.attackBase(g, 0, "space");
    await g.spreadDamageAsync(1, [[1, "Ground", 0, 3]]);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });
});
