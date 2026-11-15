import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const SABER = Cards.upgrades.lof.quiGonJinnsLightsaber;
const QUIGON = Cards.units.lof.quiGonJinn;

// LOF_201 Qui-Gon Jinn's Lightsaber: "When Played: If attached unit is Qui-Gon Jinn, you may exhaust any number of units
// with combined cost 6 or less."
describe("LOF_201 Qui-Gon Jinn's Lightsaber", () => {
  const setup = (host: string) => load(board().WithGroundUnitForPlayer(1, host).WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, SABER).Build());
  const play = async (g: ReturnType<typeof setup>) => { await F.playFromHand(g); await F.pick(g, [g.state.player1.groundArena[0].playId]); };

  it("on Qui-Gon: exhausts units with combined cost up to 6", async () => {
    const g = setup(QUIGON);
    await play(g);
    await F.pick(g, [g.state.player2.groundArena[0].playId, g.state.player2.groundArena[1].playId]); // 2 + 4
    expect(g.state.player2.groundArena.map(u => u.ready)).toEqual([false, false, true]);
  });

  it("more than 6 in total is refused", async () => {
    const g = setup(QUIGON);
    await play(g);
    await F.pick(g, g.state.player2.groundArena.map(u => u.playId)); // 2 + 4 + 2
    expect(g.state.player2.groundArena.every(u => u.ready)).toBe(true);
  });

  it("on anyone else: nothing", async () => {
    const g = setup(MARINE);
    await play(g);
    expect(F.prompt(g)).toBeNull();
  });
});
