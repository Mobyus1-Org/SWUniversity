import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { TraitContains } from "@/server/engine/core-functions";
const { board, load, MARINE, SHIELD, count } = F;
const DISGUISE = Cards.upgrades.law.leiasDisguise;
const LEIA = Cards.units.jtl.leiaOrgana;

// LAW_111 Leia's Disguise: "Attached unit gains the Underworld trait. When Played: If attached unit is Leia Organa, give
// a Shield token to a friendly unit."
describe("LAW_111 Leia's Disguise", () => {
  it("on Leia: a friendly unit gets a Shield; she becomes Underworld", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, LEIA).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, DISGUISE).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await F.pick(g, [g.state.player1.groundArena[1].playId]);
    expect(count(g.state.player1.groundArena[1], SHIELD)).toBe(1);
    const leia = g.state.player1.groundArena[0];
    expect(TraitContains(leia.cardId, "Underworld", 1, leia.playId)).toBe(true);
  });

  it("on someone else: no Shield", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, DISGUISE).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(F.prompt(g)).toBeNull();
  });
});
