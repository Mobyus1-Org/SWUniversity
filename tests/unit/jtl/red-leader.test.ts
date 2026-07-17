import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CardInPlay } from "@/lib/engine/core-models";

// JTL_101 Red Leader (Space, cost 4, Command/Heroism, Rebel/Vehicle/Fighter)
// "This unit costs 1 resource less to play for each friendly Pilot unit and upgrade."
// "When a Pilot upgrade attaches to this unit: Create an X-Wing token."

const RED_LEADER = Cards.units.jtl.redLeader;
const ANAKIN = Cards.units.jtl.anakinSkywalker; // Pilot-trait unit, also playable as a Piloting upgrade

function pilotUpgrade(cardId: string): CardInPlay {
  return { cardId, playId: "@", owner: 1, controller: 1 };
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism — matches Red Leader's aspects, no penalty
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithCardInHandForPlayer(1, RED_LEADER)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("JTL_101 Red Leader — cost reduction per friendly Pilot unit/upgrade", () => {
  it("costs printed 4 with no Pilots in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    const handIdx = g.state.player1.hand.findIndex(c => c.cardId === RED_LEADER);
    await g.playCardFromHandAsync(1, handIdx);

    expect(g.state.player1.spaceArena.some(u => u.cardId === RED_LEADER)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(10); // 14 − 4
  });

  it("costs 1 less with a friendly Pilot unit in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, ANAKIN).Build());

    const handIdx = g.state.player1.hand.findIndex(c => c.cardId === RED_LEADER);
    await g.playCardFromHandAsync(1, handIdx);

    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(11); // 14 − (4 − 1)
  });

  it("costs 1 less with a friendly Pilot upgrade attached elsewhere", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [pilotUpgrade(ANAKIN)])
        .Build(),
    );

    const handIdx = g.state.player1.hand.findIndex(c => c.cardId === RED_LEADER);
    await g.playCardFromHandAsync(1, handIdx);

    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(11); // 14 − (4 − 1)
  });

  it("stacks: 2 less with both a Pilot unit and a Pilot upgrade in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, ANAKIN)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [pilotUpgrade(Cards.units.jtl.r2d2)])
        .Build(),
    );

    const handIdx = g.state.player1.hand.findIndex(c => c.cardId === RED_LEADER);
    await g.playCardFromHandAsync(1, handIdx);

    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(12); // 14 − (4 − 2)
  });
});

describe("JTL_101 Red Leader — When a Pilot upgrade attaches: create an X-Wing token", () => {
  it("creates an X-Wing token when a Pilot is played onto Red Leader", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
        .WithCardInHandForPlayer(1, ANAKIN)
        .WithSpaceUnitForPlayer(1, RED_LEADER)
        .Build(),
    );

    expect(g.state.player1.spaceArena.filter(u => u.cardId === Cards.units.token.xWing)).toHaveLength(0);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.chooseSpaceUnitAsync(1, 0); // Red Leader

    expect(g.state.player1.spaceArena.filter(u => u.cardId === Cards.units.token.xWing)).toHaveLength(1);
  });

  it("does not create a token when a non-Pilot upgrade attaches (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.hardpointHeavyBlaster)
        .WithSpaceUnitForPlayer(1, RED_LEADER)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0); // Red Leader

    expect(g.state.player1.spaceArena[0].upgrades.map(u => u.cardId)).toContain(Cards.upgrades.sor.hardpointHeavyBlaster);
    expect(g.state.player1.spaceArena.filter(u => u.cardId === Cards.units.token.xWing)).toHaveLength(0);
  });
});
