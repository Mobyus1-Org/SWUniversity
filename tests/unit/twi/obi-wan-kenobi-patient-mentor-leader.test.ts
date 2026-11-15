import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, CSF } = F;

// TWI_003 Obi-Wan Kenobi — Patient Mentor (leader): Action [Exhaust]: heal 1 damage from a unit.
// Deployed: Sentinel; "On Attack: Heal 1 damage from a unit. If you do, deal 1 damage to a different unit."
describe("TWI_003 Obi-Wan Kenobi", () => {
  it("Action: heals 1 from a unit, exhausting Obi-Wan", async () => {
    const g = load(board(Cards.leaders.twi.obiWanKenobi).WithGroundUnitForPlayer(1, CSF, true, 2).Build());
    await g.useLeaderAbilityAsync(1);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player1.groundArena[0].damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });
  it("deployed On Attack: heal 1, then 1 damage to a different unit", async () => {
    const g = load(board(Cards.leaders.twi.obiWanKenobi).MyLeader(Cards.leaders.twi.obiWanKenobi, true, true)
      .WithGroundUnitForPlayer(1, Cards.leaders.twi.obiWanKenobi).WithGroundUnitForPlayer(1, CSF, true, 2).WithGroundUnitForPlayer(2, CSF).Build());
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await pick(g, [g.state.player1.groundArena[1].playId]);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player1.groundArena[1].damage).toBe(1);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });
});
