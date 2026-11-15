import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { TraitContains } from "@/server/engine/core-functions";
const { board, load, MARINE, power, hp } = F;
const FULCRUM = Cards.upgrades.law.fulcrum; // +2/+2
const KARIS = Cards.units.lof.karis;        // 2/4, not a Rebel

// LAW_150 Fulcrum: "Attached unit gains the Rebel trait and 'Each other friendly Rebel unit gets +2/+2.'"
describe("LAW_150 Fulcrum", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, KARIS).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(FULCRUM, 1)]).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());

  it("the attached unit becomes a Rebel", () => {
    const g = setup();
    const k = g.state.player1.groundArena[0];
    expect(TraitContains(k.cardId, "Rebel", 1, k.playId)).toBe(true);
  });

  it("other friendly Rebels get +2/+2; the host and enemies don't", () => {
    const g = setup();
    expect([power(g.state.player1.groundArena[1]), hp(g.state.player1.groundArena[1])]).toEqual([5, 5]);
    expect(power(g.state.player1.groundArena[0])).toBe(2 + 2);
    expect(power(g.state.player2.groundArena[0])).toBe(3);
  });
});
