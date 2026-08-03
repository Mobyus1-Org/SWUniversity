import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_197 Lando Calrissian (Responsible Businessman) — 2/4 Ground (Cunning), cost 3
// "Saboteur. When Played: Return up to 2 friendly resources to their owners' hands."

describe("SOR_197 Lando Calrissian", () => {
  it("returns up to 2 resources to hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.landoCalrissianUnit)
      .Build();
    g.loadNewState(state);

    const resources = state.player1.resources;
    const r1PlayId = resources[0].playId;
    const r2PlayId = resources[1].playId;

    await g.playCardFromHandAsync(1, 0);
    const handBefore = g.state.player1.hand.length;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [r1PlayId, r2PlayId] });

    expect(g.state.player1.hand.length).toBe(handBefore + 2);
    expect(g.state.player1.resources.some(r => r.playId === r1PlayId)).toBe(false);
    expect(g.state.player1.resources.some(r => r.playId === r2PlayId)).toBe(false);
  });

  // Same rule as SHD_009 Hunter: resource readiness is fungible in paper, so returning a READY
  // resource must not cost an available one while an exhausted resource can be given up instead.
  it("returning READY resources does not reduce the available resource count", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.units.sor.landoCalrissianUnit)
      .Build();
    // Lando costs 6, so start with 8 ready / 4 exhausted — after paying him there are still
    // 2 ready resources to return AND exhausted ones available to trade for them.
    state.player1.resources.forEach((r, i) => { r.ready = i < 8; });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;
    const readyIds = g.state.player1.resources.filter(r => r.ready).slice(0, 2).map(r => r.playId);
    expect(readyIds.length).toBe(2); // the fixture must actually offer two ready resources

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: readyIds });

    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyBefore);
  });

  // "Return up to 2 friendly resources to their OWNERS' hands" — a resource you control but do
  // not own (LAW_159 Expendable Mercenary today, DJ SHD_213 once he exists) goes back to the
  // player who owns it, not to the player returning it.
  it("returns a stolen resource to its OWNER's hand, not the controller's", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.units.sor.landoCalrissianUnit)
      .Build();
    // One of P1's resources is owned by P2 — the shape LAW_159 produces.
    const stolen = state.player1.resources[0];
    stolen.cardId = Cards.units.sor.echoBaseDefender;
    stolen.owner = 2;
    stolen.stolen = true;
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    const p1HandBefore = g.state.player1.hand.length;
    const p2HandBefore = g.state.player2.hand.length;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [stolen.playId] });

    expect(g.state.player2.hand.some(c => c.cardId === Cards.units.sor.echoBaseDefender)).toBe(true);
    expect(g.state.player2.hand.length).toBe(p2HandBefore + 1);
    expect(g.state.player1.hand.length).toBe(p1HandBefore); // never lands in the controller's hand
  });

  it("returns a normally-owned resource to the controller's own hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.units.sor.landoCalrissianUnit)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    const p1HandBefore = g.state.player1.hand.length;
    const p2HandBefore = g.state.player2.hand.length;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.resources[0].playId] });

    expect(g.state.player1.hand.length).toBe(p1HandBefore + 1);
    expect(g.state.player2.hand.length).toBe(p2HandBefore);
  });

  it("returns 0 resources when empty selection is chosen", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.landoCalrissianUnit)
      .Build();
    g.loadNewState(state);

    const resourcesBefore = state.player1.resources.length;

    await g.playCardFromHandAsync(1, 0);
    const handBefore = g.state.player1.hand.length;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player1.resources.length).toBe(resourcesBefore);
    expect(g.state.player1.hand.length).toBe(handBefore);
  });

  it("does nothing when no resources are available", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.landoCalrissianUnit)
      .Build();
    g.loadNewState(state);

    // After playing cost-3 card with 3 resources, no resources remain
    state.player1.resources = [];

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
