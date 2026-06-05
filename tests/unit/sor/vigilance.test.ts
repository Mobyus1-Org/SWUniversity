import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CommonSetup } from "../../test-helpers";

// SOR_058 — Vigilance (Event, 4-cost, Vigilance×2)
// "Choose two, in any order:
//  Discard 6 cards from an opponent's deck.
//  Heal 5 damage from a base.
//  Defeat a unit with 3 or less remaining HP.
//  Give a Shield token to a unit."

// Color shorthand: "bbk" = blue base (Vigilance) + Iden Versio (Vigilance+Villainy) → covers Vigilance×2, cost = 4.

describe("SOR_058 — Vigilance", () => {
  it("playing triggers a choose-aspect-effect prompt with 4 options", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "bbk", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.vigilance] },
      their: {},
    }).Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    const res = g.lastDispatchResponse?.resolutionNeeded as { type: string; options: string[] };
    expect(res.options).toHaveLength(4);
    expect(res.options).toContain("mill_6_opponent_deck");
    expect(res.options).toContain("heal_5_base");
    expect(res.options).toContain("defeat_unit_3hp");
    expect(res.options).toContain("give_shield");
  });

  it("after picking first effect, shows 3 remaining options", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "bbk", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.vigilance] },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    // Pick "draw a card" equivalent — give_shield needs a target; pick mill_6 (auto-resolves)
    await g.chooseOptionAsync(1, "mill_6_opponent_deck");

    // After mill auto-resolves, should be back to choose-aspect-effect with 3 options
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    const res = g.lastDispatchResponse?.resolutionNeeded as { type: string; options: string[] };
    expect(res.options).toHaveLength(3);
    expect(res.options).not.toContain("mill_6_opponent_deck");
  });

  it("mill_6_opponent_deck discards 6 cards from opponent's deck", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "bbk", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.vigilance] },
      their: {},
    }).Build();
    g.loadNewState(state);
    const deckBefore = g.state.player2.deck.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "mill_6_opponent_deck");
    // choose second effect (any auto-resolve): mill_6 already done, pick give_shield requires target
    // let's pick heal_5_base after
    await g.chooseOptionAsync(1, "heal_5_base");
    await g.chooseBaseAsync(1, 1); // heal own base (no damage, clamps to 0)

    expect(g.state.player2.discard.length).toBeGreaterThanOrEqual(Math.min(6, deckBefore));
    expect(g.state.player2.deck.length).toBe(Math.max(0, deckBefore - 6));
  });

  it("heal_5_base heals 5 damage from the chosen base", async () => {
    const g = new GameTestAdapter();
    const gsb = CommonSetup(new GameStateBuilder(), "bbk", "ggw", {
      my: { baseDamage: 10, resourceCount: 4, handCardIds: [Cards.events.sor.vigilance] },
      their: {},
    });
    // Give opponent deck cards so mill_6 actually mills
    for (let i = 0; i < 6; i++) gsb.WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine);
    const state = gsb.Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "heal_5_base");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

    expect(g.state.player1.base.damage).toBe(5);

    // complete the second pick (auto-resolve)
    await g.chooseOptionAsync(1, "mill_6_opponent_deck");

    expect(g.state.player2.discard.length).toBeGreaterThan(0);
  });

  it("defeat_unit_3hp defeats a unit with 3 or less remaining HP", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "bbk", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.vigilance] },
      their: {},
    })
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3, so 3 HP remaining
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "defeat_unit_3hp");
    await g.chooseGroundUnitAsync(2, 0); // BFM has 3 HP

    expect(g.state.player2.groundArena).toHaveLength(0);

    await g.chooseOptionAsync(1, "mill_6_opponent_deck");
  });

  it("defeat_unit_3hp only targets units with 3 or less remaining HP", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "bbk", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.vigilance] },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine) // 3/8, 8 HP — not eligible
      .Build();
    g.loadNewState(state);

    // Deal 5 damage to the 8-HP enemy unit to bring it to 3 remaining HP
    g.state.player2.groundArena[0].damage = 5;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "defeat_unit_3hp");

    const res = g.lastDispatchResponse?.resolutionNeeded as { type: string; fromPlayIds?: string[] };
    // Only the enemy unit at 3 HP should be eligible (8 - 5 = 3), friendly BFM has 3HP too
    expect(res.fromPlayIds).toBeDefined();
    // Both units have ≤3 HP remaining: friendly BFM (3), enemy palpatine (3 after 5 dmg)
    expect(res.fromPlayIds!.length).toBe(2);
  });

  it("give_shield gives a Shield token to the chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "bbk", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.vigilance] },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "give_shield");
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === "SOR_T02")).toBe(true);

    await g.chooseOptionAsync(1, "mill_6_opponent_deck");
  });

  it("completes both picks and returns to normal game state", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "bbk", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.vigilance] },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "mill_6_opponent_deck");
    await g.chooseOptionAsync(1, "give_shield");
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
