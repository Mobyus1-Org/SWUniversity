import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL... no — IBH_006 Rebellion Y-Wing (2/3 Space, cost 3, Rebel Vehicle Fighter)
// "On Attack: Deal 1 damage to a base."

function setup(cardId: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithSpaceUnitForPlayer(1, cardId);
}

describe("IBH_006 Rebellion Y-Wing — On Attack: Deal 1 damage to a base", () => {
  it("deals 1 to the chosen base, on top of its combat damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.units.ibh.rebellionYWing).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // attack the enemy base
    await g.chooseBaseAsync(1, 2); // On Attack: deal 1 to the enemy base

    // 1 (On Attack) + 2 (combat power) = 3.
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("can send the 1 damage to your own base ('a base' — either one)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.units.ibh.rebellionYWing).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // attack enemy base
    await g.chooseBaseAsync(1, 1); // On Attack: deal 1 to own base

    expect(g.state.player1.base.damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(2); // only combat damage
  });

  it("alt printing IBH_024 also fires the On Attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.units.ibh.rebellionYWingB).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });
});
