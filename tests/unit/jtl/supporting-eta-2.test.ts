import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// JTL_160 Supporting Eta-2 (2/2 Space, cost 2, Republic Vehicle Fighter, Aggression)
//   "On Attack: You may give a ground unit +2/+0 for this phase."
// Any ground unit — friendly or enemy.

const ETA = Cards.units.jtl.supportingEta2;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Ground

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithSpaceUnitForPlayer(1, ETA)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithGroundUnitForPlayer(2, MARINE);
}

const power = (u: Parameters<typeof Unit.FromInterface>[0]) => Unit.FromInterface(u).CurrentPower();

describe("JTL_160 Supporting Eta-2", () => {
  it("gives a friendly ground unit +2/+0 for the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player2.base.damage).toBe(2); // Eta-2's own attack is unchanged
    expect(power(g.state.player1.groundArena[0])).toBe(5);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("offers any ground unit, including an enemy's — but no space unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toEqual(expect.arrayContaining([
      g.state.player1.groundArena[0].playId,
      g.state.player2.groundArena[0].playId,
    ]));
    expect(res.fromPlayIds).not.toContain(g.state.player1.spaceArena[0].playId);

    await g.chooseGroundUnitAsync(2, 0);
    expect(power(g.state.player2.groundArena[0])).toBe(5);
  });

  it("declining gives nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(power(g.state.player1.groundArena[0])).toBe(3);
    expect(power(g.state.player2.groundArena[0])).toBe(3);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("no ground units → no prompt, the attack just resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .WithSpaceUnitForPlayer(1, ETA)
      .Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
