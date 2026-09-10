import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameState } from "@/lib/engine/game";
import { PlayerId } from "@/lib/engine/core-models";
import { Cards } from "../../card-helpers";

// SHD_180 Detention Block Rescue (Event, cost 3, Aggression)
//   "Deal 3 damage to a unit. If that unit is guarding any captured cards, deal 6 damage instead."

const EVENT = Cards.events.shd.detentionBlockRescue;
const DURABLE = Cards.units.sor.consularSecurityForce; // 3/7 Ground — survives 6
const MARINE = Cards.units.sor.battlefieldMarine;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, EVENT);
}

/** Puts a captive (owned by `owner`) under the unit at `arenaIndex` of `captorPlayer`'s ground arena. */
function giveCaptive(state: GameState, captorPlayer: PlayerId, arenaIndex: number, owner: PlayerId) {
  const captor = (captorPlayer === 1 ? state.player1 : state.player2).groundArena[arenaIndex];
  captor.captives = [{
    cardId: MARINE, playId: "captive-1", owner, controller: owner,
    ready: false, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false,
  }];
}

describe("SHD_180 Detention Block Rescue", () => {
  it("deals 3 damage to a unit that is guarding nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, DURABLE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("deals 6 damage instead to a unit guarding a captured card", async () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(2, DURABLE).Build();
    giveCaptive(state, 2, 0, 1);
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(6);
  });

  it("the 6 is keyed to the TARGET's captives, not to captives anywhere on the board", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(2, DURABLE)
      .WithGroundUnitForPlayer(2, DURABLE)
      .Build();
    giveCaptive(state, 2, 1, 1); // the OTHER unit is the captor
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("may target a friendly unit — 'a unit' is either side", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, DURABLE).WithGroundUnitForPlayer(2, DURABLE).Build());

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player1.groundArena[0].playId);
    expect(res.fromPlayIds).toContain(g.state.player2.groundArena[0].playId);

    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });

  it("6 damage defeats a 4-HP captor, and its captive goes home", async () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(2, Cards.units.shd.discerningVeteran).Build(); // 3/4
    giveCaptive(state, 2, 0, 1);
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena.some(u => u.playId === "captive-1")).toBe(true);
  });
});
