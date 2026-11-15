import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const STARHAWK = Cards.units.jtl.theStarhawk;
const spent = (g: ReturnType<typeof load>) => g.state.player1.resources.filter(r => !r.ready).length;

// JTL_105 The Starhawk: "While paying costs, you pay half as many resources, rounded up."
describe("JTL_105 The Starhawk", () => {
  it("a 2-cost unit costs 1", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, STARHAWK).WithCardInHandForPlayer(1, MARINE).Build());
    await F.playFromHand(g);
    expect(spent(g)).toBe(1);
  });

  it("an odd cost rounds up (5 → 3)", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, STARHAWK).WithCardInHandForPlayer(1, Cards.units.jtl.hanSolo).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Unit"); // the Starhawk is a Vehicle without a Pilot, so Han asks
    expect(spent(g)).toBe(Math.ceil((5 + 2) / 2)); // Han is Cunning/Heroism: +2 aspect penalty under Leia
  });

  it("control: without the Starhawk the full cost is paid", async () => {
    const g = load(board().WithCardInHandForPlayer(1, CSF).Build());
    await F.playFromHand(g);
    expect(spent(g)).toBe(4);
  });
});
