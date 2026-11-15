import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const OWEN = Cards.units.lof.owenLars; // 0/3
const KARIS = Cards.units.lof.karis;   // Force unit

// LOF_057 Owen Lars: "When Defeated: Search the top 5 cards of your deck for a Force unit, reveal it, and draw it."
describe("LOF_057 Owen Lars", () => {
  it("When Defeated: draws a Force unit from the top 5", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, OWEN).WithGroundUnitForPlayer(2, CSF).WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, KARIS).WithCardInDeckForPlayer(1, MARINE).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player1.groundArena).toHaveLength(0);
    const search = F.prompt(g) as unknown as { choices: { tempId: string; cardId: string }[] };
    expect(search.choices.map(c => c.cardId)).toEqual([KARIS]);
    await g.chooseDeckSearchAsync(1, [search.choices[0].tempId]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([KARIS]);
  });
});
