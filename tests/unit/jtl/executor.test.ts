import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load } = F;
const EXECUTOR = Cards.units.jtl.executor; // 12/12 Space, cost 11
const TIE = Cards.units.token.tieFighter;
const TANTIVE = Cards.units.jtl.tantiveIV;
const ties = (g: ReturnType<typeof load>) => g.state.player1.spaceArena.filter(u => u.cardId === TIE).length;

// JTL_090 Executor: "When Played/On Attack/When Defeated: Create 3 TIE Fighter tokens."
describe("JTL_090 Executor", () => {
  it("When Played: creates 3 TIE Fighters", async () => {
    const g = load(board().FillResourcesForPlayer(1, F.MARINE, 16).WithCardInHandForPlayer(1, EXECUTOR).Build());
    await F.playFromHand(g);
    expect(ties(g)).toBe(3);
  });

  it("On Attack: creates 3 TIE Fighters", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, EXECUTOR).Build());
    await F.attackBase(g, 0, "space");
    expect(ties(g)).toBe(3);
  });

  it("When Defeated: creates 3 more (6 with the On Attack)", async () => {
    const g = load(board().WithSpaceUnitForPlayer(1, EXECUTOR, true, 11).WithSpaceUnitForPlayer(2, TANTIVE).Build());
    await F.attackUnit(g, 0, g.state.player2.spaceArena[0].playId, "space");
    expect(g.state.player1.spaceArena.some(u => u.cardId === EXECUTOR)).toBe(false);
    expect(ties(g)).toBe(6);
  });
});
