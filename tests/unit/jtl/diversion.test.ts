import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load, MARINE } = F;
const DIVERSION = Cards.events.jtl.diversion;

// JTL_229 Diversion: "Give a unit Sentinel for this phase."
describe("JTL_229 Diversion", () => {
  it("the chosen unit gains Sentinel", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, DIVERSION).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    const [a, b] = g.state.player1.groundArena;
    expect(HasKeyword(a.cardId, "Sentinel", a.playId, 1)).toBe(true);
    expect(HasKeyword(b.cardId, "Sentinel", b.playId, 1)).toBe(false);
  });
});
