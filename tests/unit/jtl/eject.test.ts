import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_126 Eject (Event, cost 2, Command)
//   "Detach a Pilot upgrade, move it to the ground arena as a unit, and exhaust it. Draw a card."

const EJECT = Cards.events.jtl.eject;
const AWING = Cards.units.jtl.phoenixSquadronAWing;
const TIE = Cards.units.sor.tieLnFighter;
const PILOT = Cards.units.jtl.wingmanVictorTwo;   // Piloting unit
const THIEF = Cards.units.jtl.pantoranStarshipThief;
const LUKE = Cards.leaders.jtl.lukeSkywalker;      // a leader that deploys as a Pilot
const MARINE = Cards.units.sor.battlefieldMarine;
const up = (id: string, p: 1 | 2) => GameStateBuilder.Upgrade(id, p);

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInHandForPlayer(1, EJECT);
}

describe("JTL_126 Eject", () => {
  it("detaches a Pilot, puts it in the ground arena exhausted, and draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, AWING).WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(PILOT, 1)]).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseUpgradeOnSpaceUnitAsync(1, 1, 0);

    expect(g.state.player1.spaceArena[0].upgrades).toHaveLength(0);
    const pilot = g.state.player1.groundArena.find(u => u.cardId === PILOT)!;
    expect(pilot).toBeDefined();
    expect(pilot.ready).toBe(false);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
  });

  it("an enemy Pilot lands in ITS controller's ground arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(2, AWING).WithUpgradesOnSpaceUnitForPlayer(2, 0, [up(PILOT, 2)]).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseUpgradeOnSpaceUnitAsync(1, 2, 0);

    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([PILOT]);
    expect(g.state.player1.groundArena).toHaveLength(0);
  });

  it("a leader Pilot becomes that player's deployed leader unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .TheirLeader(LUKE, false, true)
      .WithSpaceUnitForPlayer(2, AWING)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [up(LUKE, 2)])
      .Build();
    state.player2.leader.deployedPlayId = state.player2.spaceArena[0].upgrades[0].playId;
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseUpgradeOnSpaceUnitAsync(1, 2, 0);

    const lukeUnit = g.state.player2.groundArena.find(u => u.cardId === LUKE)!;
    expect(lukeUnit).toBeDefined();
    expect(lukeUnit.ready).toBe(false);
    expect(g.state.player2.leader.deployed).toBe(true);
    expect(g.state.player2.leader.deployedPlayId).toBe(lukeUnit.playId);
  });

  it("ejecting a Pantoran Starship Thief hands the stolen unit back to its owner", async () => {
    const g = new GameTestAdapter();
    const state = base().WithSpaceUnitForPlayer(1, TIE, true, 0, 1).WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(THIEF, 1)]).Build();
    state.player1.spaceArena[0].owner = 2; // the TIE was stolen from player 2
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseUpgradeOnSpaceUnitAsync(1, 1, 0);

    expect(g.state.player2.spaceArena.map(u => [u.cardId, u.controller])).toEqual([[TIE, 2]]);
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([THIEF]);
  });

  it("no Pilot anywhere — it still draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, AWING).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
  });

  it("only Pilot upgrades are offered — not other upgrades", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithSpaceUnitForPlayer(1, AWING)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(PILOT, 1), up(Cards.upgrades.sor.academyTraining, 1), up(Cards.upgrades.token.shield, 1)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toEqual([g.state.player1.spaceArena[0].upgrades[0].playId]);
  });
});
