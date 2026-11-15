import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const HUNTER = Cards.units.jtl.contractedHunter;

// JTL_216 Contracted Hunter: "When the regroup phase starts: Defeat this unit."
describe("JTL_216 Contracted Hunter", () => {
  it("is defeated when the regroup phase starts", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, HUNTER).WithGroundUnitForPlayer(1, MARINE).Build());
    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(HUNTER);
  });

  it("survives the action phase", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, HUNTER).Build());
    await F.attackBase(g);
    expect(g.state.player1.groundArena).toHaveLength(1);
  });
});
