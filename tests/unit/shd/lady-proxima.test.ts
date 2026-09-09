import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// SHD_255 Lady Proxima — White Worm Matriarch. Cost 1, -/4 Ground Underworld, unique.
//   "When you play another Underworld card: You may deal 1 damage to a base."
//
// "Card", not "unit", so an Underworld upgrade or event triggers her too. "Another" excludes her
// own entry, and it is YOUR plays only.

const PROXIMA = Cards.units.shd.ladyProxima;
const UNDERWORLD_UNIT = "SHD_257";   // Underworld Thug, cost 2, vanilla
const PLAIN_UNIT = "ASH_190";        // Peridea Bandit, cost 2, not Underworld
const MARINE = Cards.units.sor.battlefieldMarine;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20)
    .WithGroundUnitForPlayer(1, PROXIMA);
}

describe("SHD_255 Lady Proxima — White Worm Matriarch", () => {
  it("deals 1 to the chosen base when you play another Underworld card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, UNDERWORLD_UNIT).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("is optional", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, UNDERWORLD_UNIT).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("can be aimed at either base — the text says 'a base'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, UNDERWORLD_UNIT).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds ?? []).toEqual(
      expect.arrayContaining(["player1.base", "player2.base"]),
    );
  });

  it("fires for an Underworld EVENT too — the clause says CARD, not unit", async () => {
    const g = new GameTestAdapter();
    // SHD_229 Ma Klounkee is an Underworld event; it needs a friendly unit to target, and
    // Proxima herself is one.
    g.loadNewState(base().WithCardInHandForPlayer(1, "SHD_229").Build());

    await g.playCardFromHandAsync(1, 0);
    // Ma Klounkee resolves its own target first; Proxima's reaction follows in the trigger bag.
    const res = g.lastDispatchResponse?.resolutionNeeded;
    if (res?.type === "Target") {
      await g.dispatchAsync(1, "choose-target", {
        targetPlayIds: [g.state.player1.groundArena[0].playId],
      });
    }
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("does not fire for a NON-Underworld card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, PLAIN_UNIT).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("does not fire off her OWN entry into play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .FillResourcesForPlayer(1, MARINE, 20)
        .WithCardInHandForPlayer(1, PROXIMA)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("does not fire when the OPPONENT plays an Underworld card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(2, UNDERWORLD_UNIT).WithActivePlayer(2).Build());

    await g.playCardFromHandAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
  });
});
