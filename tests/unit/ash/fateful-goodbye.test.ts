import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { ADVANTAGE_TOKEN } from "@/server/engine/token-helpers";
import { Cards } from "../../card-helpers";

// ASH_211 Fateful Goodbye (Event, cost 2)
// "If a friendly unit left play this phase, distribute 3 Advantage tokens among friendly units.
//  If a friendly leader unit left play this phase, distribute 5 Advantage tokens instead."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 16);
}

function advantageCount(unit: { upgrades: { cardId: string }[] }) {
  return unit.upgrades.filter(u => u.cardId === ADVANTAGE_TOKEN).length;
}

describe("ASH_211 Fateful Goodbye", () => {
  it("distributes 3 Advantage tokens after a friendly unit left play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithActivePlayer(2)
        .WithCardInHandForPlayer(1, Cards.events.ash.fatefulGoodbye)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)     // dies below
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // survives to receive
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    // Player 2 kills the Marine (3 power vs 3 HP), putting a friendly unit in cardsLeftPlayThisPhase.
    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.groundArena).toHaveLength(1);

    await g.playCardFromHandAsync(1, 0);
    const survivor = g.state.player1.groundArena[0];
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: survivor.playId, damage: 3 }],
    });

    expect(advantageCount(g.state.player1.groundArena[0])).toBe(3);
  });

  it("distributes 5 instead when a friendly LEADER unit left play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithActivePlayer(2)
        .MyLeader(Cards.leaders.ash.ahsokaTano, true, true)
        .WithCardInHandForPlayer(1, Cards.events.ash.fatefulGoodbye)
        .WithGroundUnitForPlayer(1, Cards.units.ash.ahsokaTano, true, 5) // 5/5 leader unit, 5 damage
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0); // finishes off the leader unit

    await g.playCardFromHandAsync(1, 0);
    const survivor = g.state.player1.groundArena[0];
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: survivor.playId, damage: 5 }],
    });

    expect(advantageCount(g.state.player1.groundArena[0])).toBe(5);
  });

  it("does nothing when no friendly unit left play this phase (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.fatefulGoodbye)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(advantageCount(g.state.player1.groundArena[0])).toBe(0);
  });

  it("ignores an ENEMY unit leaving play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.fatefulGoodbye)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // 3 power
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)     // 3 HP — dies
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena).toHaveLength(0);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(advantageCount(g.state.player1.groundArena[0])).toBe(0);
  });

  it("can split the 3 tokens across several friendly units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithActivePlayer(2)
        .WithCardInHandForPlayer(1, Cards.events.ash.fatefulGoodbye)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithSpaceUnitForPlayer(1, Cards.units.lof.hyperspaceWayfarer)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    await g.playCardFromHandAsync(1, 0);
    const ground = g.state.player1.groundArena[0];
    const space = g.state.player1.spaceArena[0];
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: ground.playId, damage: 1 },
        { playId: space.playId, damage: 2 },
      ],
    });

    expect(advantageCount(g.state.player1.groundArena[0])).toBe(1);
    expect(advantageCount(g.state.player1.spaceArena[0])).toBe(2);
  });

  it("rejects a partial distribution", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithActivePlayer(2)
        .WithCardInHandForPlayer(1, Cards.events.ash.fatefulGoodbye)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    await g.playCardFromHandAsync(1, 0);
    const survivor = g.state.player1.groundArena[0];
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: survivor.playId, damage: 2 }], // only 2 of 3
    });

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
