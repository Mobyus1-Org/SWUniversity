import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_125 Air Superiority (Event, cost 2, Command, Tactic)
//   "If you control more space units than an opponent, deal 4 damage to a ground unit that
//    opponent controls."
//
// The space-unit comparison is a condition, not a cost: failing it still plays (and discards) the
// event, it simply does nothing.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command — no aspect penalty on a Command event
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.jtl.airSuperiority);
}

describe("JTL_125 Air Superiority", () => {
  it("deals 4 damage to a chosen enemy ground unit when you have more space units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 — survives 4
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4);
  });

  it("does nothing when the space count is only TIED", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("does nothing when the opponent has MORE space units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("only THAT opponent's ground units are targetable — not your own", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);

    const res = played.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player2.groundArena[0].playId);
    expect(res.fromPlayIds).not.toContain(g.state.player1.groundArena[0].playId);
  });

  it("space units count even when the enemy has none at all", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 — dies to 4
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("no prompt when the opponent controls no ground unit to hit (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
