import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { TraitContains } from "@/server/engine/core-functions";
const { board, load, MARINE, CSF, XWING, power } = F;
const CLONE = Cards.units.twi.clone;          // cost 7, no printed power or HP
const JESSE = Cards.units.twi.jesse;          // 4/4 — When Played: an opponent creates 2 Battle Droid tokens
const LEIA = Cards.units.jtl.leiaOrgana;      // unique
const DROID = Cards.units.token.battleDroid;

// TWI_116 Clone: "You may have this unit enter play as a copy of a non-leader, non-Vehicle unit in play, except it gains
// the Clone trait and is not unique. (Only the card's printed attributes are copied.)"
describe("TWI_116 Clone", () => {
  const play = async (g: ReturnType<typeof load>, modelPlayId: string) => {
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [modelPlayId]);
  };

  it("enters as a copy of the chosen unit, with the Clone trait", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, CLONE).Build());
    await play(g, g.state.player2.groundArena[0].playId);
    const copy = g.state.player1.groundArena[0];
    expect(copy.cardId).toBe(MARINE);
    expect(power(copy)).toBe(3);
    expect(TraitContains(copy.cardId, "Clone", 1, copy.playId)).toBe(true);
    expect(g.state.player2.groundArena[0].cardId).toBe(MARINE); // the original is untouched
  });

  it("the copied unit's When Played triggers", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, JESSE).WithCardInHandForPlayer(1, CLONE).Build());
    await play(g, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.groundArena.filter(u => u.cardId === DROID)).toHaveLength(2);
  });

  it("it is not unique: copying your own unique unit keeps both", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, LEIA).WithCardInHandForPlayer(1, CLONE).Build());
    await play(g, g.state.player1.groundArena[0].playId);
    if (F.prompt(g)) await g.chooseNoAsync(1); // Leia's own When Played (attack with a Pilot) — declined
    expect(g.state.player1.groundArena.filter(u => u.cardId === LEIA)).toHaveLength(2);
  });

  it("leaving play, the card is Clone again — defeated into the discard pile", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, CLONE).Build());
    await play(g, g.state.player2.groundArena[0].playId);
    await g.attackWithGroundUnitAsync(2, 1); // P2's CSF attacks the copy (a 3/3 Marine)
    await F.pick(g, [g.state.player1.groundArena[0].playId], 2);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([CLONE]);
  });

  it("…and returned to hand as Clone", async () => {
    const g = load(board(Cards.leaders.sor.hanSolo).FillResourcesForPlayer(1, MARINE, 20).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, CLONE).WithCardInHandForPlayer(1, Cards.events.hmw.howl).Build());
    await play(g, g.state.player2.groundArena[0].playId);
    await g.dispatchAsync(2, "pass-action", {});
    await F.playFromHand(g); // Howl: a Beast, then return a non-leader unit
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena.find(u => u.cardId === MARINE)!.playId]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([CLONE]);
  });

  it("leaders and Vehicles can't be copied; with nothing to copy it enters as itself and is defeated", async () => {
    const g = load(board().WithSpaceUnitForPlayer(2, XWING).WithCardInHandForPlayer(1, CLONE).Build());
    await F.playFromHand(g);
    expect(F.prompt(g)).toBeNull();
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([CLONE]);
  });

  it("declining the copy: enters as itself and is defeated", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, CLONE).Build());
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([CLONE]);
  });
});
