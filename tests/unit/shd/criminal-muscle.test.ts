import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_209 Criminal Muscle (2/1 Ground, cost 1, Cunning, Underworld) —
//   "When Played: You may return a non-unique upgrade to its owner's hand."
//
// "Non-unique" is the restriction that matters, and it is easy to skip: a unique upgrade must not
// be offered. Tokens are upgrades but have no card to return to a hand, so they are excluded too.
//
// It returns to the OWNER's hand, not the caster's — bouncing an enemy upgrade gives it back to
// them, it does not steal it.

const MUSCLE = "SHD_209";
const NON_UNIQUE_UP = "SOR_166";                  // Infiltrator's Skill — non-unique
const MARINE = Cards.units.sor.battlefieldMarine;

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, MUSCLE)
    .WithActivePlayer(1);
}

describe("SHD_209 Criminal Muscle", () => {
  it("returns the chosen upgrade to its OWNER's hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(NON_UNIQUE_UP, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const target = g.state.player2.groundArena[0].upgrades[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [target] });

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
    expect(g.state.player2.hand.map(c => c.cardId)).toContain(NON_UNIQUE_UP); // theirs, not mine
    expect(g.state.player1.hand.map(c => c.cardId)).not.toContain(NON_UNIQUE_UP);
  });

  it("is optional — declining leaves the upgrade attached", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(NON_UNIQUE_UP, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(1);
  });

  it("asks nothing when no non-unique upgrade is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
