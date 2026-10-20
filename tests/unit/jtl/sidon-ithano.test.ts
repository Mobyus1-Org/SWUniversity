import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { PilotlessEnemyVehiclePlayIds } from "@/server/engine/card-db/upgrade-attach-restrictions";

// JTL_213 Sidon Ithano, The Crimson Corsair — 2/2 Ground, Underworld/Pilot, unique, cost 2.
// "When played as a unit: You may attach this unit as an upgrade to an enemy Vehicle unit without
// a Pilot on it."
//
// His upgrade side is -2/-2, so this is a debuff bolted onto an enemy ship. The mirror of Poe
// JTL_100 (friendly side, positive stats) with two differences that matter: the target is an ENEMY
// Vehicle, and there is NO take-control clause — the ship stays its owner's, it just carries an
// enemy Pilot.
const SIDON = Cards.units.jtl.sidonIthano;
const FIGHTER = Cards.units.sor.systemPatrolCraft;  // 3/4 Space — Vehicle, Fighter
const SMALL_FIGHTER = Cards.units.sor.tieLnFighter; // 2/1 Space — Vehicle, Fighter
const PILOT = Cards.units.jtl.frisk;                // a Pilot card, placed directly as an upgrade
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3 Ground — no Vehicle trait
const LEGION = Cards.units.hmw.theFirstLegion;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, SIDON);
}
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const offered = (g: GameTestAdapter) =>
  (needs(g) as { fromPlayIds?: string[] } | undefined)?.fromPlayIds ?? [];
const sidonUnit = (g: GameTestAdapter) =>
  [...g.state.player1.groundArena, ...g.state.player1.spaceArena].find(u => u.cardId === SIDON);

describe("JTL_213 Sidon Ithano — the attach offer", () => {
  it("offers the attach when an enemy Vehicle has no Pilot", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(2, FIGHTER).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(needs(g)?.type).toBe("Option");
  });

  it("is silent with no enemy Vehicle at all — he just enters as a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(needs(g)).toBeUndefined();
    expect(sidonUnit(g)).toBeDefined();
  });

  it("does not offer a FRIENDLY Vehicle — the text says enemy", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, FIGHTER).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(needs(g)).toBeUndefined();
    expect(sidonUnit(g)).toBeDefined();
  });

  it("does not offer an enemy Vehicle that already has a Pilot on it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(2, FIGHTER)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [
        { cardId: PILOT, playId: "pilot1", owner: 2, controller: 2 },
      ])
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(needs(g)).toBeUndefined();
  });

  it("only enemy Vehicles are offered when both sides have one", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, FIGHTER)
      .WithSpaceUnitForPlayer(2, FIGHTER)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(offered(g)).toEqual([g.state.player2.spaceArena[0].playId]);
  });

  it("declining leaves him in play as a ground unit and the ship untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(2, FIGHTER).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseNoAsync(1);

    const sidon = sidonUnit(g)!;
    expect(sidon).toBeDefined();
    expect(g.state.player1.groundArena.some(u => u.cardId === SIDON)).toBe(true);
    const ship = Unit.FromInterface(g.state.player2.spaceArena[0]);
    expect({ power: ship.CurrentPower(), hp: ship.TotalHP() }).toEqual({ power: 3, hp: 4 });
    expect(ship.upgrades).toHaveLength(0);
  });
});

describe("JTL_213 Sidon Ithano — accepting the attach", () => {
  it("leaves the arena and becomes a -2/-2 upgrade on the enemy ship", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(2, FIGHTER).Build());
    const shipId = g.state.player2.spaceArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [shipId] });

    // He is no longer a unit anywhere.
    expect(sidonUnit(g)).toBeUndefined();
    // And he is aboard, dragging the ship from 3/4 down to 1/2.
    const ship = Unit.FromInterface(g.state.player2.spaceArena[0]);
    expect(ship.upgrades.some(u => u.cardId === SIDON)).toBe(true);
    expect({ power: ship.CurrentPower(), hp: ship.TotalHP() }).toEqual({ power: 1, hp: 2 });
  });

  it("does NOT take control — the ship stays the enemy's, the upgrade stays yours", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(2, FIGHTER).Build());
    const shipId = g.state.player2.spaceArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [shipId] });

    // This is the clause that separates him from Pantoran Starship Thief (JTL_083).
    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player2.spaceArena).toHaveLength(1);
    expect(g.state.player2.spaceArena[0].controller).toBe(2);
    const sidonUpgrade = g.state.player2.spaceArena[0].upgrades.find(u => u.cardId === SIDON)!;
    expect(sidonUpgrade.owner).toBe(1);
    expect(sidonUpgrade.controller).toBe(1);
  });

  it("he fills the ship's Pilot slot, so it is no longer 'without a Pilot on it'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(2, FIGHTER).Build());
    const shipId = g.state.player2.spaceArena[0].playId;
    expect(PilotlessEnemyVehiclePlayIds(g.state, 1)).toEqual([shipId]);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [shipId] });

    // He has the Pilot trait, so the slot he occupies closes behind him.
    expect(PilotlessEnemyVehiclePlayIds(g.state, 1)).toEqual([]);
  });

  it("-2/-2 defeats a 2/1 ship outright, and both cards go to their owners' discards", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(2, SMALL_FIGHTER).Build());
    const shipId = g.state.player2.spaceArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [shipId] });

    // 1 HP - 2 = below zero, so the host is swept rather than left sitting at 0 HP.
    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player2.discard.some(d => d.cardId === SMALL_FIGHTER)).toBe(true);
    // Sidon rode it down; he is P1's card, so he lands in P1's discard.
    expect(g.state.player1.discard.some(d => d.cardId === SIDON)).toBe(true);
  });
});

describe("JTL_213 Sidon Ithano + HMW_108 The First Legion", () => {
  it("naming Pilot opens up an enemy Vehicle that was piloted a moment ago", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, LEGION)
      .WithSpaceUnitForPlayer(2, FIGHTER)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [
        { cardId: PILOT, playId: "pilot1", owner: 2, controller: 2 },
      ])
      .Build());
    const shipId = g.state.player2.spaceArena[0].playId;

    // Control: before the Legion attacks, the piloted ship is off limits (see the offer tests).
    // The Legion attacks the enemy base and names "Pilot", stripping the trait from enemy cards.
    const legion = g.state.player1.groundArena.find(u => u.cardId === LEGION)!;
    await g.dispatchAsync(1, "initiate-attack", { playId: legion.playId });
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["Pilot"] });
    await g.dispatchAsync(2, "pass-action", {});

    // 3/4 base, +2/+2 from Frisk aboard — the trait is suppressed, not the stat buff.
    const before = Unit.FromInterface(g.state.player2.spaceArena[0]);
    expect({ power: before.CurrentPower(), hp: before.TotalHP() }).toEqual({ power: 5, hp: 6 });

    // The ship now reads as pilotless, so Sidon can board it.
    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    expect(offered(g)).toEqual([shipId]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [shipId] });

    const ship = Unit.FromInterface(g.state.player2.spaceArena[0]);
    expect(ship.upgrades.some(u => u.cardId === SIDON)).toBe(true);
    // Both Pilots are now aboard: 3/4 +2/+2 (Frisk) -2/-2 (Sidon).
    expect({ power: ship.CurrentPower(), hp: ship.TotalHP() }).toEqual({ power: 3, hp: 4 });
  });

  it("naming a different trait leaves the ship piloted and Sidon with nowhere to go", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, LEGION)
      .WithSpaceUnitForPlayer(2, FIGHTER)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [
        { cardId: PILOT, playId: "pilot1", owner: 2, controller: 2 },
      ])
      .Build());

    const legion = g.state.player1.groundArena.find(u => u.cardId === LEGION)!;
    await g.dispatchAsync(1, "initiate-attack", { playId: legion.playId });
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["Ewok"] });
    await g.dispatchAsync(2, "pass-action", {});

    await g.playCardFromHandAsync(1, 0);

    expect(needs(g)).toBeUndefined();
    expect(sidonUnit(g)).toBeDefined();
  });
});
