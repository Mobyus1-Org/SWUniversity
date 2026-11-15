import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load } = F;
const DROID = Cards.units.token.battleDroid;    // 1/1 Separatist Droid token

// TWI_145 Jesse (4/4): "Raid 1" / "When Played: An opponent creates 2 Battle Droid tokens."
describe("TWI_145 Jesse", () => {
  it("the opponent creates 2 Battle Droids", async () => {
    const g = load(board().WithCardInHandForPlayer(1, Cards.units.twi.jesse).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player2.groundArena.filter(u => u.cardId === DROID).length).toBe(2);
  });
});
