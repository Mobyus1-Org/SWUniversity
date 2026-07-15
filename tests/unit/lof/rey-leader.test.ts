import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_012 Rey — Nobody (Ground leader)
// Leader:   "Action [Exhaust]: If you played a non-unit Force card this phase, deal 1 damage to a unit."
//           "Epic Action: If you control 7 or more resources, deploy this leader."
// Deployed: "When Deployed: You may discard your hand. If you do, draw 2 cards."
//
// Force Throw SOR_167 is a non-unit Force card (Event, Force trait).

const FORCE_EVENT = Cards.events.sor.forceThrow;

describe("LOF_012 Rey (leader) — Action: 1 damage to a unit after a non-unit Force card", () => {
  it("deals 1 to a chosen unit once a non-unit Force card was played this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.rey)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithActivePlayer(1)
      .Build();
    // A non-unit Force card was played this phase.
    state.roundState.cardsPlayedThisPhase.push({ fromPlayer: 1, cardId: FORCE_EVENT, playId: "z" });
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("soft-passes when no non-unit Force card was played this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.rey)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithActivePlayer(1)
        .Build(),
    );

    const used = await g.useLeaderAbilityAsync(1);
    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false); // exhausted but soft-passed
  });
});

describe("LOF_012 Rey — Epic Action deploy (7+ resources)", () => {
  it("deploys for free with 7 resources; not with 6", async () => {
    const g7 = new GameTestAdapter();
    g7.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.rey)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
        .WithActivePlayer(1)
        .Build(),
    );
    await g7.deployLeaderAsync(1);
    expect(g7.state.player1.leader.deployed).toBe(true);

    const g6 = new GameTestAdapter();
    g6.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.rey)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithActivePlayer(1)
        .Build(),
    );
    await g6.deployLeaderAsync(1);
    expect(g6.state.player1.leader.deployed).toBe(false);
  });
});

describe("LOF_012 Rey (deployed) — When Deployed: may discard hand, draw 2", () => {
  function deploySetup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.rey)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // hand [0]
      .WithCardInHandForPlayer(1, Cards.units.sor.gamorreanGuards)   // hand [1]
      .WithCardInDeckForPlayer(1, Cards.units.sor.snowspeeder)       // draw
      .WithCardInDeckForPlayer(1, Cards.units.jtl.chimaera)          // draw
      .WithActivePlayer(1);
  }

  it("discards the hand and draws 2 on accept", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deploySetup().Build());

    await g.deployLeaderAsync(1); // fires When Deployed
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand.length).toBe(2); // the 2 drawn cards
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.snowspeeder)).toBe(true);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.jtl.chimaera)).toBe(true);
    expect(g.state.player1.discard.length).toBe(2); // the 2 old hand cards
  });

  it("keeps the hand on decline", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deploySetup().Build());

    await g.deployLeaderAsync(1);
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.length).toBe(2); // unchanged original hand
    expect(g.state.player1.discard.length).toBe(0);
  });
});
