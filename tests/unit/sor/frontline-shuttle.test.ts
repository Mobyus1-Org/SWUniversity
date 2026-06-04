import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { CommonSetup } from "../../test-helpers";
import { Cards } from "../../card-helpers";

// SOR_110 — Frontline Shuttle (cost 2, 1/3, Space, Command, Vehicle/Transport)
// Action [defeat this unit]: Attack with a unit, even if it's exhausted.
//   It can't attack bases for this attack.
//
// "ggk" = Command Center base + Grand Moff Tarkin — covers Command aspect (cost 2 no penalty).

describe("SOR_110 — Frontline Shuttle", () => {
  it("action ability appears when Frontline Shuttle is in play", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggk", "rrw", { my: {}, their: {} })
      .WithSpaceUnitForPlayer(1, Cards.units.sor.frontlineShuttle)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.patrollingVWing) // attacker
      .Build();
    g.loadNewState(state);
    const shuttlePlayId = state.player1.spaceArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.frontlineShuttle, playId: shuttlePlayId });

    expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });

  it("defeats the shuttle when the action is used", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggk", "rrw", { my: {}, their: {} })
      .WithSpaceUnitForPlayer(1, Cards.units.sor.frontlineShuttle)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.patrollingVWing)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.patrollingVWing)
      .Build();
    g.loadNewState(state);
    const shuttlePlayId = state.player1.spaceArena[0].playId;
    const attackerPlayId = state.player1.spaceArena[1].playId;
    const defenderPlayId = state.player2.spaceArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.frontlineShuttle, playId: shuttlePlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [attackerPlayId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    expect(g.state.player1.spaceArena.some(u => u.playId === shuttlePlayId)).toBe(false);
  });

  it("allows attacking with an exhausted unit", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "ggk", "rrw", { my: {}, their: {} })
      .WithSpaceUnitForPlayer(1, Cards.units.sor.frontlineShuttle)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.patrollingVWing, false) // exhausted
      .WithSpaceUnitForPlayer(2, Cards.units.sor.patrollingVWing)
      .Build();
    g.loadNewState(state);
    const shuttlePlayId = state.player1.spaceArena[0].playId;
    const exhaustedAttackerPlayId = state.player1.spaceArena[1].playId;
    const defenderPlayId = state.player2.spaceArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.frontlineShuttle, playId: shuttlePlayId });
    // Choose the exhausted unit as attacker
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [exhaustedAttackerPlayId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    // Attack should succeed — 1-power vs 1-HP V-Wing: both units defeated
    expect(g.state.player2.spaceArena.some(u => u.playId === defenderPlayId)).toBe(false);
  });

  it("cannot attack a base with this action", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    // No enemy units in space — only target would be base if it were allowed
    const state = CommonSetup(gsb, "ggk", "rrw", { my: {}, their: {} })
      .WithSpaceUnitForPlayer(1, Cards.units.sor.frontlineShuttle)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.patrollingVWing)
      .Build();
    g.loadNewState(state);
    const shuttlePlayId = state.player1.spaceArena[0].playId;
    const attackerPlayId = state.player1.spaceArena[1].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.frontlineShuttle, playId: shuttlePlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [attackerPlayId] });
    // Try to attack base — should be rejected
    await g.dispatchAsync(1, "choose-target", { targetZones: ["Base"] });

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
