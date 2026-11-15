import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, SHIELD, count } = F;
const BRAVERY = Cards.upgrades.hmw.heroicBravery;
const DEATH_TROOPERS = Cards.units.ash.deathTrooperSquad; // Villainy

// HMW_264 Heroic Bravery: "When Played: If attached unit is a Heroism unit, give a Shield token to it."
describe("HMW_264 Heroic Bravery", () => {
  it("on a Heroism unit: a Shield token", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, BRAVERY).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(count(g.state.player1.groundArena[0], SHIELD)).toBe(1);
  });

  it("on a non-Heroism unit: none", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, DEATH_TROOPERS).WithCardInHandForPlayer(1, BRAVERY).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(count(g.state.player1.groundArena[0], SHIELD)).toBe(0);
  });
});
