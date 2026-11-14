import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CardIsPlayable } from "@/server/engine/card-playability";

// HMW_125 The Marauder — A New Home (5/7 Space, cost 7, Command/Heroism) —
//   "While playing this unit, you may choose any number of friendly units. Deal 1 damage to each of
//    them. For each unit chosen this way, this unit costs 1 resource less."
//
// Part of paying for it: the choice is made as it is played, the damage lands, and the cost drops
// by one per unit chosen. With too few resources to pay in full, enough friendly units make it
// affordable. A unit the damage kills is still a unit chosen.

const MARAUDER = Cards.units.hmw.theMarauder;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const TOKEN = Cards.units.token.xWing;            // 2/2 space token

function setup(resources: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithCardInHandForPlayer(1, MARAUDER)
    .WithActivePlayer(1);
}

const spent = (g: GameTestAdapter) => g.state.player1.resources.filter(r => !r.ready).length;

describe("HMW_125 The Marauder", () => {
  it("each friendly unit chosen takes 1 damage and takes 1 off the cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(10).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: g.state.player1.groundArena.map(u => u.playId) });

    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([MARAUDER]);
    expect(g.state.player1.groundArena.map(u => u.damage)).toEqual([1, 1]);
    expect(spent(g)).toBe(7 - 2);
  });

  it("choosing none pays full price and damages nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(10).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player1.spaceArena.length).toBe(1);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(spent(g)).toBe(7);
  });

  it("is playable short of its cost when enough friendly units can be chosen", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(5).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).Build());
    expect(CardIsPlayable(g.state, 1, MARAUDER)).toBe(true);

    const short = new GameTestAdapter();
    short.loadNewState(setup(5).WithGroundUnitForPlayer(1, MARINE).Build()); // 5 + 1 < 7
    expect(CardIsPlayable(short.state, 1, MARAUDER)).toBe(false);
  });

  it("short of its cost, choosing too few units is refused", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(5).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    expect(g.state.player1.spaceArena.length).toBe(0); // 5 resources can't cover 7 − 1

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: g.state.player1.groundArena.map(u => u.playId) });
    expect(g.state.player1.spaceArena.length).toBe(1);
    expect(spent(g)).toBe(5);
  });

  it("a friendly unit the damage defeats still counted toward the discount", async () => {
    const g = new GameTestAdapter();
    const state = setup(10).WithSpaceUnitForPlayer(1, TOKEN).Build();
    state.player1.spaceArena[0].damage = 1; // a 2/2 with 1 damage
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.spaceArena[0].playId] });

    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([MARAUDER]);
    expect(spent(g)).toBe(6);
  });

  it("enemy units are not offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(10).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.spaceArena.length).toBe(0); // refused
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
