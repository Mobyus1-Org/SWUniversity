import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SHD_262 Confiscate (Event, cost 1, Cunning) — "Defeat an upgrade."
//
// Unqualified, so either side's upgrades are legal — including your own, and including tokens,
// which are upgrades. The only exclusion is an upgrade protected from enemy abilities, which
// DefeatableUpgradePlayIds already filters.

const CONFISCATE = "SHD_262";
const XP = Cards.upgrades.token.experience;
const MARINE = Cards.units.sor.battlefieldMarine;

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, CONFISCATE)
    .WithActivePlayer(1);
}

describe("SHD_262 Confiscate", () => {
  it("defeats the chosen enemy upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(XP, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const target = g.state.player2.groundArena[0].upgrades[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [target] });

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });

  it("can defeat your OWN upgrade — 'an upgrade' is unqualified", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(XP, 1)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const target = g.state.player1.groundArena[0].upgrades[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [target] });

    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
  });

  it("removing an Experience token drops the host's stats back", async () => {
    // Asserted on the unit directly rather than through a later attack: passing the round out to
    // reach the opponent's turn also lets other things happen, which muddies the number.
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(XP, 2)])
        .Build(),
    );
    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(4); // 3 + 1

    await g.playCardFromHandAsync(1, 0);
    const target = g.state.player2.groundArena[0].upgrades[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [target] });

    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(3);
  });

  it("does nothing when there is no upgrade in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
