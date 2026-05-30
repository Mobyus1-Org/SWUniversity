import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_246 Grogu — Hidden. Action [Exhaust]: Heal up to 2 damage from a unit.
// If you do, deal that much damage to a unit.
// Aspects: Heroism. chirrutImwe (Vigilance+Heroism) covers it.

describe("LOF_246 Grogu", () => {
  it("heals a unit and deals that amount to a chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.lof.grogu) // action source
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2) // heal source
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // damage target
      .Build();
    g.loadNewState(state);

    const groguPlayId = state.player1.groundArena[0].playId;
    const healSourcePlayId = state.player1.groundArena[1].playId;
    const damageTargetPlayId = state.player2.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.lof.grogu, playId: groguPlayId });
    // Step 1: heal up to 2 from a unit
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: healSourcePlayId, damage: 2 }],
    });
    // Step 2: deal 2 to a unit
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: damageTargetPlayId, damage: 2 }],
    });

    expect(g.state.player1.groundArena[1].damage).toBe(0); // healed
    expect(g.state.player2.groundArena[0].damage).toBe(2); // damaged
  });

  it("skips damage step when player heals nothing", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.lof.grogu)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const groguPlayId = state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.lof.grogu, playId: groguPlayId });
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [], // heal 0
    });

    // "If you do" — healed nothing, so no damage
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("exhausts Grogu after use", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.lof.grogu)
      .Build();
    g.loadNewState(state);

    const groguPlayId = state.player1.groundArena[0].playId;
    // Grogu enters ready (exhausted on play due to Sentinel/other rules? No, just enters)
    // Force it to be ready
    g.state.player1.groundArena[0].ready = true;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.lof.grogu, playId: groguPlayId });
    await g.dispatchAsync(1, "choose-target", { spreadDamageAssignments: [] });

    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});
