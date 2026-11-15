import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load, MARINE } = F;
const SALES = Cards.units.hmw.sandcrawlerSalesTeam;
const AMBITION = Cards.upgrades.hmw.villainousAmbition; // cost 2 upgrade
const DUNE_SEA = Cards.bases.hmw.duneSea;                // Tatooine base

// HMW_222 Sandcrawler Sales Team: "Saboteur. When Played: If you control a Tatooine base, you may return an upgrade that
// costs 3 or less to its owner's hand."
describe("HMW_222 Sandcrawler Sales Team", () => {
  const setup = (tatooine: boolean) => {
    let b = board(Cards.leaders.sor.hanSolo).WithGroundUnitForPlayer(2, MARINE).WithUpgradesOnGroundUnitForPlayer(2, 0, [F.up(AMBITION, 2)]).WithCardInHandForPlayer(1, SALES);
    if (tatooine) b = b.MyBase(DUNE_SEA, 10);
    return load(b.Build());
  };

  it("with a Tatooine base: returns an upgrade to its owner's hand", async () => {
    const g = setup(true);
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].upgrades[0].playId]);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([AMBITION]);
  });

  it("without one: no offer", async () => {
    const g = setup(false);
    await F.playFromHand(g);
    expect(F.prompt(g)).toBeNull();
  });

  it("has Saboteur", async () => {
    const g = setup(false);
    await F.playFromHand(g);
    const u = g.state.player1.groundArena[0];
    expect(HasKeyword(u.cardId, "Saboteur", u.playId, 1)).toBe(true);
  });
});
