import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, XWING } = F;
const HOME_ONE = Cards.units.jtl.homeOne; // cost 9, Cunning/Heroism
const spent = (g: ReturnType<typeof load>) => g.state.player1.resources.filter(r => !r.ready).length;

// JTL_204 Home One: "If an opponent controls 3 or more space units, this unit costs 3 resources less to play."
describe("JTL_204 Home One", () => {
  const setup = (n: number) => { let b = board(Cards.leaders.sor.hanSolo).FillResourcesForPlayer(1, F.MARINE, 16).WithCardInHandForPlayer(1, HOME_ONE); for (let i = 0; i < n; i++) b = b.WithSpaceUnitForPlayer(2, XWING); return load(b.Build()); };

  it("3 enemy space units: 3 less", async () => {
    const g = setup(3);
    await F.playFromHand(g);
    expect(spent(g)).toBe(9 - 3);
  });

  it("2 enemy space units: full cost", async () => {
    const g = setup(2);
    await F.playFromHand(g);
    expect(spent(g)).toBe(9);
  });
});
