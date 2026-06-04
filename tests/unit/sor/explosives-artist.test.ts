import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { CommonSetup } from "../../test-helpers";
import { Cards } from "../../card-helpers";

// SOR_142 — Explosives Artist / Sabine Wren (cost 2, 2/3, Ground, Aggression+Villainy, Unique)
// While there are at least 3 aspects among other friendly units, this unit can't be attacked
//   (unless she gains Sentinel).
// On Attack: You may deal 1 damage to the defender or to a base.
//
// "rrk" = red base (Aggression) + Darth Vader (Aggression+Villainy) — covers both aspects.
// 3-aspect protection: need 3 distinct aspects (e.g. Command + Heroism + Aggression) among other friendlies.

describe("SOR_142 — Explosives Artist (Sabine Wren)", () => {
  it("can be attacked normally when fewer than 3 aspects among friendly units", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    // Only 2 aspects: one Aggression unit — not enough
    const state = CommonSetup(gsb, "rrk", "ggw", { my: {}, their: {} })
      .WithGroundUnitForPlayer(1, Cards.units.sor.explosivesArtist)
      .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper) // Aggression+Villainy (2 aspects)
      .WithGroundUnitForPlayer(2, Cards.units.sor.vanguardInfantry) // attacker
      .Build();
    g.loadNewState(state);
    const artistPlayId = state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "pass-action", {});
    await g.attackWithGroundUnitAsync(2, 0);
    // Should be able to target Explosives Artist
    const resp = g.lastDispatchResponse;
    const resolution = resp?.resolutionNeeded;
    const availableTargets = (resolution?.type === "Target" ? resolution.fromPlayIds : undefined) ?? [];
    expect(availableTargets).toContain(artistPlayId);
  });

  it("cannot be attacked when there are at least 3 distinct aspects among other friendly units", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    // Vanguard Infantry (Command), Battlefield Marine (Command+Heroism), Death Star Stormtrooper (Aggression+Villainy)
    // together provide: Command, Heroism, Aggression, Villainy = 4 distinct aspects among other friendlies
    const state = CommonSetup(gsb, "ggw", "rrk", { my: {}, their: {} })
      .WithGroundUnitForPlayer(1, Cards.units.sor.explosivesArtist)
      .WithGroundUnitForPlayer(1, Cards.units.sor.vanguardInfantry) // Command
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Command+Heroism
      .WithGroundUnitForPlayer(1, Cards.units.sor.deathStarStormtrooper) // Aggression+Villainy
      .WithGroundUnitForPlayer(2, Cards.units.sor.deathTrooper) // attacker
      .Build();
    g.loadNewState(state);
    const artistPlayId = state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "pass-action", {});
    await g.attackWithGroundUnitAsync(2, 0);
    // Explosives Artist should NOT be in the available targets
    const resp = g.lastDispatchResponse;
    const resolution = resp?.resolutionNeeded;
    const availableTargets = (resolution?.type === "Target" ? resolution.fromPlayIds : undefined) ?? [];
    expect(availableTargets).not.toContain(artistPlayId);
  });

  it("on attack: may deal 1 damage to the defender", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "rrk", "ggw", { my: {}, their: {} })
      .WithGroundUnitForPlayer(1, Cards.units.sor.explosivesArtist)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine) // 6 HP, won't die
      .Build();
    g.loadNewState(state);
    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });
    // On Attack: choose to deal 1 damage to the defender
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    const defender = g.state.player2.groundArena.find(u => u.playId === defenderPlayId);
    // Explosives Artist is 2/3, deals 2 combat damage + 1 on-attack = 3 total
    expect(defender?.damage).toBe(3);
  });

  it("on attack: may deal 1 damage to the opponent base instead of the defender", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "rrk", "ggw", { my: {}, their: {} })
      .WithGroundUnitForPlayer(1, Cards.units.sor.explosivesArtist)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .Build();
    g.loadNewState(state);
    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });
    // On Attack: choose to deal 1 damage to the base
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetZones: ["Base"] });

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("on attack: may choose not to deal the bonus damage", async () => {
    const g = new GameTestAdapter();
    const gsb = new GameStateBuilder();
    const state = CommonSetup(gsb, "rrk", "ggw", { my: {}, their: {} })
      .WithGroundUnitForPlayer(1, Cards.units.sor.explosivesArtist)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .Build();
    g.loadNewState(state);
    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });
    // On Attack: choose No (don't deal bonus damage)
    await g.chooseNoAsync(1);

    const defender = g.state.player2.groundArena.find(u => u.playId === defenderPlayId);
    expect(defender?.damage).toBe(2); // only combat damage
  });
});
