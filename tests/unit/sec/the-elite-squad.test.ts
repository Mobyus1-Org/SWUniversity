import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const SQUAD = Cards.units.sec.theEliteSquad; // 6/8, Grit
const LEIA = Cards.units.jtl.leiaOrgana;     // unique 3/4

// SEC_143 The Elite Squad: "When Played/When damage is dealt to this unit: You may deal 2 damage to another unique unit."
describe("SEC_143 The Elite Squad", () => {
  it("When Played: 2 damage to a unique unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, LEIA).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, SQUAD).Build());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("a non-unique unit is refused", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, LEIA).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, SQUAD).Build());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[1].playId]);
    expect(g.state.player2.groundArena[1].damage).toBe(0);
  });

  it("damage dealt to it (combat): the same offer", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, SQUAD).WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(2, LEIA).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena.find(u => u.cardId === LEIA)!.playId]);
    expect(g.state.player2.groundArena.find(u => u.cardId === LEIA)!.damage).toBe(2);
  });

  it("no unique unit anywhere: no offer", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, SQUAD).Build());
    await F.playFromHand(g);
    expect(F.prompt(g)).toBeNull();
  });
});
