import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_002 Grand Admiral Thrawn — ...How Unfortunate (4/7 Ground, Vigilance/Villainy, cost 6)
// Leader:   "When you use a 'When Defeated' ability: You may exhaust this leader.
//            If you do, use that ability again."
// Deployed: "When you use a 'When Defeated' ability: You may use that ability again.
//            Use this ability only once each round."
//
// K-2SO (SOR_145) is the test subject: "When Defeated: For each opponent, choose one:
// deal 3 damage to that player's base, or that player discards a card from their hand."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.jtl.grandAdmiralThrawn)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 20)
    .WithGroundUnitForPlayer(1, Cards.units.sor.k2so) // your unit → its WD ability is YOURS
    .WithCardInHandForPlayer(2, Cards.events.sor.vanquish); // player 2 kills it
}

describe("JTL_002 Grand Admiral Thrawn — Leader ability", () => {
  it("exhausts the leader to use a When Defeated ability a second time", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithActivePlayer(2).Build());
    expect(g.state.player1.leader.ready).toBe(true);

    await g.playCardFromHandAsync(2, 0); // Vanquish
    await g.chooseGroundUnitAsync(1, 0); // defeat K-2SO

    // First use of K-2SO's When Defeated.
    await g.chooseOptionAsync(1, "deal_base_damage=2,3");
    // Thrawn: "You may exhaust this leader. If you do, use that ability again."
    await g.chooseYesAsync(1);
    // Second use of the same ability.
    await g.chooseOptionAsync(1, "deal_base_damage=2,3");

    expect(g.state.player2.base.damage).toBe(6); // 3 + 3 — the ability was used twice
    expect(g.state.player1.leader.ready).toBe(false); // exhausted as the cost
  });

  it("declining uses the ability only once and leaves the leader ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithActivePlayer(2).Build());

    await g.playCardFromHandAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseOptionAsync(1, "deal_base_damage=2,3");

    // The Thrawn prompt must actually appear, or "No" would be a silent no-op.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(3); // used once
    expect(g.state.player1.leader.ready).toBe(true); // not exhausted
  });

  it("the second use is a fresh choice — you may pick the other mode", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithActivePlayer(2)
        .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine) // something to discard
        .Build(),
    );

    await g.playCardFromHandAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseOptionAsync(1, "deal_base_damage=2,3"); // first: damage
    await g.chooseYesAsync(1);
    await g.chooseOptionAsync(1, "player_discards_from_hand=2,1"); // second: discard instead
    await g.chooseCardFromHandAsync(2, 0);

    expect(g.state.player2.base.damage).toBe(3); // only the first mode dealt damage
    expect(g.state.player2.hand).toHaveLength(0); // and the second made them discard
  });

  it("is not offered when the leader is already exhausted (it is the cost)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.jtl.grandAdmiralThrawn, false) // exhausted
        .WithActivePlayer(2)
        .Build(),
    );

    await g.playCardFromHandAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseOptionAsync(1, "deal_base_damage=2,3");

    expect(g.state.player2.base.damage).toBe(3); // used once, no replay offered
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("does not trigger off an OPPONENT's When Defeated ability", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.grandAdmiralThrawn)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
        .WithGroundUnitForPlayer(2, Cards.units.sor.k2so) // THEIR unit → THEIR ability
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseOptionAsync(2, "deal_base_damage=1,3"); // player 2 aims K-2SO at player 1

    expect(g.state.player1.base.damage).toBe(3); // used once
    expect(g.state.player1.leader.ready).toBe(true); // Thrawn was never offered
  });
});

describe("JTL_002 Grand Admiral Thrawn — Epic Action", () => {
  it("deploys when you control 6 or more resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.grandAdmiralThrawn)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .Build(),
    );

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(
      g.state.player1.groundArena.some(u => u.cardId === Cards.leaders.jtl.grandAdmiralThrawn),
    ).toBe(true);
  });

  it("cannot deploy with fewer than 6 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.grandAdmiralThrawn)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .Build(),
    );

    const result = await g.deployLeaderAsync(1);

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.leader.deployed).toBe(false);
  });
});

describe("JTL_002 Grand Admiral Thrawn — Deployed leader unit", () => {
  function deployedSetup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.jtl.grandAdmiralThrawn, true, true) // deployed
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 20)
      .WithGroundUnitForPlayer(1, Cards.units.sor.k2so)
      .WithCardInHandForPlayer(2, Cards.events.sor.vanquish)
      .WithActivePlayer(2);
  }

  it("replays a When Defeated ability without exhausting anything", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());

    await g.playCardFromHandAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseOptionAsync(1, "deal_base_damage=2,3");
    await g.chooseYesAsync(1);
    await g.chooseOptionAsync(1, "deal_base_damage=2,3");

    expect(g.state.player2.base.damage).toBe(6); // used twice
    expect(g.state.player1.leader.ready).toBe(true); // no exhaust cost when deployed
  });

  it("can only be used once each round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      deployedSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.k2so) // a SECOND K-2SO
        .WithCardInHandForPlayer(2, Cards.events.sor.vanquish) // and a second Vanquish
        .Build(),
    );

    // First K-2SO dies → Thrawn replays.
    await g.playCardFromHandAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseOptionAsync(1, "deal_base_damage=2,3");
    await g.chooseYesAsync(1);
    await g.chooseOptionAsync(1, "deal_base_damage=2,3");
    expect(g.state.player2.base.damage).toBe(6);

    // Second K-2SO dies this same round → no replay offered.
    await g.dispatchAsync(1, "pass-action", {});
    await g.playCardFromHandAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseOptionAsync(1, "deal_base_damage=2,3");

    expect(g.state.player2.base.damage).toBe(9); // 6 + 3 only — used once, not replayed
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
