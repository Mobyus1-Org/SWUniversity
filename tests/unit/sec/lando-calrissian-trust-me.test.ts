import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const LANDO = Cards.units.sec.landoCalrissian;

// SEC_068 Lando Calrissian: "When Played: You may choose an enemy unit and another friendly non-leader unit. If you do,
// heal 6 damage from your base and the enemy unit captures the friendly unit."
describe("SEC_068 Lando Calrissian (Trust Me)", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, LANDO).Build());

  it("heals 6 from your base; the enemy unit captures your unit", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player1.base.damage).toBe(10 - 6);
    expect(g.state.player2.groundArena[0].captives.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([LANDO]);
  });

  it("Lando himself can't be the captured unit", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    await F.pick(g, [g.state.player1.groundArena.find(u => u.cardId === LANDO)!.playId]);
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("declining: no heal", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    expect(g.state.player1.base.damage).toBe(10);
  });
});
