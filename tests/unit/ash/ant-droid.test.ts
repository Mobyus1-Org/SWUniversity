import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_116 Ant Droid — 1/2 Ground, Command, Droid.
// "When Defeated: Draw a card."
describe("ASH_116 Ant Droid", () => {
  it("draws a card when defeated in combat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.ash.antDroid)          // 1/2 attacker
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // SOR_095, 3/3 → counter-kills Ant Droid
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    const handBefore = g.state.player1.hand.length;
    const deckBefore = g.state.player1.deck.length;
    const enemyPlayId = g.state.player2.groundArena[0].playId;

    // Ant Droid attacks the 3-power Marine; counter-damage (3) defeats the 2-HP Ant Droid.
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    // Ant Droid is gone from the arena...
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.ash.antDroid)).toBe(false);
    // ...and its When Defeated drew exactly one card.
    expect(g.state.player1.hand.length).toBe(handBefore + 1);
    expect(g.state.player1.deck.length).toBe(deckBefore - 1);
  });
});
