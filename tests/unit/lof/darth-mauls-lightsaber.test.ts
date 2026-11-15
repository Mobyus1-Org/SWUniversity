import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const SABER = Cards.upgrades.lof.darthMaulsLightsaber;  // +4/+2
const MAUL = Cards.units.twi.darthMaulRevengeAtLast;    // "Darth Maul", 5/6

// LOF_140 Darth Maul's Lightsaber: "When Played: If attached unit is Darth Maul, you may attack with him. For this
// attack, he gains Overwhelm and can't attack bases."
describe("LOF_140 Darth Maul's Lightsaber", () => {
  const setup = (host: string) => load(board().WithGroundUnitForPlayer(1, host).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, SABER).Build());
  const play = async (g: ReturnType<typeof setup>) => { await F.playFromHand(g); await F.pick(g, [g.state.player1.groundArena[0].playId]); };

  it("on Darth Maul: he attacks with Overwhelm", async () => {
    const g = setup(MAUL);
    await play(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(10 + (5 + 4 - 3));
  });

  it("he can't attack a base", async () => {
    const g = setup(MAUL);
    await play(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(10);
  });

  it("declining: no attack", async () => {
    const g = setup(MAUL);
    await play(g);
    await g.chooseNoAsync(1);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("on another unit: no offer", async () => {
    const g = setup(CSF);
    await play(g);
    expect(F.prompt(g)).toBeNull();
  });
});
