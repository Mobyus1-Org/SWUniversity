import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const MINA = Cards.units.sec.minaBonteri; // 2/4

// SEC_094 Mina Bonteri: "When Defeated: You may disclose Command Command Heroism. If you do, draw a card."
describe("SEC_094 Mina Bonteri", () => {
  const setup = (marines: number) => {
    let b = board().WithGroundUnitForPlayer(1, MINA, true, 2).WithGroundUnitForPlayer(2, CSF).WithCardInDeckForPlayer(1, CSF);
    for (let i = 0; i < marines; i++) b = b.WithCardInHandForPlayer(1, MARINE); // each Marine shows Command + Heroism
    return load(b.Build());
  };

  it("disclosing draws a card", async () => {
    const g = setup(2);
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(1);
    expect(g.state.player1.hand).toHaveLength(3);
  });

  it("declining: no draw", async () => {
    const g = setup(2);
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseNoAsync(1);
    expect(g.state.player1.hand).toHaveLength(2);
  });

  it("can't show Command twice: no offer", async () => {
    const g = setup(1);
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(F.prompt(g)).toBeNull();
  });
});
