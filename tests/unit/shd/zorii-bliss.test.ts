import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackBase, prompt, MARINE, CSF } from "./scan-fixtures";

// SHD_203 Zorii Bliss — Valiant Smuggler (4/7 Ground): "On Attack: Draw a card. At the start of the
// regroup phase, discard a card from your hand." / Smuggle
describe("SHD_203 Zorii Bliss", () => {
  it("draws on attack, then discards a card when the regroup phase starts", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.zoriiBliss).WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, CSF).Build());
    await attackBase(g);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([CSF]);
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});
    expect(prompt(g)?.type).toBe("Target"); // choose the card to discard
    await g.chooseCardFromHandAsync(1, 0);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(CSF);
  });
});
