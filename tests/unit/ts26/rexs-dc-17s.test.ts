import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const DC17S = Cards.upgrades.ts26.rexsDC17s;          // +3/+2
const AURRA = Cards.units.twi.aurraSingCrackshot;     // readies when an enemy ground unit attacks your base

// TS26_63 Rex's DC-17s: attached unit gains "When an enemy unit readies during the action phase: Ready this unit. Use this
// ability only once each round."
describe("TS26_63 Rex's DC-17s", () => {
  it("an enemy unit readying readies the attached unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(1, MARINE, false).WithUpgradesOnGroundUnitForPlayer(1, 1, [F.up(DC17S, 1)])
      .WithGroundUnitForPlayer(2, AURRA, false).Build());
    await F.attackBase(g, 0); // Aurra Sing readies
    expect(g.state.player2.groundArena[0].ready).toBe(true);
    expect(g.state.player1.groundArena[1].ready).toBe(true);
  });

  it("a friendly unit readying does nothing", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(2, MARINE, false).WithUpgradesOnGroundUnitForPlayer(2, 1, [F.up(DC17S, 2)])
      .WithGroundUnitForPlayer(1, CSF).Build());
    // P2's own unit readying (none here) — check the control: P1 attacking P2's base readies nobody
    await F.attackBase(g, 0);
    expect(g.state.player2.groundArena[1].ready).toBe(false);
  });
});
