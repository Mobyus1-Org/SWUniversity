import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const DETONATOR = Cards.upgrades.law.thermalDetonator; // +1/+1

// LAW_201 Thermal Detonator: attached unit gains "When Defeated: If this unit was ready, deal 2 damage to each enemy
// ground unit."
describe("LAW_201 Thermal Detonator", () => {
  const setup = (ready: boolean) => load(board().WithGroundUnitForPlayer(1, MARINE, ready, 2).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(DETONATOR, 1)])
    .WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(2, MARINE).WithActivePlayer(2).Build());

  it("defeated while ready: 2 damage to each enemy ground unit", async () => {
    const g = setup(true);
    await g.attackWithGroundUnitAsync(2, 0);
    await F.pick(g, [g.state.player1.groundArena[0].playId], 2);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena.map(u => u.damage)).toEqual([4 + 2, 2]);
  });

  it("defeated while exhausted: nothing", async () => {
    const g = setup(false);
    await g.attackWithGroundUnitAsync(2, 0);
    await F.pick(g, [g.state.player1.groundArena[0].playId], 2);
    expect(g.state.player2.groundArena.map(u => u.damage)).toEqual([4, 0]);
  });
});
