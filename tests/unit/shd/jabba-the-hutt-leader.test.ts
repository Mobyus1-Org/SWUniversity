import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_006 Jabba the Hutt — His High Exaltedness (leader; 2/12 Ground deployed, Command/Villainy)
//   Front: "Action [Exhaust]: Choose a unit. For this phase, it gains: 'Bounty — The next unit you
//           play this phase costs 1 resource less.'"
//   Deployed: "When Deployed: Another friendly unit captures an enemy non-leader unit."
//             "Action [Exhaust]: … 'Bounty — The next unit you play this phase costs 2 resources less.'"
//
// The Bounty is collected by the defeated unit's OPPONENT; "you" in it is that collector.

const JABBA = Cards.leaders.shd.jabbaTheHutt;
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3, cost 2
const CSF = Cards.units.sor.consularSecurityForce; // 3/7
const TROOPER = Cards.units.ibh.firstLegionTrooper; // cost 3, Vigilance/Villainy — no penalty with Jabba + a blue base

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(JABBA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithActivePlayer(1);
}

const spent = (g: GameTestAdapter) => g.state.player1.resources.filter(r => !r.ready).length;

/** P1's CSF attacks and defeats the enemy Marine, then P1 collects its Bounty. */
async function killMarineAndCollect(g: GameTestAdapter) {
  await g.dispatchAsync(2, "pass-action", {});
  await g.attackWithGroundUnitAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
  expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option"); // the Bounty offer
  await g.chooseYesAsync(1);
  await g.dispatchAsync(2, "pass-action", {});
}

describe("SHD_006 Jabba the Hutt — leader Action", () => {
  it("the chosen unit's Bounty makes the collector's next unit cost 1 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, TROOPER).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(g.state.player1.leader.ready).toBe(false);

    await killMarineAndCollect(g);
    await g.playCardFromHandAsync(1, 0);

    expect(spent(g)).toBe(3 - 1);
  });

  it("the discount is spent by the first unit only", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, MARINE)
        .WithCardInHandForPlayer(1, TROOPER).WithCardInHandForPlayer(1, TROOPER).Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    await killMarineAndCollect(g);
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);

    expect(spent(g)).toBe((3 - 1) + 3);
  });

  it("control: the same defeat without Jabba's Bounty offers nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});

describe("SHD_006 Jabba the Hutt — deployed", () => {
  it("Action [Exhaust]: the granted Bounty discounts the next unit by 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup().MyLeader(JABBA, true, true)
        .WithGroundUnitForPlayer(1, CSF)
        .WithGroundUnitForPlayer(1, JABBA)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithCardInHandForPlayer(1, TROOPER)
        .Build(),
    );

    await g.dispatchAsync(1, "use-ability", { cardId: JABBA, playId: g.state.player1.groundArena[1].playId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(g.state.player1.groundArena[1].ready).toBe(false);

    await killMarineAndCollect(g);
    await g.playCardFromHandAsync(1, 0);

    expect(spent(g)).toBe(3 - 2);
  });

  it("When Deployed: another friendly unit captures an enemy non-leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.deployLeaderAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] }); // the captor
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] }); // the victim

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.groundArena[0].captives.map(c => c.cardId)).toEqual([MARINE]);
  });

  it("When Deployed with no other friendly unit: nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.deployLeaderAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena.length).toBe(1);
  });
});
