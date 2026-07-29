import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";

// SHD_005 Hondo Ohnaka (That's Good Business) — 3/7 Ground leader, cost 6.
// FRONT:    When you play a card using Smuggle: You may exhaust this leader. If you do, give an
//           Experience token to a unit.
// DEPLOYED: Raid 1
//           When you play a card using Smuggle: You may give an Experience token to a unit.
//
// Every resource is Collections Starhopper (SHD_111), Smuggle [3, Command] with no other ability.

const xpOn = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(x => x.cardId === Cards.upgrades.token.experience).length;

function frontState(leaderReady = true) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP) // Command — no aspect penalty on the Smuggle cost
    .MyLeader(Cards.leaders.shd.hondoOhnaka, leaderReady)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.shd.collectionsStarhopper, 10)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithActivePlayer(1);
}

describe("SHD_005 Hondo Ohnaka — leader (front) ability", () => {
  it("offers the exhaust when you play a card using Smuggle", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().Build());

    await g.smuggleResourceAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("accepting exhausts the leader and gives an Experience token to a chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().Build());

    await g.smuggleResourceAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("declining leaves the leader ready and gives no token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().Build());

    await g.smuggleResourceAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(xpOn(g.state.player1.groundArena[0])).toBe(0);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("can give the token to an ENEMY unit ('a unit', unrestricted)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards).Build());

    await g.smuggleResourceAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(xpOn(g.state.player2.groundArena[0])).toBe(1);
  });

  it("does not trigger when the leader is already exhausted (it cannot pay)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState(false).Build());

    await g.smuggleResourceAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(xpOn(g.state.player1.groundArena[0])).toBe(0);
  });

  it("does not trigger on a card played normally from hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("does not trigger when the OPPONENT smuggles ('when YOU play')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      frontState()
        .FillResourcesForPlayer(2, Cards.units.shd.collectionsStarhopper, 10)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.smuggleResourceAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("SHD_005 Hondo Ohnaka — deployed leader unit", () => {
  function deployedState() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.hondoOhnaka, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.shd.collectionsStarhopper, 10)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.leaders.shd.hondoOhnaka)
      .WithActivePlayer(1);
  }

  it("has Raid 1", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());

    const u = g.state.player1.groundArena[0];
    expect(RaidAmount(u.cardId, u.playId, 1)).toBe(1);
  });

  it("offers the Experience token on a Smuggle play, with no exhaust cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());

    await g.smuggleResourceAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
    // The deployed side has no "exhaust this leader" cost — Hondo is still ready.
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("declining on the deployed side gives no token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());

    await g.smuggleResourceAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(xpOn(g.state.player1.groundArena[0])).toBe(0);
  });

  it("still triggers while the deployed leader is exhausted (no cost to pay)", async () => {
    const g = new GameTestAdapter();
    const state = deployedState().Build();
    state.player1.groundArena[0].ready = false;
    g.loadNewState(state);

    await g.smuggleResourceAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });
});
