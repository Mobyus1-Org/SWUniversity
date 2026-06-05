import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CommonSetup } from "../../test-helpers";

// SOR_203 — Cunning (Event, 4-cost, Cunning×2)
// "Choose two, in any order:
//  Return a non-leader unit with 4 or less power to its owner's hand.
//  Give a unit +4/+0 for this phase.
//  Exhaust up to 2 units.
//  An opponent discards a random card from their hand."

// "yyw" = yellow base (Cunning) + Han Solo (Cunning+Heroism) → covers Cunning×2, cost = 4.

describe("SOR_203 — Cunning", () => {
  it("playing triggers a choose-aspect-effect prompt with 4 options", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "yyw", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.cunning] },
      their: {},
    }).Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    const res = g.lastDispatchResponse?.resolutionNeeded as { type: string; options: string[] };
    expect(res.options).toHaveLength(4);
    expect(res.options).toContain("bounce_unit_4pow");
    expect(res.options).toContain("buff_4_attack");
    expect(res.options).toContain("exhaust_2_units");
    expect(res.options).toContain("random_discard");
  });

  it("random_discard makes opponent discard a random card", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "yyw", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.cunning] },
      their: { handCardIds: [Cards.units.sor.battlefieldMarine] },
    }).Build();
    g.loadNewState(state);
    const oppHandBefore = g.state.player2.hand.length;
    const oppDiscardBefore = g.state.player2.discard.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "random_discard");

    // After auto-resolve, opponent's hand shrinks by 1 and discard grows by 1
    expect(g.state.player2.hand.length).toBe(oppHandBefore - 1);
    expect(g.state.player2.discard.length).toBe(oppDiscardBefore + 1);

    // Should now be at second pick prompt
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    const res = g.lastDispatchResponse?.resolutionNeeded as { options: string[] };
    expect(res.options).toHaveLength(3);

    await g.chooseOptionAsync(1, "random_discard"); // can't pick same one
  });

  it("random_discard does nothing if opponent has no cards in hand", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "yyw", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.cunning] },
      their: {},
    }).Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "random_discard");

    // No error, just auto-resolves
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("bounce_unit_4pow returns a non-leader unit ≤4 power to owner's hand", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "yyw", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.cunning] },
      their: {},
    })
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 power — eligible
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "bounce_unit_4pow");
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);

    await g.chooseOptionAsync(1, "random_discard");
  });

  it("bounce_unit_4pow only targets non-leader units with 4 or less power", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "yyw", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.cunning] },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power — eligible
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 power — eligible, not a leader
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "bounce_unit_4pow");

    // Both BFMs are ≤4 power and neither is a leader
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds!.length).toBe(2);
  });

  it("buff_4_attack gives a unit +4/+0 for this phase", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "yyw", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.cunning] },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "buff_4_attack");
    await g.chooseGroundUnitAsync(1, 0);

    // BFM should now have +4 power (3 + 4 = 7) from a Phase-duration current effect
    const effects = g.state.currentEffects.filter(e => e.cardId === "SOR_203" && e.targetPlayId === g.state.player1.groundArena[0].playId);
    expect(effects.length).toBeGreaterThan(0);

    await g.chooseOptionAsync(1, "random_discard");
  });

  it("exhaust_2_units exhausts up to 2 chosen units", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "yyw", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.cunning] },
      their: {},
    })
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "exhaust_2_units");

    const res = g.lastDispatchResponse?.resolutionNeeded as { maxTargets?: number };
    expect(res.maxTargets).toBe(2);

    const p1 = g.state.player2.groundArena[0].playId;
    const p2 = g.state.player2.groundArena[1].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [p1, p2] });

    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(g.state.player2.groundArena[1].ready).toBe(false);

    await g.chooseOptionAsync(1, "random_discard");
  });
});
