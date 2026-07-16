import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_079 Confederate Courier (2/1 Space) — "When Defeated: Create a Battle Droid token."
describe("TWI_079 Confederate Courier", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(2);
  }

  it("creates a Battle Droid token for its controller when defeated in combat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.twi.confederateCourier) // 2/1, dies to the X-Wing
        .WithSpaceUnitForPlayer(2, Cards.units.token.xWing)            // 2/2 attacker
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0); // attack the Courier

    // Courier is gone; its controller (player 1) gains one Battle Droid token (Ground).
    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.twi.confederateCourier)).toBe(false);
    const droids = g.state.player1.groundArena.filter(u => u.cardId === Cards.units.token.battleDroid);
    expect(droids).toHaveLength(1);
  });

  it("control: defeating a non-Courier unit creates no Battle Droid token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.token.tieFighter) // 1/1, dies to the X-Wing
        .WithSpaceUnitForPlayer(2, Cards.units.token.xWing)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.token.battleDroid)).toBe(false);
  });
});
