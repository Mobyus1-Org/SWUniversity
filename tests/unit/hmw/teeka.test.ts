import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load, MARINE } = F;
const TEEKA = Cards.units.hmw.teeka;
const GUARDIAN = Cards.units.hmw.packGuardian; // Sentinel while ready
const sentinel = (u: { cardId: string; playId: string; controller: 1 | 2 }) => HasKeyword(u.cardId, "Sentinel", u.playId, u.controller);

// HMW_221 Teeka: "When Played: Choose one: Give a unit Sentinel for this phase. / A unit loses Sentinel for this phase."
describe("HMW_221 Teeka", () => {
  it("gives a unit Sentinel", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, TEEKA).Build());
    await F.playFromHand(g);
    await g.chooseOptionAsync(1, "give");
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(sentinel(g.state.player1.groundArena[0])).toBe(true);
  });

  it("a unit loses Sentinel", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, GUARDIAN).WithCardInHandForPlayer(1, TEEKA).Build());
    expect(sentinel(g.state.player2.groundArena[0])).toBe(true);
    await F.playFromHand(g);
    await g.chooseOptionAsync(1, "lose");
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(sentinel(g.state.player2.groundArena[0])).toBe(false);
  });
});
