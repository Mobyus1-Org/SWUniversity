import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_139 Hold Them Off (Event, cost 4, Command) — "Choose a friendly unit. That unit deals
// damage equal to its power divided as you choose among any number of units in its arena."
//
// Homestead Militia (SOR_113) is 3 power / 4 HP — used as the chosen friendly unit so the
// damage pool is exactly 3. Academy Defense Walker (SOR_037) is 5/5 — big enough to survive a
// share of that pool so post-attack damage can be inspected directly.

describe("ASH_139 Hold Them Off", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.ash.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.ash.holdThemOff);
  }

  it("deals all its power as damage to a single chosen target", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.homesteadMilitia) // 3 power
      .WithGroundUnitForPlayer(2, Cards.units.sor.academyDefenseWalker) // 5 HP — survives
      .Build();
    g.loadNewState(state);
    const militiaPlayId = state.player1.groundArena[0].playId;
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [militiaPlayId] });
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("SpreadDamage");

    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: targetPlayId, damage: 3 }],
    });

    expect(g.state.player2.groundArena.find(u => u.playId === targetPlayId)?.damage).toBe(3);
  });

  it("splits the damage across multiple units in the same arena", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.homesteadMilitia) // 3 power
      .WithGroundUnitForPlayer(2, Cards.units.sor.academyDefenseWalker) // 5 HP
      .WithGroundUnitForPlayer(2, Cards.units.sor.academyDefenseWalker) // 5 HP
      .Build();
    g.loadNewState(state);
    const militiaPlayId = state.player1.groundArena[0].playId;
    const targetAPlayId = state.player2.groundArena[0].playId;
    const targetBPlayId = state.player2.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [militiaPlayId] });

    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: targetAPlayId, damage: 2 },
        { playId: targetBPlayId, damage: 1 },
      ],
    });

    expect(g.state.player2.groundArena.find(u => u.playId === targetAPlayId)?.damage).toBe(2);
    expect(g.state.player2.groundArena.find(u => u.playId === targetBPlayId)?.damage).toBe(1);
  });

  it("only assigned targets take damage — a third eligible unit given 0 is untouched", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.homesteadMilitia) // 3 power
      .WithGroundUnitForPlayer(1, Cards.units.sor.academyDefenseWalker) // friendly, eligible, gets 0
      .WithGroundUnitForPlayer(2, Cards.units.sor.academyDefenseWalker) // gets all 3
      .Build();
    g.loadNewState(state);
    const militiaPlayId = state.player1.groundArena[0].playId;
    const friendlyBystanderPlayId = state.player1.groundArena[1].playId;
    const enemyTargetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [militiaPlayId] });

    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: friendlyBystanderPlayId, damage: 0 },
        { playId: enemyTargetPlayId, damage: 3 },
      ],
    });

    expect(g.state.player1.groundArena.find(u => u.playId === friendlyBystanderPlayId)?.damage).toBe(0);
    expect(g.state.player2.groundArena.find(u => u.playId === enemyTargetPlayId)?.damage).toBe(3);
  });
});
