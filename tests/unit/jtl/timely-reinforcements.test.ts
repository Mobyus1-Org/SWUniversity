import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load, MARINE, XWING } = F;
const TIMELY = Cards.events.jtl.timelyReinforcements;

// JTL_130 Timely Reinforcements: "Choose an opponent. For every 2 resources they control, create an X-Wing
// token and give it Sentinel for this phase."
describe("JTL_130 Timely Reinforcements", () => {
  it("creates one Sentinel X-Wing per 2 opposing resources (rounded down)", async () => {
    const g = load(board().FillResourcesForPlayer(2, MARINE, 5).WithCardInHandForPlayer(1, TIMELY).Build());
    await F.playFromHand(g);
    const xwings = g.state.player1.spaceArena.filter(u => u.cardId === XWING);
    expect(xwings).toHaveLength(2);
    for (const x of xwings) expect(HasKeyword(x.cardId, "Sentinel", x.playId, 1)).toBe(true);
  });

  it("an existing X-Wing does not gain Sentinel", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, XWING).FillResourcesForPlayer(2, MARINE, 2).WithCardInHandForPlayer(1, TIMELY).Build());
    const old = g.state.player1.spaceArena[0];
    await F.playFromHand(g);
    expect(g.state.player1.spaceArena).toHaveLength(2);
    expect(HasKeyword(old.cardId, "Sentinel", old.playId, 1)).toBe(false);
  });
});
