import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import { Unit } from "@/server/engine/unit";

// The uniqueness rule spans EVERY in-play zone, not just the arenas.
//
//   CR 8.29.3  — "A player can only control one copy of each unique card with the same name and
//     subtitle at a given time. If a player ever has more than one copy of a unique card in play
//     under their control at a given time, they must defeat one of them. […] The player still must
//     resolve any abilities that trigger upon either copy being played or defeated."
//   CR 8.29.3a — "The unique copy limit applies to all in-play copies of a unique card, regardless
//     of how that card is in-play. For example, Hera Syndulla: We've Lost Enough (JTL #047) is a
//     unique PILOT unit. If Aitor controls a copy […] attached to a VEHICLE space unit and plays
//     another copy […] as a ground unit, he will have to defeat one of the copies […]"
//   CR 8.29.5  — "The unique copy limit is player-specific."
//
// So a unique Pilot counts whether it is standing in an arena or riding a ship as an upgrade, and
// the player CHOOSES which copy dies — it is not an automatic cull of the older one.
const CHEWIE = Cards.units.jtl.chewbacca;        // 5/6 Ground, upgrade 3/3, unique, Piloting 3
const LUKE = Cards.units.jtl.lukeSkywalker;      // 3/2 Ground, upgrade 3/2, unique, Piloting 3
const FIGHTER = Cards.units.sor.systemPatrolCraft; // 3/4 Space — Vehicle, Fighter
const MARINE = Cards.units.sor.battlefieldMarine;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.darthVader)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const offered = (g: GameTestAdapter) =>
  (needs(g) as { fromPlayIds?: string[] } | undefined)?.fromPlayIds ?? [];
/** Every in-play copy of `cardId` that `player` controls — arenas plus upgrades anywhere. */
function copiesControlled(g: GameTestAdapter, cardId: string, player: 1 | 2): string[] {
  const all = [
    ...g.state.player1.groundArena, ...g.state.player1.spaceArena,
    ...g.state.player2.groundArena, ...g.state.player2.spaceArena,
  ];
  const asUnits = all.filter(u => u.cardId === cardId && u.controller === player).map(u => u.playId);
  const asUpgrades = all.flatMap(u =>
    u.upgrades.filter(up => up.cardId === cardId && (up.controller ?? up.owner) === player).map(up => up.playId));
  return [...asUnits, ...asUpgrades];
}

describe("uniqueness spans units and upgrades — Chewbacca (JTL_103)", () => {
  it("unit in play, then played as a Pilot upgrade: prompts, offering BOTH copies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, CHEWIE)      // copy 1: standing in the ground arena
      .WithSpaceUnitForPlayer(1, FIGHTER)      // a ship for copy 2 to board
      .WithCardInHandForPlayer(1, CHEWIE)
      .Build());
    const unitCopy = g.state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);

    // CR 8.29.3a — two copies in play, and the player chooses which one dies.
    expect(needs(g)?.type).toBe("Target");
    expect(offered(g)).toHaveLength(2);
    expect(offered(g)).toContain(unitCopy);
  });

  it("choosing the unit copy leaves the Pilot aboard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, CHEWIE)
      .WithSpaceUnitForPlayer(1, FIGHTER)
      .WithCardInHandForPlayer(1, CHEWIE)
      .Build());
    const unitCopy = g.state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [unitCopy] });

    expect(copiesControlled(g, CHEWIE, 1)).toHaveLength(1);
    expect(g.state.player1.groundArena).toHaveLength(0);
    const ship = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(ship.upgrades.some(u => u.cardId === CHEWIE)).toBe(true);
    expect({ power: ship.CurrentPower(), hp: ship.TotalHP() }).toEqual({ power: 6, hp: 7 });
  });

  it("choosing the Pilot copy leaves the unit standing, and the ship loses the +3/+3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, CHEWIE)
      .WithSpaceUnitForPlayer(1, FIGHTER)
      .WithCardInHandForPlayer(1, CHEWIE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);
    const pilotCopy = g.state.player1.spaceArena[0].upgrades.find(u => u.cardId === CHEWIE)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [pilotCopy] });

    expect(copiesControlled(g, CHEWIE, 1)).toEqual([g.state.player1.groundArena[0].playId]);
    const ship = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(ship.upgrades.some(u => u.cardId === CHEWIE)).toBe(false);
    expect({ power: ship.CurrentPower(), hp: ship.TotalHP() }).toEqual({ power: 3, hp: 4 });
    expect(g.state.player1.discard.some(d => d.cardId === CHEWIE)).toBe(true);
  });

  it("Pilot upgrade in play, then played as a UNIT: prompts the other way round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, FIGHTER)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        { cardId: CHEWIE, playId: "chewie-pilot", owner: 1, controller: 1 },
      ])
      .WithCardInHandForPlayer(1, CHEWIE)
      .Build());

    await g.playCardFromHandAsync(1, 0); // as a unit — no "Play as Pilot", the ship is taken

    expect(needs(g)?.type).toBe("Target");
    expect(offered(g)).toHaveLength(2);
    expect(offered(g)).toContain("chewie-pilot");
  });

  it("his 'can't be defeated by ENEMY card abilities' does not block the uniqueness defeat", async () => {
    // Resolving uniqueness is the controller defeating their own copy, not an enemy ability, so
    // the protection on both his unit side and his upgrade side is irrelevant here.
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, FIGHTER)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        { cardId: CHEWIE, playId: "chewie-pilot", owner: 1, controller: 1 },
      ])
      .WithCardInHandForPlayer(1, CHEWIE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["chewie-pilot"] });

    expect(copiesControlled(g, CHEWIE, 1)).toHaveLength(1);
    expect(g.state.player1.spaceArena[0].upgrades.some(u => u.cardId === CHEWIE)).toBe(false);
  });

  it("control: one copy alone never prompts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, FIGHTER)
      .WithCardInHandForPlayer(1, CHEWIE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);

    expect(needs(g)).toBeUndefined();
    expect(copiesControlled(g, CHEWIE, 1)).toHaveLength(1);
  });

  it("CR 8.29.5: the opponent's own copy is not my problem", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, CHEWIE)       // THEIR Chewbacca
      .WithSpaceUnitForPlayer(1, FIGHTER)
      .WithCardInHandForPlayer(1, CHEWIE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);

    expect(needs(g)).toBeUndefined();
    expect(copiesControlled(g, CHEWIE, 1)).toHaveLength(1);
    expect(copiesControlled(g, CHEWIE, 2)).toHaveLength(1);
  });
});

describe("uniqueness chains through Luke's eject (JTL_094)", () => {
  // "If this upgrade would be defeated, you may instead move him to the ground arena as a unit and
  // exhaust him." Defeating the Pilot copy to satisfy uniqueness therefore puts a copy straight
  // back into play, which has to raise the uniqueness question a SECOND time.
  function lukeAboardAndInHand() {
    return base()
      .WithSpaceUnitForPlayer(1, FIGHTER)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        { cardId: LUKE, playId: "luke-pilot", owner: 1, controller: 1 },
      ])
      .WithCardInHandForPlayer(1, LUKE);
  }

  it("playing the second Luke as a unit prompts, offering the Pilot copy", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(lukeAboardAndInHand().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(needs(g)?.type).toBe("Target");
    expect(offered(g)).toContain("luke-pilot");
  });

  it("choosing the Pilot copy offers his eject replacement", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(lukeAboardAndInHand().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["luke-pilot"] });

    expect(needs(g)?.type).toBe("Option");
  });

  it("ejecting him into the ground arena raises a SECOND uniqueness prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(lukeAboardAndInHand().Build());

    await g.playCardFromHandAsync(1, 0);
    const playedLuke = g.state.player1.groundArena.find(u => u.cardId === LUKE)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["luke-pilot"] });
    await g.chooseOptionAsync(1, `move_to_ground_exhausted=${LUKE},1`);

    // He left the ship and landed in the arena next to the Luke just played — two copies again.
    expect(needs(g)?.type).toBe("Target");
    const second = offered(g);
    expect(second).toHaveLength(2);
    expect(second).toContain(playedLuke);
    // And the other option is the ejected copy, which is a NEW playId, not the upgrade's.
    expect(second).not.toContain("luke-pilot");
  });

  it("resolving the second prompt leaves exactly one Luke", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(lukeAboardAndInHand().Build());

    await g.playCardFromHandAsync(1, 0);
    const playedLuke = g.state.player1.groundArena.find(u => u.cardId === LUKE)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["luke-pilot"] });
    await g.chooseOptionAsync(1, `move_to_ground_exhausted=${LUKE},1`);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [playedLuke] });

    expect(copiesControlled(g, LUKE, 1)).toHaveLength(1);
    // The survivor is the ejected one, and he arrived exhausted.
    const survivor = g.state.player1.groundArena.find(u => u.cardId === LUKE)!;
    expect(survivor.playId).not.toBe(playedLuke);
    expect(survivor.ready).toBe(false);
  });

  it("declining the eject ends the chain with one Luke and no second prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(lukeAboardAndInHand().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["luke-pilot"] });
    await g.chooseOptionAsync(1, "decline");

    expect(needs(g)).toBeUndefined();
    expect(copiesControlled(g, LUKE, 1)).toHaveLength(1);
    expect(g.state.player1.discard.some(d => d.cardId === LUKE)).toBe(true);
  });
});

describe("uniqueness counts a copy riding a ship the enemy stole", () => {
  // Taking control of a unit brings its upgrades along physically (CR 1.x.d) but does not change
  // who controls those upgrades. So my Luke on my stolen ship is still MY copy in play, and
  // playing another one is still two copies under my control.
  function stolenShipWithMyLuke() {
    return base()
      // P2 controls the hull; the Luke riding it is still P1's.
      .WithSpaceUnitForPlayer(2, FIGHTER)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [
        { cardId: LUKE, playId: "luke-stolen", owner: 1, controller: 1 },
      ])
      .WithSpaceUnitForPlayer(1, FIGHTER)
      .WithCardInHandForPlayer(1, LUKE);
  }

  it("the stolen-side copy still counts as mine", () => {
    const g = new GameTestAdapter();
    g.loadNewState(stolenShipWithMyLuke().Build());

    expect(copiesControlled(g, LUKE, 1)).toEqual(["luke-stolen"]);
    expect(copiesControlled(g, LUKE, 2)).toEqual([]);
  });

  it("playing another Luke as a Pilot on MY ship prompts, offering the stolen-side copy", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(stolenShipWithMyLuke().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0); // my own ship

    expect(needs(g)?.type).toBe("Target");
    expect(offered(g)).toHaveLength(2);
    expect(offered(g)).toContain("luke-stolen");
  });

  it("ejecting the stolen-side Luke puts him in MY ground arena and prompts again", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(stolenShipWithMyLuke().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);
    const freshPilot = g.state.player1.spaceArena[0].upgrades.find(u => u.cardId === LUKE)!.playId;

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["luke-stolen"] });
    await g.chooseOptionAsync(1, `move_to_ground_exhausted=${LUKE},1`);

    // He is MY card, so he ejects to MY ground arena — not the thief's.
    expect(g.state.player1.groundArena.some(u => u.cardId === LUKE)).toBe(true);
    expect(g.state.player2.groundArena.some(u => u.cardId === LUKE)).toBe(false);
    // Two of mine again: the freshly played Pilot and the one that just bailed out.
    expect(needs(g)?.type).toBe("Target");
    const second = offered(g);
    expect(second).toHaveLength(2);
    expect(second).toContain(freshPilot);
  });

  it("the thief's hull is untouched by my uniqueness resolution", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(stolenShipWithMyLuke().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["luke-stolen"] });
    await g.chooseOptionAsync(1, "decline");

    expect(g.state.player2.spaceArena).toHaveLength(1);
    expect(g.state.player2.spaceArena[0].controller).toBe(2);
    expect(g.state.player2.spaceArena[0].upgrades.some(u => u.cardId === LUKE)).toBe(false);
    expect(copiesControlled(g, LUKE, 1)).toHaveLength(1);
  });
});
