import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_231 Punch It (Event, cost 1) — "Attack with a Vehicle unit. It gets +2/+0 for this attack."
describe("JTL_231 Punch It", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.jtl.punchIt);
  }

  it("a Vehicle unit attacks with +2/+0 for this attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.token.xWing) // 2/2 Vehicle
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0); // attack with the X-Wing
    await g.chooseBaseAsync(1, 2);      // ...the enemy base

    // Power 2 + 2 (Punch It) = 4 to the enemy base.
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("the +2/+0 lasts only for that attack (not permanent)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.token.xWing)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const { Unit } = await import("@/server/engine/unit");
    const xwing = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.token.xWing)!;
    expect(Unit.FromInterface(xwing).CurrentPower()).toBe(2); // back to base power after the attack
  });

  it("control: fizzles when you control no Vehicle unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not a Vehicle
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(0);
  });
});
