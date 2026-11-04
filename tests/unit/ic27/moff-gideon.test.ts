import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { playCost } from "@/server/engine/card-playability";

// IC27_022 Moff Gideon — Cold Calling (3/6 Ground, cost 5, Vigilance/Villainy)
//   "If a friendly unit was defeated this phase, this unit costs 2 resources less to play."

const GIDEON = Cards.units.ic27.moffGideon;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const WAMPA = Cards.units.sor.wampa;              // 4/5

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.lukeSkywalker)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, GIDEON);
}

describe("IC27_022 Moff Gideon — Cold Calling", () => {
  it("costs 2 less once a friendly unit was defeated this phase, and is charged that", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build());
    const full = playCost(g.state, 1, GIDEON);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // the Wampa's 4 defeats the Marine
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(playCost(g.state, 1, GIDEON)).toBe(full - 2);

    await g.dispatchAsync(2, "pass-action", {});
    const before = readyResources(g);
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([GIDEON]);
    expect(before - readyResources(g)).toBe(full - 2);
  });

  it("control: an ENEMY unit defeated this phase gives no discount", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, WAMPA).WithGroundUnitForPlayer(2, MARINE).Build());
    const full = playCost(g.state, 1, GIDEON);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // the Marine dies, the Wampa survives

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(playCost(g.state, 1, GIDEON)).toBe(full);
  });

  it("control: the discount is Gideon's own — other units cost full", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build());
    const fullWampa = playCost(g.state, 1, WAMPA);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(playCost(g.state, 1, WAMPA)).toBe(fullWampa);
  });
});
