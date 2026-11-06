import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_004 Aurra Sing — Assassin (Leader, Vigilance/Villainy; unit side 3/7 Ground)
//   Front: "Action [Exhaust]: Defeat a non-leader unit with 1 or less remaining HP.
//           Epic Action: If you control 7 or more resources, deploy this leader."
//   Unit:  "When Deployed: You may defeat a non-leader unit with 5 or less remaining HP."
// "A non-leader unit" — either player's.

const AURRA = Cards.leaders.law.aurraSing;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const WAMPA = Cards.units.sor.wampa;              // 4/5

function board(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(AURRA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

const targets = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? res.fromPlayIds ?? [] : [];
};

describe("LAW_004 Aurra Sing — leader Action", () => {
  it("defeats an enemy non-leader unit with 1 or less remaining HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE, true, 2).WithGroundUnitForPlayer(2, WAMPA, true, 3).Build());
    const hurt = g.state.player2.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    expect(targets(g)).toEqual([hurt]); // the Wampa has 2 remaining
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [hurt] });

    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([WAMPA]);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("may defeat a friendly unit too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE, true, 2).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(g.state.player1.groundArena).toHaveLength(0);
  });

  it("with no unit at 1 or less remaining HP it just exhausts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE, true, 1).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });
});

describe("LAW_004 Aurra Sing — When Deployed", () => {
  it("may defeat a non-leader unit with 5 or less remaining HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA).Build());

    await g.deployLeaderAsync(1);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("can be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA).Build());

    await g.deployLeaderAsync(1);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("does not offer units above 5 remaining HP, nor Aurra herself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, Cards.units.ash.dinosaurTurtle).Build()); // 7/7

    await g.deployLeaderAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.leader.deployed).toBe(true);
  });

  it("needs 7 resources to deploy", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBeFalsy();
  });
});
