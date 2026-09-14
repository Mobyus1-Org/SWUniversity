import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IBH_015 / IBH_028 / IBH_051 Tauntaun Mount (Unit 2/2 Ground, cost 2, Command) — three printings
//   "When Defeated: Heal 2 damage from your base."

const PRINTINGS = [
  Cards.units.ibh.tauntaunMount,
  Cards.units.ibh.tauntaunMount2,
  Cards.units.ibh.tauntaunMount3,
];

function setup(mount: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 8)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP, 8)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(2)
    .WithGroundUnitForPlayer(1, mount)
    .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce); // 3 power — kills the 2/2
}

describe("Tauntaun Mount", () => {
  for (const mount of PRINTINGS) {
    it(`${mount}: heals 2 damage from its controller's base when defeated`, async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(mount).Build());

      await g.attackWithGroundUnitAsync(2, 0);
      await g.chooseGroundUnitAsync(1, 0);

      expect(g.state.player1.groundArena).toHaveLength(0);
      expect(g.state.player1.base.damage).toBe(6);
      expect(g.state.player2.base.damage).toBe(8);
    });
  }

  it("heals no more than the damage present", async () => {
    const g = new GameTestAdapter();
    const state = setup(Cards.units.ibh.tauntaunMount).Build();
    state.player1.base.damage = 1;
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(0);
  });
});
