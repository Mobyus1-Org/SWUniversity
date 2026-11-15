import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackBase, pick, prompt, up, CSF } from "./scan-fixtures";

// SHD_171 Covetous Rivals (5/5 Ground): "Grit" / "When Played/On Attack: You may deal 2 damage to a unit
// with a Bounty."
describe("SHD_171 Covetous Rivals", () => {
  it("When Played: 2 damage to a unit with a Bounty", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, CSF).WithUpgradesOnGroundUnitForPlayer(2, 0, [up(Cards.upgrades.shd.deathMark, 1)]).WithCardInHandForPlayer(1, Cards.units.shd.covetousRivals).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });
  it("On Attack: nothing is offered when no unit has a Bounty", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.covetousRivals).WithGroundUnitForPlayer(2, CSF).Build());
    await attackBase(g);
    expect(prompt(g)).toBeNull();
  });
});
