import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_161 is a reprint of IBH_010: same text and stats, so this mirrors IBH_010's tests.

// IC27_161 Han Solo (4/6 Ground, cost 6, Rebel)
// "Raid 2" + "On Attack: The defender gets -2/-0 for this attack."

function setup(attackerId: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, attackerId)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine); // 3/3 defender
}

describe("IC27_161 Han Solo — On Attack: defender -2/-0 (+ Raid 2)", () => {
  it("weakens the defender by 2 power, so its counter-damage drops to 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.units.ic27.hanSolo).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack the 3/3 Marine

    // Han: 4 + Raid 2 = 6 power → the 3-HP Marine is defeated.
    expect(g.state.player2.groundArena).toHaveLength(0);
    // Marine's power reduced 3 → 1, so Han takes only 1 counter-damage.
    expect(g.state.player1.groundArena[0].damage).toBe(1);
  });

  it("control: a plain attacker takes the Marine's full 3 counter-damage", async () => {
    const g = new GameTestAdapter();
    // Gamorrean Guards (4/4, no On Attack ability) survives the trade to show the counter.
    g.loadNewState(setup(Cards.units.sor.gamorreanGuards).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(3); // full counter — no debuff
  });

  it("Raid 2: deals 4 + 2 = 6 to a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.units.ic27.hanSolo).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(6);
  });
});
