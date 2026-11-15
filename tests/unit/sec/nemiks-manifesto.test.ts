import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { TraitContains } from "@/server/engine/core-functions";
const { board, load, MARINE, CSF } = F;
const MANIFESTO = Cards.upgrades.sec.nemiksManifesto; // +1/+1
const KARIS = Cards.units.lof.karis;                  // not a Rebel

// SEC_156 Nemik's Manifesto: "Attached unit gains the Rebel trait and: 'When Defeated: Deal 1 damage to each enemy
// base for each other friendly Rebel unit.'"
describe("SEC_156 Nemik's Manifesto", () => {
  it("the attached unit is a Rebel", () => {
    const g = load(board().WithGroundUnitForPlayer(1, KARIS).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(MANIFESTO, 1)]).Build());
    const k = g.state.player1.groundArena[0];
    expect(TraitContains(k.cardId, "Rebel", 1, k.playId)).toBe(true);
  });

  it("When Defeated: 1 damage to the enemy base per other friendly Rebel", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, KARIS, true, 3).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(MANIFESTO, 1)])
      .WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player1.groundArena).toHaveLength(2);
    expect(g.state.player2.base.damage).toBe(10 + 2);
  });
});
