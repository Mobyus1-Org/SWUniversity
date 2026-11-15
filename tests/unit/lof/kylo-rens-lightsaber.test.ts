import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const SABER = Cards.upgrades.lof.kyloRensLightsaber;  // +1/+3
const KARIS = Cards.units.lof.karis;                  // Force
const SUPPRESSOR = Cards.units.twi.triDroidSuppressor; // "When Played: Exhaust an enemy ground unit."
const PARTY = Cards.units.hmw.raidingParty;            // "…you may exhaust a ground unit" (with a Tatooine base)

// LOF_040 Kylo Ren's Lightsaber: "If attached unit is a Force unit, it gains: 'This unit can't be exhausted by enemy card
// abilities.'"
describe("LOF_040 Kylo Ren's Lightsaber", () => {
  const enemyExhausts = (host: string) => load(board().WithGroundUnitForPlayer(2, host).WithUpgradesOnGroundUnitForPlayer(2, 0, [F.up(SABER, 2)]).WithCardInHandForPlayer(1, SUPPRESSOR).Build());

  it("a Force unit can't be exhausted by an enemy card ability", async () => {
    const g = enemyExhausts(KARIS);
    await F.playFromHand(g);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });

  it("a non-Force unit with it can", async () => {
    const g = enemyExhausts(MARINE);
    await F.playFromHand(g);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });

  it("a friendly ability can still exhaust it", async () => {
    const g = load(board(Cards.leaders.sor.hanSolo).MyBase(Cards.bases.hmw.duneSea, 10).WithGroundUnitForPlayer(1, KARIS).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(SABER, 1)]).WithCardInHandForPlayer(1, PARTY).Build());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("attacking still exhausts it", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, KARIS).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(SABER, 1)]).Build());
    await F.attackBase(g);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});
