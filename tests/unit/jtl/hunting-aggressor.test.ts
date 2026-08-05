import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// JTL_165 Hunting Aggressor (3/6 Space, cost 4, Underworld/Vehicle/Transport) —
//   "Indirect damage you deal to opponents is increased by 1."
// A static amount modifier. "to opponents" is load-bearing: indirect damage a player aims at
// themselves is unmodified.
describe("JTL_165 Hunting Aggressor", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16)
      .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage) // base 5
      .WithActivePlayer(1);
  }

  it("increases indirect damage aimed at the opponent by 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, Cards.units.jtl.huntingAggressor).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });

    expect(g.state.player2.base.damage).toBe(6); // 5 + 1
  });

  it("control: without it, the same event deals 5", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });

    expect(g.state.player2.base.damage).toBe(5);
  });

  it("does NOT increase indirect damage you aim at yourself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, Cards.units.jtl.huntingAggressor).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Yourself" });

    // The Aggressor itself is a unit, so the damage must be assigned rather than auto-based.
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: "player1.base", damage: 5 }],
    });
    expect(g.state.player1.base.damage).toBe(5); // not 6
  });

  it("an ENEMY Aggressor does not boost damage aimed at its own controller", async () => {
    const g = new GameTestAdapter();
    const s = base().WithSpaceUnitForPlayer(2, Cards.units.jtl.huntingAggressor).Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [{ playId: "player2.base", damage: 5 }],
    });

    expect(g.state.player2.base.damage).toBe(5); // still 5 — it boosts what YOU deal
  });

  it("two copies stack to +2 — it is not unique", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.huntingAggressor)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.huntingAggressor)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });

    expect(g.state.player2.base.damage).toBe(7); // 5 + 2
  });
});
