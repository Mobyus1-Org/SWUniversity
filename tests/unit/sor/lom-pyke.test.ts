import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_068 Cargo Juggernaut (Lom Pyke) — 4/5 Ground (Vigilance), cost 6
// "Shielded. When Played: If you control another [Vigilance] unit, heal 4 damage from your base."

describe("SOR_068 Cargo Juggernaut", () => {
  it("heals 4 from base when another Vigilance unit is in play", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.idenVersio)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.lomPyke)
      .WithGroundUnitForPlayer(1, Cards.units.sor.systemPatrolCraft) // Vigilance unit
      .Build();
    g.loadNewState(state);

    state.player1.base.damage = 10;

    await g.playCardFromHandAsync(1, 0);

    // Shielded + WP both queue → trigger-order fires; choose WP first to heal
    await g.chooseOptionAsync(1, "Cargo Juggernaut — When Played");
    // Now shielded fires (auto): shield given

    expect(g.state.player1.base.damage).toBe(6); // 10 - 4
  });

  it("does not heal when no other Vigilance unit is in play", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.idenVersio)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.lomPyke)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not Vigilance
      .Build();
    g.loadNewState(state);

    state.player1.base.damage = 10;

    await g.playCardFromHandAsync(1, 0);

    // Shielded + WP both queue → trigger-order; choose WP first (no heal since no Vigilance)
    await g.chooseOptionAsync(1, "Cargo Juggernaut — When Played");

    expect(g.state.player1.base.damage).toBe(10); // unchanged
  });
});
