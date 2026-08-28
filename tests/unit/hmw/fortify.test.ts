import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Fortify — "Attach this to your base, not a unit."
//
// The first upgrade class whose host is the BASE. Everything else about playing an upgrade is
// unchanged; only the legal target set and the attachment destination differ. Critically it must
// be playable with no units on the board at all, which is the case an ordinary upgrade cannot hit.

const SHIELD_GEN = Cards.upgrades.hmw.allianceShieldGenerator;
const TRAP_FIELD = Cards.upgrades.hmw.trapField;
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance/Heroism — covers the upgrade
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, SHIELD_GEN)
    .WithActivePlayer(1);
}

describe("Fortify — upgrades that attach to your base", () => {
  it("attaches to your own base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

    expect(g.state.player1.base.upgrades!.map(u => u.cardId)).toEqual([SHIELD_GEN]);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("is playable with no units in play at all", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build()); // empty arenas

    await g.playCardFromHandAsync(1, 0);

    // An ordinary upgrade would have no legal target here; a Fortify upgrade always has one.
    expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
  });

  it("cannot attach to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
  });

  it("cannot attach to the ENEMY base — 'your base'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.base.upgrades ?? []).toHaveLength(0);
  });

  it("two different Fortify upgrades can sit on the same base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, TRAP_FIELD).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

    expect(g.state.player1.base.upgrades).toHaveLength(2);
  });
});
