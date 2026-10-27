import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_156 Arena Acklay — Screaming Predator (5/6 Ground, cost 5, Aggression/Villainy, Creature, unique)
//   "When this unit is dealt damage and survives: Deal 2 damage to each enemy base."
//
// "Dealt damage" is damage that actually landed — a Shield that swallows the instance means none
// was dealt. "Survives" is read once the damage is on: a hit that defeats the Acklay is no trigger.
// Ability damage and combat damage both count, whether the Acklay attacked or was attacked.
const ACKLAY = Cards.units.hmw.arenaAcklay;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Ground, no abilities
const OPEN_FIRE = Cards.events.sor.openFire;      // "Deal 4 damage to a unit."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 12)
    .FillResourcesForPlayer(2, MARINE, 12);
}
const unitIn = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  (p === 1 ? g.state.player1 : g.state.player2).groundArena.find(u => u.cardId === cardId);
const target = (g: GameTestAdapter, from: 1 | 2, playId: string) =>
  g.dispatchAsync(from, "choose-target", { targetPlayIds: [playId] });

describe("HMW_156 Arena Acklay — dealt damage and survives: 2 to each enemy base", () => {
  it("ability damage from an enemy event that it survives deals 2 to the enemy base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, ACKLAY)
        .WithCardInHandForPlayer(2, OPEN_FIRE)
        .WithActivePlayer(2)
        .Build(),
    );
    await g.playCardFromHandAsync(2, 0);
    await target(g, 2, unitIn(g, 1, ACKLAY)!.playId);

    expect(unitIn(g, 1, ACKLAY)!.damage).toBe(4);
    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("being attacked and surviving deals 2 to the enemy base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, ACKLAY)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithActivePlayer(2)
        .Build(),
    );
    await g.attackWithGroundUnitAsync(2, 0);
    await target(g, 2, unitIn(g, 1, ACKLAY)!.playId);

    expect(unitIn(g, 1, ACKLAY)!.damage).toBe(3);
    expect(unitIn(g, 2, MARINE)).toBeUndefined(); // took 5
    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("attacking and surviving the counter-damage deals 2 to the enemy base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, ACKLAY)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithActivePlayer(1)
        .Build(),
    );
    await g.attackWithGroundUnitAsync(1, 0);
    await target(g, 1, unitIn(g, 2, MARINE)!.playId);

    expect(unitIn(g, 1, ACKLAY)!.damage).toBe(3);
    expect(unitIn(g, 2, MARINE)).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(2); // no Overwhelm — only the reaction reaches the base
  });

  it("attacking a base deals no damage to the Acklay, so nothing extra", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, ACKLAY).WithActivePlayer(1).Build());
    await g.attackWithGroundUnitAsync(1, 0);
    if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5);
  });

  it("damage that defeats it is no trigger", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, ACKLAY, true, 2) // 4 HP left — Open Fire kills it
        .WithCardInHandForPlayer(2, OPEN_FIRE)
        .WithActivePlayer(2)
        .Build(),
    );
    await g.playCardFromHandAsync(2, 0);
    await target(g, 2, unitIn(g, 1, ACKLAY)!.playId);

    expect(unitIn(g, 1, ACKLAY)).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("damage absorbed by a Shield was never dealt — no trigger", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, ACKLAY)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 1)])
        .WithCardInHandForPlayer(2, OPEN_FIRE)
        .WithActivePlayer(2)
        .Build(),
    );
    await g.playCardFromHandAsync(2, 0);
    await target(g, 2, unitIn(g, 1, ACKLAY)!.playId);

    expect(unitIn(g, 1, ACKLAY)!.damage).toBe(0);
    expect(unitIn(g, 1, ACKLAY)!.upgrades).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("damage to a different friendly unit is no trigger (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, ACKLAY)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // 3/7
        .WithCardInHandForPlayer(2, OPEN_FIRE)
        .WithActivePlayer(2)
        .Build(),
    );
    await g.playCardFromHandAsync(2, 0);
    await target(g, 2, unitIn(g, 1, Cards.units.sor.consularSecurityForce)!.playId);

    expect(unitIn(g, 1, Cards.units.sor.consularSecurityForce)!.damage).toBe(4);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("an Acklay that lost its abilities (Imprisoned) does not react", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, ACKLAY)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(Cards.upgrades.shd.imprisoned, 2)])
        .WithCardInHandForPlayer(2, OPEN_FIRE)
        .WithActivePlayer(2)
        .Build(),
    );
    await g.playCardFromHandAsync(2, 0);
    await target(g, 2, unitIn(g, 1, ACKLAY)!.playId);

    expect(unitIn(g, 1, ACKLAY)!.damage).toBe(4);
    expect(g.state.player2.base.damage).toBe(0);
  });
});
