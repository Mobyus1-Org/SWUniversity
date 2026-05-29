import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { CommonSetup } from "../../test-helpers";
import { Cards } from "../../card-helpers";

// SOR_036 — Gideon Hask (cost 5, 5/5, Ground, Vigilance+Villainy)
// When an enemy unit is defeated: Give an Experience token to a friendly unit.
// Using "bbk" (blue base, Iden Versio — Vigilance+Villainy) to avoid aspect penalties.

describe("SOR_036 — Gideon Hask", () => {
  it("gives an Experience token to a friendly unit when an enemy unit is defeated in combat", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "bbk", "ggw", { my: {}, their: {} })
      .WithGroundUnitForPlayer(1, Cards.units.sor.gideonHask)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)  // XP target
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // enemy to be killed
      .Build();
    g.loadNewState(state);

    const friendlyMarinePlayId = state.player1.groundArena[1].playId;
    const enemyMarinePlayId = state.player2.groundArena[0].playId;

    // Player 1 attacks with Gideon Hask — he's 5/5, enemy marine is 3/3, so enemy is defeated
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyMarinePlayId] });

    // Gideon Hask's trigger fires — give XP to a friendly unit
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendlyMarinePlayId] });

    const xpTarget = g.state.player1.groundArena.find(u => u.playId === friendlyMarinePlayId);
    expect(xpTarget?.upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
  });

  it("fires when an enemy unit is defeated by an event", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "bbk", "ggw", { my: { resourceCount: 7 }, their: {} })  // Vanquish costs 5 + 2 aspect penalty (no Command/Heroism)
      .WithGroundUnitForPlayer(1, Cards.units.sor.gideonHask)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // to be defeated by event
      .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
      .Build();
    g.loadNewState(state);

    const gideonPlayId = state.player1.groundArena[0].playId;
    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0); // play Vanquish
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    // Gideon Hask fires — give XP to a friendly unit (Gideon himself)
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [gideonPlayId] });

    const gideon = g.state.player1.groundArena.find(u => u.playId === gideonPlayId);
    expect(gideon?.upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
  });

  it("does not fire when a friendly unit is defeated", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "bbk", "ggw", { my: {}, their: {} })
      .WithGroundUnitForPlayer(1, Cards.units.sor.gideonHask)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)  // this will be defeated
      .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)              // 4/4, kills marine
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[1].playId;

    // Player 2 attacks player 1's marine with the wampa
    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [marinePlayId] });

    // Gideon Hask should NOT fire — the defeated unit was a friendly, not an enemy
    const gideon = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.gideonHask);
    expect(gideon?.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience)).toHaveLength(0);
  });
});
