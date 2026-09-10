import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_077 Evidence of the Crime (Event, cost 3, Vigilance)
//   "Take control of an upgrade that costs 3 or less and attach it to an eligible unit of your
//    choice."
//
// Not optional. Tokens have no printed cost, so they are never "an upgrade that costs 3 or less".
// The upgrade's own attach restriction decides the legal hosts, and its current host is one of
// them — you may take control and leave it where it is.

const EVENT = Cards.events.shd.evidenceOfTheCrime;
const MARINE = Cards.units.sor.battlefieldMarine;     // 3/3 Ground
const TIE = Cards.units.sor.tieLnFighter;             // 2/1 Space Vehicle
const FIREBALL = Cards.units.jtl.fireball;            // 3/3 Space Vehicle
const TRAINING = Cards.upgrades.sor.academyTraining;  // cost 2, +2/+2, no restriction
const SABER = Cards.upgrades.lof.inquisitorsLightsaber; // cost 2, +1/+3, non-Vehicle
const COMPARTMENT = Cards.upgrades.sor.smugglingCompartment; // cost 1, Vehicle only
const DARKSABER = Cards.upgrades.shd.theDarksaber;    // cost 4
const SHIELD = Cards.upgrades.token.shield;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, EVENT);
}

const up = (cardId: string, controller: 1 | 2) => GameStateBuilder.Upgrade(cardId, controller);
const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds ?? [];

describe("SHD_077 Evidence of the Crime", () => {
  it("takes control of an enemy upgrade and attaches it to a friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(TRAINING, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
    const moved = g.state.player1.groundArena[0].upgrades;
    expect(moved.map(u => u.cardId)).toEqual([TRAINING]);
    expect(moved[0].controller).toBe(1);
    expect(moved[0].owner).toBe(2);
  });

  it("offers upgrades costing 3 or less on either side — not cost-4 ones, not tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(SABER, 1)])
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(DARKSABER, 2), up(SHIELD, 2), up(TRAINING, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const mine = g.state.player1.groundArena[0].upgrades[0].playId;
    const training = g.state.player2.groundArena[0].upgrades.find(u => u.cardId === TRAINING)!.playId;
    expect([...offer(g)].sort()).toEqual([mine, training].sort());
  });

  it("the CURRENT host is a legal destination — take control and leave it in place", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(TRAINING, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);
    expect(offer(g)).toContain(g.state.player2.groundArena[0].playId);
    await g.chooseGroundUnitAsync(2, 0);

    const stayed = g.state.player2.groundArena[0].upgrades;
    expect(stayed.map(u => u.cardId)).toEqual([TRAINING]);
    expect(stayed[0].controller).toBe(1);
  });

  it("the upgrade's own restriction limits the hosts — a Vehicle-only upgrade goes only to Vehicles", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithSpaceUnitForPlayer(1, FIREBALL)
        .WithSpaceUnitForPlayer(2, TIE)
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [up(COMPARTMENT, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseUpgradeOnSpaceUnitAsync(1, 2, 0);

    expect([...offer(g)].sort()).toEqual(
      [g.state.player1.spaceArena[0].playId, g.state.player2.spaceArena[0].playId].sort(),
    );
    await g.chooseSpaceUnitAsync(1, 0);
    expect(g.state.player1.spaceArena[0].upgrades.map(u => u.cardId)).toEqual([COMPARTMENT]);
  });

  it("a single legal host resolves without a second prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, MARINE) // not a Vehicle — can't take it
        .WithSpaceUnitForPlayer(2, TIE)
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [up(COMPARTMENT, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseUpgradeOnSpaceUnitAsync(1, 2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    const stayed = g.state.player2.spaceArena[0].upgrades;
    expect(stayed.map(u => u.cardId)).toEqual([COMPARTMENT]);
    expect(stayed[0].controller).toBe(1);
  });

  it("taking an HP upgrade away can defeat its old host", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE, true, 3) // 3 damage — alive only thanks to +3 HP
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(SABER, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].upgrades.map(u => u.cardId)).toEqual([SABER]);
  });

  it("no upgrade costing 3 or less in play — nothing to choose", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(DARKSABER, 2), up(SHIELD, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(2);
  });
});
