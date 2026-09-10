import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameState } from "@/lib/engine/game";
import { PlayerId } from "@/lib/engine/core-models";
import { Cards } from "../../card-helpers";

// SHD_076 Unexpected Escape (Event, cost 1, Vigilance)
//   "Exhaust a unit. You may rescue a captured card guarded by that unit."
//
// The rescue is limited to THAT unit's captives, and it's a "may": even a lone captive is offered
// (so it can be declined), and declining leaves the exhaust in place.

const EVENT = Cards.events.shd.unexpectedEscape;
const MARINE = Cards.units.sor.battlefieldMarine;
const WAMPA = Cards.units.sor.wampa;

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

function captive(cardId: string, playId: string, owner: PlayerId) {
  return { cardId, playId, owner, controller: owner, ready: false, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false };
}

function guarding(state: GameState, captorPlayer: PlayerId, i: number, ...caps: ReturnType<typeof captive>[]) {
  (captorPlayer === 1 ? state.player1 : state.player2).groundArena[i].captives = caps;
}

describe("SHD_076 Unexpected Escape", () => {
  it("exhausts the chosen unit and may rescue its single captive", async () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(2, MARINE).Build();
    guarding(state, 2, 0, captive(WAMPA, "cap-a", 1));
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena[0].ready).toBe(false);

    // Even a lone captive is OFFERED, not auto-rescued.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseYesAsync(1);

    expect(g.state.player2.groundArena[0].captives).toHaveLength(0);
    const rescued = g.state.player1.groundArena.find(u => u.playId === "cap-a");
    expect(rescued).toBeDefined();
    expect(rescued?.ready).toBe(false);
  });

  it("declining the rescue keeps the unit exhausted and the captive held", async () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(2, MARINE).Build();
    guarding(state, 2, 0, captive(WAMPA, "cap-a", 1));
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(g.state.player2.groundArena[0].captives).toHaveLength(1);
    expect(g.state.player1.groundArena).toHaveLength(0);
  });

  it("with several captives, the player picks which ONE is rescued", async () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(2, MARINE).Build();
    guarding(state, 2, 0, captive(WAMPA, "cap-a", 1), captive(MARINE, "cap-b", 1));
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseOptionAsync(1, "cap-b");

    expect(g.state.player2.groundArena[0].captives.map(c => c.playId)).toEqual(["cap-a"]);
    expect(g.state.player1.groundArena.map(u => u.playId)).toEqual(["cap-b"]);
  });

  it("only THAT unit's captives are offered — not captives held elsewhere", async () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, MARINE).Build();
    guarding(state, 2, 0, captive(WAMPA, "cap-a", 1), captive(MARINE, "cap-b", 1));
    guarding(state, 2, 1, captive(WAMPA, "cap-elsewhere", 1));
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);

    const res = g.lastDispatchResponse?.resolutionNeeded as { options?: string[] };
    expect([...(res.options ?? [])].sort()).toEqual(["cap-a", "cap-b"]);
  });

  it("a unit guarding nothing is just exhausted — no rescue prompt", async () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, MARINE).Build();
    guarding(state, 2, 1, captive(WAMPA, "cap-elsewhere", 1)); // someone else's captive
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena[1].captives).toHaveLength(1);
  });

  it("any unit may be exhausted — including a friendly one", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player1.groundArena[0].playId);

    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});
