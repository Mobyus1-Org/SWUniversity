import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_188 Galvanized Leap (Event, cost 4) — "Ready a unit that was damaged this phase."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_188 Galvanized Leap", () => {
  it("readies a unit that took combat damage this phase", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.t6Shuttle1974) // 2/6 — survives the counter
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft) // 3/4 — counters for 3
      .WithCardInHandForPlayer(1, Cards.events.ash.galvanizedLeap)
      .Build();
    g.loadNewState(state);

    const shuttlePlayId = state.player1.spaceArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    const shuttleAfterAttack = g.state.player1.spaceArena.find(u => u.playId === shuttlePlayId)!;
    expect(shuttleAfterAttack.ready).toBe(false); // exhausted from attacking
    expect(shuttleAfterAttack.damage).toBe(3); // took the counter-damage

    // Attacking spent player 1's action — pass player 2's turn back to reach player 1 again.
    await g.dispatchAsync(2, "pass-action", {});

    const handIdx = g.state.player1.hand.findIndex(c => c.cardId === Cards.events.ash.galvanizedLeap);
    await g.playCardFromHandAsync(1, handIdx);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [shuttlePlayId] });

    const shuttleAfterReady = g.state.player1.spaceArena.find(u => u.playId === shuttlePlayId)!;
    expect(shuttleAfterReady.ready).toBe(true);
  });

  it("does not offer a unit that was never damaged this phase (control)", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.t6Shuttle1974)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .WithCardInHandForPlayer(1, Cards.events.ash.galvanizedLeap)
      .Build();
    g.loadNewState(state);

    const shuttlePlayId = state.player1.spaceArena[0].playId;

    const handIdx = g.state.player1.hand.findIndex(c => c.cardId === Cards.events.ash.galvanizedLeap);
    const played = await g.playCardFromHandAsync(1, handIdx);

    // Nobody has been damaged this phase — the event has no legal target and fizzles silently.
    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    const shuttle = g.state.player1.spaceArena.find(u => u.playId === shuttlePlayId)!;
    expect(shuttle.ready).toBe(true); // untouched
  });

  it("rejects targeting a unit that wasn't damaged this phase", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.t6Shuttle1974)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, false) // exhausted, but undamaged
      .WithCardInHandForPlayer(1, Cards.events.ash.galvanizedLeap)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;
    const shuttlePlayId = state.player1.spaceArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.dispatchAsync(2, "pass-action", {});

    const handIdx = g.state.player1.hand.findIndex(c => c.cardId === Cards.events.ash.galvanizedLeap);
    await g.playCardFromHandAsync(1, handIdx);
    const resp = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(resp.lastDispatchResponse?.invalidAction).toBe(true);
    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId)!;
    expect(marine.ready).toBe(false); // still exhausted — the event was rejected, not applied

    // The actually-damaged shuttle remains a valid, separate target.
    const stillEligible = g.state.player1.spaceArena.find(u => u.playId === shuttlePlayId)!;
    expect(stillEligible.damage).toBeGreaterThan(0);
  });
});
