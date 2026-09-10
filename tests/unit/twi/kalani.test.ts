import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { PlayerId } from "@/lib/engine/core-models";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// TWI_085 Kalani — Analytical General (Unit 5/7 Ground, cost 6, Command/Villainy)
//   "On Attack: You may choose another unit. If you have the initiative, you may choose up to 2
//    other units instead. Give each chosen unit +2/+2 for this phase."

const KALANI = Cards.units.twi.kalani;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3

function setup(initiative: PlayerId) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithInitiativePlayerBeing(initiative)
    .WithGroundUnitForPlayer(1, KALANI)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithGroundUnitForPlayer(2, MARINE);
}

const statsOf = (g: GameTestAdapter, p: 1 | 2, i: number) => {
  const u = Unit.FromInterface((p === 1 ? g.state.player1 : g.state.player2).groundArena[i]);
  return { power: u.CurrentPower(), hp: u.TotalHP() };
};

const offer = (g: GameTestAdapter) =>
  g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[]; maxTargets?: number };

describe("TWI_085 Kalani — Analytical General", () => {
  it("without the initiative: one other unit gets +2/+2 for this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(2).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(offer(g).maxTargets).toBe(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });

    expect(statsOf(g, 1, 1)).toEqual({ power: 5, hp: 5 });
    expect(statsOf(g, 1, 2)).toEqual({ power: 3, hp: 3 });
    expect(g.state.player2.base.damage).toBe(5); // Kalani's own attack resolved after the ability
  });

  it("with the initiative: up to 2 other units get +2/+2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(1).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(offer(g).maxTargets).toBe(2);
    await g.dispatchAsync(1, "choose-target", {
      targetPlayIds: [g.state.player1.groundArena[1].playId, g.state.player1.groundArena[2].playId],
    });

    expect(statsOf(g, 1, 1)).toEqual({ power: 5, hp: 5 });
    expect(statsOf(g, 1, 2)).toEqual({ power: 5, hp: 5 });
  });

  it("without the initiative, a second pick is ignored — the cap is 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(2).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", {
      targetPlayIds: [g.state.player1.groundArena[1].playId, g.state.player1.groundArena[2].playId],
    });

    const buffed = [statsOf(g, 1, 1), statsOf(g, 1, 2)].filter(s => s.power === 5);
    expect(buffed).toHaveLength(1);
  });

  it("offers any OTHER unit, either side — never Kalani herself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(1).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const ids = offer(g).fromPlayIds ?? [];
    expect(ids).not.toContain(g.state.player1.groundArena[0].playId);
    expect(ids).toContain(g.state.player2.groundArena[0].playId);
    expect(ids).toHaveLength(3);
  });

  it("choosing nothing is allowed — no buff, and the attack still resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(1).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(statsOf(g, 1, 1)).toEqual({ power: 3, hp: 3 });
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("the buff lasts for the phase, not just the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(2).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });

    expect(g.state.currentEffects.some(e => e.duration === "Phase")).toBe(true);
  });
});
