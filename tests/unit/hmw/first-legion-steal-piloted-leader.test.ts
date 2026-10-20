import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { PilotlessFighterOrTransportPlayIds } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { aspectPenalty } from "@/server/engine/card-playability";

// Stealing a Vehicle that an enemy LEADER is piloting.
//
// CR 3.4.6: "If an ability would cause a leader unit or leader upgrade to move to an out-of-play
// zone or change control for any reason, it is defeated instead."
// CR 3.4.7: "Some abilities make non-leader units leader units. … it doesn't follow rules
// 3.4.1-3.4.6. It doesn't provide its aspect icons, it can change control or move to an
// out-of-play zone, and when it is defeated, it is placed in the discard pile, not the base zone."
//
// A Vehicle carrying a leader Pilot is a leader unit BY AN ABILITY, so 3.4.7 applies and the
// "defeated instead" replacement of 3.4.6 does not: the Vehicle may change control. The leader
// upgrade itself keeps its own controller, so it never changes control either and so is likewise
// never defeated by 3.4.6.
//
// The chain: name "Pilot" with The First Legion so the Vehicle stops having a Pilot on it, then
// attach Pantoran Starship Thief to it and take the Vehicle — leader and all.
const LEGION = Cards.units.hmw.theFirstLegion;
const THIEF = Cards.units.jtl.pantoranStarshipThief;
const FIGHTER = Cards.units.sor.systemPatrolCraft;   // 3/4 Space — Vehicle, Fighter
const PILOT_LEADER = Cards.leaders.jtl.wedgeAntilles; // deploys as a Pilot; has the Pilot trait
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    // P2's leader is deployed as a Pilot upgrade on their Fighter.
    .TheirLeader(PILOT_LEADER, true, true)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithGroundUnitForPlayer(1, LEGION)
    .WithSpaceUnitForPlayer(2, FIGHTER)
    .WithUpgradesOnSpaceUnitForPlayer(2, 0, [
      { cardId: PILOT_LEADER, playId: "wedge", owner: 2, controller: 2 },
    ]);
}

async function nameTrait(g: GameTestAdapter, trait: string) {
  const legion = g.state.player1.groundArena.find(u => u.cardId === LEGION)!;
  await g.dispatchAsync(1, "initiate-attack", { playId: legion.playId });
  await g.chooseBaseAsync(1, 2);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [trait] });
}

describe("stealing a leader-piloted Vehicle after naming Pilot", () => {
  it("the host counts as a leader unit, but the leader CARD is the upgrade", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    const fighter = Unit.FromInterface(g.state.player2.spaceArena[0]);
    // A leader unit by an ability (CR 3.4.7), not by being a leader card.
    expect(fighter.IsLeader()).toBe(true);
    expect(fighter.HasPilotLeader()).toBe(true);
    // The deployed-leader link points at the UPGRADE, which is the actual leader card.
    expect(g.state.player2.leader.deployed).toBe(true);
    expect(g.state.player2.leader.deployedPlayId).toBe("wedge");
  });

  it("while the leader is aboard, the Vehicle has a Pilot on it", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    expect(PilotlessFighterOrTransportPlayIds(g.state)).toHaveLength(0);
  });

  it("naming Pilot strips the leader upgrade's Pilot trait, so the Vehicle is pilotless", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await nameTrait(g, "Pilot");

    const fighter = g.state.player2.spaceArena[0];
    expect(PilotlessFighterOrTransportPlayIds(g.state)).toEqual([fighter.playId]);
  });

  it("the Thief then takes the Vehicle, leader and all", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, THIEF).Build());
    const fighterId = g.state.player2.spaceArena[0].playId;

    await nameTrait(g, "Pilot");
    await g.dispatchAsync(2, "pass-action", {});

    await g.playCardFromHandAsync(1, 0); // Pantoran Starship Thief
    await g.chooseYesAsync(1);           // pay 3
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [fighterId] });

    // CR 3.4.7 — the ability-made leader unit changed control instead of being defeated.
    const stolen = g.state.player1.spaceArena.find(u => u.playId === fighterId);
    expect(stolen).toBeDefined();
    expect(g.state.player2.spaceArena).toHaveLength(0);

    // The leader upgrade came along physically but did NOT change control (CR 3.4.6), so it is
    // not defeated and P2's leader is still deployed.
    const wedge = stolen!.upgrades.find(u => u.cardId === PILOT_LEADER)!;
    expect(wedge).toBeDefined();
    expect(wedge.controller).toBe(2);
    expect(g.state.player2.leader.deployed).toBe(true);
    expect(g.state.player2.leader.deployedPlayId).toBe("wedge");

    // And the Thief is aboard as a Pilot of its own.
    expect(stolen!.upgrades.some(u => u.cardId === THIEF)).toBe(true);
  });

  it("the new controller can attack with the stolen Vehicle", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, THIEF).Build());
    const fighterId = g.state.player2.spaceArena[0].playId;

    await nameTrait(g, "Pilot");
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [fighterId] });

    // Next turn it is P1's unit to swing with.
    await g.dispatchAsync(2, "pass-action", {});
    const stolen = g.state.player1.spaceArena.find(u => u.playId === fighterId)!;
    if (!stolen.ready) stolen.ready = true; // it arrived exhausted from the attach
    await g.dispatchAsync(1, "initiate-attack", { playId: fighterId });
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBeGreaterThan(0);
  });

  it("the stolen leader upgrade still provides ITS OWNER's aspect icons", async () => {
    // Two rules pulling in different directions, and both matter here:
    //   CR 3.4.1 — "A leader provides its aspect icons for the purpose of playing cards." The
    //     leader upgrade is still a leader card in play, and still P2's, so P2 keeps its icons
    //     even though P1 now holds the Vehicle it is attached to.
    //   CR 3.4.7 — the ability-made leader unit "doesn't provide its aspect icons", so holding
    //     the Vehicle buys P1 nothing.
    // Aspect provision therefore follows the LEADER SLOT, not who controls the board.
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, THIEF).Build());
    const fighterId = g.state.player2.spaceArena[0].playId;

    // Wedge is Command/Heroism; both bases are Command. A Command+Heroism card therefore costs
    // P2 no penalty (Heroism from Wedge) and costs P1 two (Heroism uncovered).
    const beforeP1 = aspectPenalty(g.state, 1, MARINE);
    const beforeP2 = aspectPenalty(g.state, 2, MARINE);
    expect(beforeP2).toBe(0);
    expect(beforeP1).toBe(2);

    await nameTrait(g, "Pilot");
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [fighterId] });

    // P1 holds the Vehicle AND the leader upgrade is sitting on it — and neither changes anything.
    expect(g.state.player1.spaceArena.some(u => u.playId === fighterId)).toBe(true);
    expect(aspectPenalty(g.state, 2, MARINE)).toBe(beforeP2); // P2 still covered by their leader
    expect(aspectPenalty(g.state, 1, MARINE)).toBe(beforeP1); // P1 gains nothing from the capture
  });

  it("CR 3.4.7: defeating the host puts the VEHICLE in the discard, not the base zone", async () => {
    const g = new GameTestAdapter();
    // A big friendly space unit to shoot it down.
    g.loadNewState(setup().WithSpaceUnitForPlayer(1, Cards.units.ash.summaVerminoth).Build());

    await g.dispatchAsync(1, "initiate-attack", { playId: g.state.player1.spaceArena[0].playId });
    await g.chooseSpaceUnitAsync(2, 0);

    // The host is an ordinary unit card, so it discards — the base zone is only for leader CARDS.
    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player2.discard.some(d => d.cardId === FIGHTER)).toBe(true);
    // Its leader passenger goes back to being an undeployed leader.
    expect(g.state.player2.leader.deployed).toBe(false);
  });
});
