import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XP, SHIELD, count } = F;
const SPAWN = Cards.units.lof.drengirSpawn;        // 3/3, Overwhelm
const DROID = Cards.units.token.battleDroid;       // token, cost 0

// LOF_086 Drengir Spawn: "When this unit attacks and defeats a unit: Give a number of Experience tokens to this
// unit equal to the defeated unit's cost."
describe("LOF_086 Drengir Spawn", () => {
  const setup = (victim: string) => load(board().WithGroundUnitForPlayer(1, SPAWN).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(SHIELD, 1)]).WithGroundUnitForPlayer(2, victim).Build());

  it("defeating a 2-cost unit gives 2 Experience tokens", async () => {
    const g = setup(MARINE);
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(2);
  });

  it("a token (cost 0) gives none", async () => {
    const g = setup(DROID);
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(0);
  });

  it("attacking a base gives none", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, SPAWN).Build());
    await F.attackBase(g);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(0);
  });
});
