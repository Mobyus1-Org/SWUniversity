import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_181 Cloud-Rider Veteran (1/4 Ground, cost 2, Aggression/Heroism) —
//   "On Attack: Deal 2 damage to a base."
// Same text as IBH_053 Darth Vader's deployed side. Mandatory; either base.

const VETERAN = Cards.units.law.cloudRiderVeteran;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithGroundUnitForPlayer(1, VETERAN)
    .WithActivePlayer(1);
}

describe("LAW_181 Cloud-Rider Veteran", () => {
  it("deals 2 to the enemy base on top of combat damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // attack the enemy base
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.chooseBaseAsync(1, 2); // On Attack: 2 to the enemy base

    expect(g.state.player2.base.damage).toBe(3); // 2 (On Attack) + 1 (combat)
  });

  it("may pick its own base instead (\"a base\")", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("fires when attacking a unit too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });
});
