import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

// Captives (CR 8.33 / 34.4): a captured card is held facedown under the guarding unit. When that
// unit LEAVES PLAY — by any means, not only by being defeated — the captive is rescued and returns
// to play under its OWNER's control.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 16);
}

/** A captive record held under a guard: owned/controlled by `owner` before capture. */
function captive(cardId: string, owner: 1 | 2, playId = "77") {
  return {
    cardId, playId, owner, controller: owner,
    ready: false, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false,
  };
}

describe("captive release when the guarding unit leaves play", () => {
  it("rescues the captive when the guard is defeated in combat", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // 3 power attacker
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)     // guard 3/3
      .Build();
    state.player2.groundArena[0].captives = [captive(Cards.units.sor.battlefieldMarine, 1) as never];
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const rescued = g.state.player1.groundArena.find(u => u.playId === "77")!;
    expect(rescued).toBeDefined();
    expect(rescued.controller).toBe(1);
    expect(rescued.ready).toBe(false); // returns exhausted
  });

  it("rescues the captive when the guard is BOUNCED to hand", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.events.sor.waylay)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // the guard, bounced below
      .Build();
    state.player1.groundArena[0].captives = [captive(Cards.units.sor.consularSecurityForce, 2) as never];
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // Waylay the guard back to hand

    expect(g.state.player1.groundArena).toHaveLength(0);
    const rescued = g.state.player2.groundArena.find(u => u.playId === "77")!;
    expect(rescued).toBeDefined(); // the captive must not vanish with its guard
    expect(rescued.controller).toBe(2);
  });

  it("returns the captive to its OWNER, not to whoever captured it", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // P2 guard
      .Build();
    // A P1-owned captive whose stored controller wrongly points at the captor (P2).
    const stale = captive(Cards.units.sor.battlefieldMarine, 1);
    stale.controller = 2;
    state.player2.groundArena[0].captives = [stale as never];
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.some(u => u.playId === "77")).toBe(false);
    const rescued = g.state.player1.groundArena.find(u => u.playId === "77")!;
    expect(rescued).toBeDefined();
    expect(rescued.controller).toBe(1); // control always reverts to the owner
  });

  it("does NOT free captives when the guard merely changes controller", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.events.ash.rehabilitation) // take control of a unit
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    state.player2.groundArena[0].captives = [captive(Cards.units.sor.consularSecurityForce, 1) as never];
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // P1 takes control of the guard

    // The guard is still in play, so its captive stays captive.
    const guard = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    expect(guard.captives).toHaveLength(1);
    expect(g.state.player1.groundArena.some(u => u.playId === "77")).toBe(false);
  });

  it("rescues a SPACE captive into the space arena", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    state.player2.groundArena[0].captives = [captive(Cards.units.lof.hyperspaceWayfarer, 1) as never];
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.spaceArena.find(u => u.playId === "77")).toBeDefined();
  });

  it("rescues the captive exactly once (not duplicated by overlapping paths)", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    state.player2.groundArena[0].captives = [captive(Cards.units.sor.battlefieldMarine, 1) as never];
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena.filter(u => u.playId === "77")).toHaveLength(1);
  });
});
