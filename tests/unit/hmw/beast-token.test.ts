import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// HMW_T03 Beast token (3/3 Ground Creature) — created by Tarfful, Beast Lair, Easy Prey, Poggle…
//
// A token is not a card: when it leaves play it ceases to exist rather than going to a discard
// pile, a hand, or under a captor (CR 7.6.1 / 8.33). Pins that the Beast is on the token list.

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
    .WithActivePlayer(1);
}

describe("HMW_T03 Beast token", () => {
  it("is recognised as a token unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, Cards.units.token.beast).Build());

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).IsTokenUnit()).toBe(true);
  });

  it("a defeated Beast ceases to exist instead of going to the discard pile", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3 trades with the Beast
        .WithGroundUnitForPlayer(2, Cards.units.token.beast)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.discard.some(c => c.cardId === Cards.units.token.beast)).toBe(false);
    // Control: the real card that traded with it does go to its owner's discard.
    expect(g.state.player1.discard.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
  });
});
