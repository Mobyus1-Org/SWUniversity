import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const PARTY = Cards.units.hmw.raidingParty;   // 0/6, Raid 6
const NOMADS = Cards.units.hmw.duneSeaNomads; // Tusken
const DUNE_SEA = Cards.bases.hmw.duneSea;

// HMW_230 Raiding Party: "Raid 6. When Played: If you control another Tusken unit or a Tatooine base, you may exhaust a
// ground unit."
describe("HMW_230 Raiding Party", () => {
  it("with a Tatooine base: may exhaust a ground unit", async () => {
    const g = load(board(Cards.leaders.sor.hanSolo).MyBase(DUNE_SEA, 10).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, PARTY).Build());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });

  it("with another Tusken: the same", async () => {
    const g = load(board(Cards.leaders.sor.hanSolo).WithGroundUnitForPlayer(1, NOMADS).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, PARTY).Build());
    await F.playFromHand(g);
    expect(F.prompt(g)).not.toBeNull();
  });

  it("neither: no offer", async () => {
    const g = load(board(Cards.leaders.sor.hanSolo).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, PARTY).Build());
    await F.playFromHand(g);
    expect(F.prompt(g)).toBeNull();
  });

  it("Raid 6", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, PARTY).Build());
    await F.attackBase(g);
    expect(g.state.player2.base.damage).toBe(10 + 6);
  });
});
