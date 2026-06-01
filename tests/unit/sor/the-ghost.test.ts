import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_050 The Ghost (Spectre Home Base) — 4/6 Space (Vigilance+Heroism), cost 6
// "Shielded. When Played/On Attack: You may give a Shield token to another SPECTRE unit."
// WP is interactive (returns immediately), Shielded stays in bag until WP resolves.

describe("SOR_050 The Ghost", () => {
  it("When Played: gives Shield to chosen Spectre unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.theGhost)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .Build();
    g.loadNewState(state);

    const kananPlayId = state.player1.groundArena[0].playId;

    // WP fires immediately (interactive) since Kanan is a Spectre unit
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [kananPlayId] });

    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === "SOR_T02")).toBe(true);
  });

  it("When Played: no prompt if no other Spectre units (returns auto-resolve)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.theGhost)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not Spectre
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    // WP auto-resolves (no Spectres) → trigger-order fires for [shielded, WP]
    // Choose WP first (auto-resolves with no effect), then shielded fires
    await g.chooseOptionAsync(1, "The Ghost — When Played");

    // No shield on marine (not a spectre and WP had no effect)
    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === "SOR_T02")).toBe(false);
  });

  it("On Attack: gives Shield to chosen Spectre unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.theGhost)
      .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
      .Build();
    g.loadNewState(state);

    const kananPlayId = state.player1.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // On Attack fires: optional Shield to Spectre
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [kananPlayId] });

    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === "SOR_T02")).toBe(true);
  });
});
