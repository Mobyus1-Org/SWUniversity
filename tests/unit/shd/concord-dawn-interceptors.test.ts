import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// SHD_042 Concord Dawn Interceptors (1/4 Space, cost 3)
// "Sentinel"
// "This unit gets +2/+0 while defending."

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithSpaceUnitForPlayer(1, Cards.units.shd.concordDawnInterceptors)
    // System Patrol Craft is 3/4.
    .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft);
}

describe("SHD_042 Concord Dawn Interceptors", () => {
  it("has Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    const u = g.state.player1.spaceArena[0];
    expect(HasSentinel(u.cardId, u.playId, 1)).toBe(true);
  });

  it("deals 3 counter-damage while defending (1 + 2), not its printed 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithActivePlayer(2).Build());

    // Player 2's System Patrol Craft attacks the Interceptors.
    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    // Defender deals 1 + 2 = 3 counter-damage to the 3/4 attacker.
    expect(g.state.player2.spaceArena[0].damage).toBe(3);
    // Attacker dealt its 3 to the 4 HP Interceptors.
    expect(g.state.player1.spaceArena[0].damage).toBe(3);
  });

  it("gets no bonus while attacking — only while defending", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    // Attacking, it deals only its printed 1 power.
    expect(g.state.player2.spaceArena[0].damage).toBe(1);
  });

  it("attacking a base deals its printed power (no defending bonus)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("its base power is unchanged outside combat", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    const u = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(u.CurrentPower()).toBe(1);
    expect(u.TotalHP()).toBe(4);
  });
});
