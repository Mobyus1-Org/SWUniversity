import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_160 Tantive IV — For Alderaan (3/5 Space, cost 5, Cunning/Heroism, Rebel)
//   "Each other friendly Rebel unit gains Raid 2 and Saboteur."

const TANTIVE = Cards.units.ic27.tantiveIV;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Rebel
const XWING = Cards.units.sor.allianceXWing;      // 2/3 Space Rebel
const SWOOP = Cards.units.sor.swoopRacer;         // 4/3, Fringe — not a Rebel
const SENTINEL = Cards.units.sor.cellBlockGuard;  // 3/3, Sentinel

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

const targets = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] } | undefined)?.fromPlayIds ?? [];

describe("IC27_160 Tantive IV — Raid 2", () => {
  it("another friendly Rebel ground unit attacks for +2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, TANTIVE).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5);
  });

  it("covers the space arena too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, TANTIVE).WithSpaceUnitForPlayer(1, XWING).Build());

    await g.attackWithSpaceUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4);
  });

  it("Tantive IV itself — a Rebel — gets nothing ('other')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, TANTIVE).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("a non-Rebel friendly unit gets nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, TANTIVE).WithGroundUnitForPlayer(1, SWOOP).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4);
  });

  it("an ENEMY Rebel gets nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, TANTIVE).WithGroundUnitForPlayer(2, MARINE).WithActivePlayer(2).Build());

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);

    expect(g.state.player1.base.damage).toBe(3);
  });

  it("a blanked Tantive IV grants nothing", async () => {
    const g = new GameTestAdapter();
    const state = board().WithSpaceUnitForPlayer(1, TANTIVE).WithGroundUnitForPlayer(1, MARINE).Build();
    state.currentEffects.push({
      cardId: Cards.events.sor.forceLightning, duration: "Phase", affectedPlayer: 1,
      targetPlayId: state.player1.spaceArena[0].playId,
    });
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });
});

describe("IC27_160 Tantive IV — Saboteur", () => {
  it("another friendly Rebel ignores Sentinel", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithSpaceUnitForPlayer(1, TANTIVE).WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, SENTINEL).WithGroundUnitForPlayer(2, SWOOP).Build());

    await g.attackWithGroundUnitAsync(1, 0);

    expect(targets(g)).toContain(g.state.player2.groundArena[1].playId);
  });

  it("control: without Tantive IV the Sentinel is forced", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, SENTINEL).WithGroundUnitForPlayer(2, SWOOP).Build());

    await g.attackWithGroundUnitAsync(1, 0);

    expect(targets(g)).toEqual([g.state.player2.groundArena[0].playId]);
  });
});
