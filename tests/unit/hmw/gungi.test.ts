import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const GUNGI = Cards.units.hmw.gungi; // 2/5, Grit

// HMW_166 Gungi: "Grit. When this unit is dealt damage and survives: You may discard a card from your hand. If you do,
// ready this unit."
describe("HMW_166 Gungi", () => {
  const setup = (hand: boolean) => { let b = board().WithGroundUnitForPlayer(1, GUNGI).WithGroundUnitForPlayer(2, MARINE); if (hand) b = b.WithCardInHandForPlayer(1, MARINE); return load(b.Build()); };

  it("damaged and survives: discard a card to ready him", async () => {
    const g = setup(true);
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("declining: stays exhausted", async () => {
    const g = setup(true);
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseNoAsync(1);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("empty hand: no offer", async () => {
    const g = setup(false);
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(F.prompt(g)).toBeNull();
  });

  it("has Grit", async () => {
    const g = setup(false);
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(F.power(g.state.player1.groundArena[0])).toBe(2 + 3);
  });
});
