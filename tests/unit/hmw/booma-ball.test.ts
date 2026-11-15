import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const BOOMA = Cards.upgrades.hmw.boomaBall;
const AMBITION = Cards.upgrades.hmw.villainousAmbition; // cost 2
const TURTLE = Cards.units.ash.dinosaurTurtle;

// HMW_236 Booma Ball: "When Played: You may return an upgrade that costs 3 or less to its owner's hand."
describe("HMW_236 Booma Ball", () => {
  const setup = () => load(board(Cards.leaders.sor.hanSolo).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).WithUpgradesOnGroundUnitForPlayer(2, 0, [F.up(AMBITION, 2)]).WithCardInHandForPlayer(1, BOOMA).Build());
  const play = async (g: ReturnType<typeof setup>) => { await F.playFromHand(g); await F.pick(g, [g.state.player1.groundArena[0].playId]); };

  it("returns an upgrade to its owner's hand", async () => {
    const g = setup();
    await play(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].upgrades[0].playId]);
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([AMBITION]);
  });

  it("a token upgrade returned simply ceases to exist", async () => {
    const g = load(board(Cards.leaders.sor.hanSolo).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, TURTLE).WithUpgradesOnGroundUnitForPlayer(2, 0, [F.up(F.XP, 2)]).WithCardInHandForPlayer(1, BOOMA).Build());
    await play(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].upgrades[0].playId]);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
    expect(g.state.player2.hand).toHaveLength(0);
  });

  it("declining", async () => {
    const g = setup();
    await play(g);
    await g.chooseNoAsync(1);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(1);
  });
});
