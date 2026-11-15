import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const SABER = Cards.upgrades.lof.corruptedSaber; // +2/+1
const KARIS = Cards.units.lof.karis;             // 2/4 Force

// LOF_187 Corrupted Saber: "If attached unit is a Force unit, it gains: 'On Attack: The defender gets –2/–0 for this attack.'"
describe("LOF_187 Corrupted Saber", () => {
  it("a Force unit's defender gets –2/–0", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, KARIS).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(SABER, 1)]).WithGroundUnitForPlayer(2, CSF).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player1.groundArena[0].damage).toBe(1);
  });

  it("a non-Force unit gains nothing", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(SABER, 1)]).WithGroundUnitForPlayer(2, CSF).Build());
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });
});
