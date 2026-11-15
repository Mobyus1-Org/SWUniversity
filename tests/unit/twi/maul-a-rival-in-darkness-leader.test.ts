import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, MARINE, GUNGAN } = F;

// TWI_009 Maul — A Rival in Darkness (leader): "Action [Exhaust]: Attack with a unit. It gains Overwhelm for this attack."
describe("TWI_009 Maul", () => {
  it("Action: the chosen unit attacks with Overwhelm", async () => {
    const g = load(board(Cards.leaders.twi.maul).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, GUNGAN).Build());
    await g.useLeaderAbilityAsync(1);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player2.base.damage).toBe(11); // 3 into a 2/2: 1 excess
    expect(g.state.player1.leader.ready).toBe(false);
  });
});
