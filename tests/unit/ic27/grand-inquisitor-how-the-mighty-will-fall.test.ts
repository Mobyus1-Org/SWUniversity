import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_103 Grand Inquisitor — How the Mighty Will Fall (3/6 Ground, cost 4, Aggression/Villainy)
//   "While this unit is damaged, he gains Raid 3 and Saboteur."

const GI = Cards.units.ic27.grandInquisitor;
const SENTINEL = Cards.units.sor.cellBlockGuard; // 3/3, Sentinel
const SWOOP = Cards.units.sor.swoopRacer;        // 4/3, no text

function board(damage: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, GI, true, damage);
}

const targets = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] } | undefined)?.fromPlayIds ?? [];

describe("IC27_103 Grand Inquisitor — Raid 3 while damaged", () => {
  it("undamaged, he attacks the base for his printed 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(0).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("damaged, he attacks the base for 3 + Raid 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(1).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(6);
  });

  it("a damaged DEFENDER gets no Raid — Raid only applies while attacking", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(1).WithGroundUnitForPlayer(2, SWOOP).WithActivePlayer(2).Build());

    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0); // Swoop Racer (3 HP) took his printed 3
  });
});

describe("IC27_103 Grand Inquisitor — Saboteur while damaged", () => {
  it("undamaged, an enemy Sentinel is the only unit he may attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(0).WithGroundUnitForPlayer(2, SENTINEL).WithGroundUnitForPlayer(2, SWOOP).Build());

    await g.attackWithGroundUnitAsync(1, 0);

    expect(targets(g)).toEqual([g.state.player2.groundArena[0].playId]);
  });

  it("damaged, he ignores Sentinel and may attack the other unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(1).WithGroundUnitForPlayer(2, SENTINEL).WithGroundUnitForPlayer(2, SWOOP).Build());

    await g.attackWithGroundUnitAsync(1, 0);

    expect(targets(g)).toContain(g.state.player2.groundArena[1].playId);
  });

  it("damaged, he defeats the defender's Shield before dealing damage", async () => {
    const g = new GameTestAdapter();
    const state = board(1).WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce).Build();
    state.player2.groundArena[0].upgrades = [{ cardId: Cards.upgrades.token.shield, playId: "sh", owner: 2, controller: 2 }];
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
    expect(g.state.player2.groundArena[0].damage).toBe(6); // 3 + Raid 3 — the Shield took nothing
  });

  it("losing all abilities turns both off", async () => {
    const g = new GameTestAdapter();
    const state = board(1).Build();
    state.currentEffects.push({
      cardId: Cards.events.sor.forceLightning, duration: "Phase", affectedPlayer: 1,
      targetPlayId: state.player1.groundArena[0].playId,
    });
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });
});
