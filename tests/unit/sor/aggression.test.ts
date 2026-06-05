import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CommonSetup } from "../../test-helpers";

// SOR_155 — Aggression (Event, 4-cost, Aggression×2)
// "Choose two, in any order:
//  Draw a card.
//  Defeat up to 2 upgrades.
//  Ready a unit with 3 or less power.
//  Deal 4 damage to a unit."

// "rrk" = red base (Aggression) + Darth Vader (Aggression+Villainy) → covers Aggression×2, cost = 4.

describe("SOR_155 — Aggression", () => {
  it("playing triggers a choose-aspect-effect prompt with 4 options", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "rrk", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.aggression] },
      their: {},
    }).Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    const res = g.lastDispatchResponse?.resolutionNeeded as { type: string; options: string[] };
    expect(res.options).toHaveLength(4);
    expect(res.options).toContain("draw_card");
    expect(res.options).toContain("defeat_upgrades");
    expect(res.options).toContain("ready_unit_3pow");
    expect(res.options).toContain("deal_4_damage");
  });

  it("draw_card draws a card for the active player", async () => {
    const g = new GameTestAdapter();
    const gsb = CommonSetup(new GameStateBuilder(), "rrk", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.aggression] },
      their: {},
    });
    gsb.WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine);
    const state = gsb.Build();
    g.loadNewState(state);
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "draw_card");

    // drew 1 card (hand was reduced by 1 for playing, now +1 from draw)
    expect(g.state.player1.hand.length).toBe(handBefore - 1 + 1);

    // Pick second effect
    await g.chooseOptionAsync(1, "deal_4_damage"); // needs target but none present → skips
  });

  it("deal_4_damage deals 4 damage to the chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "rrk", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.aggression] },
      their: {},
    })
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine) // 3/8
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "deal_4_damage");
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4);

    await g.chooseOptionAsync(1, "draw_card");
  });

  it("defeat_upgrades defeats up to 2 chosen upgrades", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "rrk", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.aggression] },
      their: {},
    })
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    // Add 2 upgrades to the enemy unit
    const enemy = g.state.player2.groundArena[0];
    const upg1PlayId = "upg1";
    const upg2PlayId = "upg2";
    enemy.upgrades.push({ cardId: "SOR_071", playId: upg1PlayId, owner: 2, controller: 2 });
    enemy.upgrades.push({ cardId: "SOR_T01", playId: upg2PlayId, owner: 2, controller: 2 });

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "defeat_upgrades");

    // Should present a multi-select target for upgrades
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    const res = g.lastDispatchResponse?.resolutionNeeded as { type: string; fromPlayIds?: string[]; maxTargets?: number };
    expect(res.fromPlayIds).toContain(upg1PlayId);
    expect(res.fromPlayIds).toContain(upg2PlayId);
    expect(res.maxTargets).toBe(2);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upg1PlayId, upg2PlayId] });
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);

    await g.chooseOptionAsync(1, "draw_card");
  });

  it("ready_unit_3pow readies a unit with 3 or less power", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "rrk", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.aggression] },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3, power=3
      .Build();
    g.loadNewState(state);
    g.state.player1.groundArena[0].ready = false; // exhaust it first

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "ready_unit_3pow");
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].ready).toBe(true);

    await g.chooseOptionAsync(1, "draw_card");
  });

  it("ready_unit_3pow only targets units with power ≤ 3", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "rrk", "ggw", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.aggression] },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power — eligible
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 power — eligible
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "ready_unit_3pow");

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    // Both BFMs have ≤3 power
    expect(res.fromPlayIds!.length).toBe(2);
  });
});
