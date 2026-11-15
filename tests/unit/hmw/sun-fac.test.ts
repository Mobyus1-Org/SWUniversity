import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load, MARINE } = F;
const SUN_FAC = Cards.units.hmw.sunFac;

// HMW_243 Sun Fac: "When Played: Give a unit Grit for this phase."
describe("HMW_243 Sun Fac", () => {
  it("the chosen unit gains Grit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, SUN_FAC).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    const u = g.state.player1.groundArena[0];
    expect(HasKeyword(u.cardId, "Grit", u.playId, 1)).toBe(true);
  });
});
