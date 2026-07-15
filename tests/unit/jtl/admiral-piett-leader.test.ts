import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_005 Admiral Piett — Commanding the Armada (Ground leader)
// Leader:   "Action [Exhaust]: Play a Capital Ship unit from your hand. It costs 1 resource less."
//           "Epic Action: If you control 5 or more resources, deploy this leader."
// Deployed: "Each Capital Ship unit you play costs 2 resources less."
//
// Chimaera JTL_039 = Imperial Vehicle Capital Ship, cost 6, aspects Vigilance/Villainy.
// Piett provides Command/Villainy; a colourless base leaves Vigilance uncovered → +2 aspect
// penalty, so the un-discounted cost of the Chimaera under Piett is 8.

const CAPITAL = Cards.units.jtl.chimaera; // Capital Ship, printed cost 6 (8 with the Vigilance penalty)

describe("JTL_005 Admiral Piett (leader) — Action: play a Capital Ship at −1", () => {
  it("plays a Capital Ship from hand for 1 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.admiralPiett)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, CAPITAL)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena.some(u => u.cardId === CAPITAL)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(7); // 14 − (8 − 1)
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("is unavailable with no Capital Ship in hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.admiralPiett)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // not a Capital Ship
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithActivePlayer(1)
        .Build(),
    );

    const used = await g.useLeaderAbilityAsync(1);
    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("JTL_005 Admiral Piett — Epic Action deploy (5+ resources)", () => {
  it("deploys for free with 5 resources; not with 4", async () => {
    const g5 = new GameTestAdapter();
    g5.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.admiralPiett)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithActivePlayer(1)
        .Build(),
    );
    await g5.deployLeaderAsync(1);
    expect(g5.state.player1.leader.deployed).toBe(true);

    const g4 = new GameTestAdapter();
    g4.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.admiralPiett)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
        .WithActivePlayer(1)
        .Build(),
    );
    await g4.deployLeaderAsync(1);
    expect(g4.state.player1.leader.deployed).toBe(false);
  });
});

describe("JTL_005 Admiral Piett (deployed) — Capital Ships cost 2 less", () => {
  function deployedSetup(leader = Cards.leaders.jtl.admiralPiett, deployed = true) {
    const b = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(leader, true, deployed, deployed)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithCardInHandForPlayer(1, CAPITAL)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithActivePlayer(1);
    if (deployed) b.WithGroundUnitForPlayer(1, leader); // deployed leader unit in play
    return b;
  }

  it("a Capital Ship played normally costs 2 less with deployed Piett", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());

    const handIdx = g.state.player1.hand.findIndex(c => c.cardId === CAPITAL);
    await g.playCardFromHandAsync(1, handIdx);

    expect(g.state.player1.spaceArena.some(u => u.cardId === CAPITAL)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(8); // 14 − (8 − 2)
  });

  it("no discount without deployed Piett (control)", async () => {
    const g = new GameTestAdapter();
    // Sabine Wren provides Aggression only → Vigilance still uncovered, but no Capital-Ship discount.
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.admiralPiett) // present but NOT deployed → passive inactive
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, CAPITAL)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithActivePlayer(1)
        .Build(),
    );

    const handIdx = g.state.player1.hand.findIndex(c => c.cardId === CAPITAL);
    await g.playCardFromHandAsync(1, handIdx);

    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(6); // 14 − 8, no discount
  });
});
