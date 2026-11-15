import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load } = F;
const DECIMATOR = Cards.units.jtl.decimatorOfDissidents; // cost 4
const DENGAR = Cards.units.jtl.dengar;
const spent = (g: ReturnType<typeof load>) => g.state.player1.resources.filter(r => !r.ready).length;

// JTL_138 Decimator of Dissidents: "If you dealt indirect damage this phase, this unit costs 1 resource
// less to play."
describe("JTL_138 Decimator of Dissidents", () => {
  it("after dealing indirect damage it costs 1 less", async () => {
    const g = load(board(Cards.leaders.sor.sabineWren).WithSpaceUnitForPlayer(1, F.XWING).WithUpgradesOnSpaceUnitForPlayer(1, 0, [F.up(DENGAR, 1)]).WithCardInHandForPlayer(1, DECIMATOR).Build());
    await F.attackBase(g, 0, "space"); // Dengar's 2 indirect damage, all to the unit-less opponent's base
    await g.dispatchAsync(2, "pass-action", {});
    const before = spent(g);
    await F.playFromHand(g);
    expect(spent(g) - before).toBe(4 + 2 - 1); // Aggression/Villainy under Sabine: +2 for Villainy
  });

  it("control: full cost without indirect damage", async () => {
    const g = load(board(Cards.leaders.sor.sabineWren).WithCardInHandForPlayer(1, DECIMATOR).Build());
    await F.playFromHand(g);
    expect(spent(g)).toBe(4 + 2);
  });
});
