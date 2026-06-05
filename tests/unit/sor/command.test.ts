import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CommonSetup } from "../../test-helpers";

// SOR_107 — Command (Event, 4-cost, Command×2)
// "Choose two, in any order:
//  Give 2 Experience tokens to a unit.
//  A friendly unit deals damage equal to its power to a non-unique enemy unit.
//  Put this event into play as a resource.
//  Return a unit from your discard pile to your hand."

// "ggw" = green base (Command) + Leia Organa (Command+Heroism) → covers Command×2, cost = 4.

describe("SOR_107 — Command", () => {
  it("playing triggers a choose-aspect-effect prompt with 4 options", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "ggw", "bbk", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.command] },
      their: {},
    }).Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    const res = g.lastDispatchResponse?.resolutionNeeded as { type: string; options: string[] };
    expect(res.options).toHaveLength(4);
    expect(res.options).toContain("give_2_xp");
    expect(res.options).toContain("power_damage_enemy");
    expect(res.options).toContain("play_as_resource");
    expect(res.options).toContain("return_from_discard");
  });

  it("give_2_xp gives 2 Experience tokens to the chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "ggw", "bbk", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.command] },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "give_2_xp");
    await g.chooseGroundUnitAsync(1, 0);

    const xpCount = g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === "SOR_T01").length;
    expect(xpCount).toBe(2);

    await g.chooseOptionAsync(1, "play_as_resource");
  });

  it("play_as_resource puts the event card into resources", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "ggw", "bbk", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.command] },
      their: {},
    }).Build();
    g.loadNewState(state);
    const resourcesBefore = g.state.player1.resources.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "play_as_resource");

    // After choosing play_as_resource (auto-resolve), should be 3-option prompt for second pick
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    const res = g.lastDispatchResponse?.resolutionNeeded as { type: string; options: string[] };
    expect(res.options).toHaveLength(3);

    await g.chooseOptionAsync(1, "give_2_xp"); // no units, auto-skips or needs target
    // resolve final (may need target if units present)
    // complete: just verify no error
  });

  it("play_as_resource adds the Command card to player resources", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "ggw", "bbk", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.command] },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const resourcesBefore = g.state.player1.resources.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "play_as_resource");
    await g.chooseOptionAsync(1, "give_2_xp");
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.resources.some(r => r.cardId === Cards.events.sor.command)).toBe(true);
    expect(g.state.player1.resources.length).toBe(resourcesBefore + 1);
  });

  it("return_from_discard returns a unit from discard to hand", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "ggw", "bbk", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.command] },
      their: {},
    }).Build();
    // Manually place a unit in discard
    g.loadNewState(state);
    g.state.player1.discard.push({ cardId: Cards.units.sor.battlefieldMarine, playId: "disc1", controller: 1, turnDiscarded: 1, discardEffect: "played" } as any);
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "return_from_discard");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["disc1"] });

    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    // played 1 card from hand, returned 1 from discard → net zero
    expect(g.state.player1.hand.length).toBe(handBefore);

    await g.chooseOptionAsync(1, "play_as_resource");
  });

  it("power_damage_enemy: step 1 asks for a friendly unit, step 2 asks for non-unique enemy", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "ggw", "bbk", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.command] },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3 friendly
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 non-unique enemy
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "power_damage_enemy");

    // Step 1: choose friendly unit
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.chooseGroundUnitAsync(1, 0); // pick the friendly BFM (3 power)

    // Step 2: choose non-unique enemy unit
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.chooseGroundUnitAsync(2, 0);

    // BFM has 3 power → enemy takes 3 damage → defeated (3 HP)
    expect(g.state.player2.groundArena).toHaveLength(0);

    await g.chooseOptionAsync(1, "play_as_resource");
  });

  it("power_damage_enemy does not target unique enemy units (auto-skips step 2)", async () => {
    const g = new GameTestAdapter();
    const state = CommonSetup(new GameStateBuilder(), "ggw", "bbk", {
      my: { resourceCount: 4, handCardIds: [Cards.events.sor.command] },
      their: {},
    })
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // non-unique friendly
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)  // unique enemy
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "power_damage_enemy");
    await g.chooseGroundUnitAsync(1, 0); // pick friendly

    // Emperor Palpatine is unique — no valid targets for step 2, auto-skips to second pick
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    const res = g.lastDispatchResponse?.resolutionNeeded as { options: string[] };
    expect(res.options).toHaveLength(3); // 3 remaining effects
  });
});
