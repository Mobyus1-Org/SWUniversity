import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Repro for QA bug: uniqueness works when you defeat the copy already in play, but
// breaks when you defeat the copy you just played (the entering unit).
describe("TWI_086 Admiral Trench — defeat the just-played copy", () => {
  it("resolves cleanly when the entering Trench is chosen for defeat", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithGroundUnitForPlayer(1, Cards.units.twi.admiralTrench) // pre-existing copy
      .WithCardInHandForPlayer(1, Cards.units.twi.admiralTrench)
      .Build();
    g.loadNewState(state);

    const oldTrenchPlayId = state.player1.groundArena[0].playId;

    // Play the second Trench, decline Exploit.
    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    // Uniqueness prompt — choose which Trench to defeat.
    let res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Target");

    // The entering (just-played) Trench is the one NOT already in play.
    const enteringTrenchPlayId = g.state.player1.groundArena
      .map(u => u.playId)
      .find(id => id !== oldTrenchPlayId)!;

    // Choose to defeat the entering copy.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enteringTrenchPlayId] });

    // Per CR 8.29.3, the entering Trench's When Played still resolves — it may return the
    // just-defeated copy (defeated this phase) from discard. Decline by returning nothing.
    res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Target");
    expect(res?.type === "Target" && res.fromPlayIds).toContain(enteringTrenchPlayId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    // The old Trench should remain; exactly one Trench in play.
    const trenches = g.state.player1.groundArena.filter(u => u.cardId === Cards.units.twi.admiralTrench);
    expect(trenches).toHaveLength(1);
    expect(trenches[0].playId).toBe(oldTrenchPlayId);
  });
});
