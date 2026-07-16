import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_196 — Chewbacca, Loyal Companion (Unit, Cunning/Heroism, cost 5, 3/6)
// "Sentinel
//  When this unit is attacked: Ready him."

describe("SOR_196 — Chewbacca, Loyal Companion", () => {
  it("readies himself when he is attacked", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.chewbacca)
      // Chewbacca starts exhausted so we can observe him readying.
      .WithGroundUnitForPlayer(2, Cards.units.sor.chewbaccaLoyalCompanion, false) // 3/6, exhausted
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3 attacker
      .Build();
    g.loadNewState(state);

    const chewiePlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [chewiePlayId] });

    const chewie = g.state.player2.groundArena.find(u => u.playId === chewiePlayId);
    expect(chewie).toBeDefined();
    expect(chewie?.damage).toBe(3); // survived the 3-power Marine (6 HP)
    expect(chewie?.ready).toBe(true); // readied by his own ability
  });
});
