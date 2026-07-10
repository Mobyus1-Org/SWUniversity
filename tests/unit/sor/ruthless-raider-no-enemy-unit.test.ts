import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_134 Ruthless Raider — "When Played: Deal 2 to an enemy base and 2 to an enemy unit."
// Same family of bug as TWI_229: the base-damage side effect used to live in resolveWhenPlayed,
// which is called both as a preview (queueUnitEntryTriggers) and on trigger-bag drain. With no
// enemy units (the return-null path), that double-applied the base damage (dealt 4 instead of 2).
describe("SOR_134 Ruthless Raider — When Played with no enemy units", () => {
  it("deals exactly 2 to the enemy base (no double-apply)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.darthVader) // Aggression+Villainy covers both aspects
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithCardInHandForPlayer(1, Cards.units.sor.ruthlessRaider)
        // Opponent controls no units.
        .Build(),
    );

    const before = g.state.player2.base.damage;
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.base.damage - before).toBe(2);
    // Ruthless Raider itself entered play.
    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.sor.ruthlessRaider)).toBe(true);
  });
});
