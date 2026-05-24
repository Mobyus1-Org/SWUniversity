import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SHD_126 The Darksaber — aspect penalty exemption", () => {
  it("waives aspect penalty when player has a friendly Mandalorian to attach to", async () => {
    // Darksaber costs 4 and requires Command aspect.
    // Darth Vader leader provides Aggression+Villainy; blue30HP base provides Vigilance.
    // No Command provided — normally +2 penalty = 6 total cost.
    // With the exemption active (Mandalorian in play), should succeed with exactly 4 resources.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)           // Vigilance only, no Command
      .MyLeader(Cards.leaders.sor.darthVader)         // Aggression+Villainy, no Command
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4) // exactly 4 ready resources
      .WithGroundUnitForPlayer(1, Cards.units.shd.theMandalorian)      // friendly Mandalorian target
      .WithCardInHandForPlayer(1, Cards.upgrades.shd.theDarksaber)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0); // play Darksaber from hand index 0
    await g.chooseGroundUnitAsync(1, 0); // attach to The Mandalorian

    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === "SHD_126")).toBe(true);
    expect(g.state.player1.hand).toHaveLength(0); // card left hand
  });

  it("still charges aspect penalty when player has NO Mandalorian to attach to", async () => {
    // 4 resources, but with the penalty (2) cost is 6 — play should be rejected.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)           // Vigilance only, no Command
      .MyLeader(Cards.leaders.sor.darthVader)         // Aggression+Villainy, no Command
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)   // non-Mandalorian target
      .WithCardInHandForPlayer(1, Cards.upgrades.shd.theDarksaber)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // Rejected — card stays in hand, no upgrade attached
    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
  });
});

describe("SHD_126 The Darksaber — On Attack", () => {
  it("gives an Experience token to each OTHER friendly Mandalorian when the carrier attacks", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // Carrier: Sundari Peacekeeper (Mandalorian) with Darksaber attached
      .WithGroundUnitForPlayer(1, Cards.units.shd.sundariPeaceKeeper)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.shd.theDarksaber, 1),
      ])
      // Other Mandalorian: The Mandalorian — should receive XP
      .WithGroundUnitForPlayer(1, Cards.units.shd.theMandalorian)
      // Non-Mandalorian: Battlefield Marine — should NOT receive XP
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0); // Sundari (with Darksaber) attacks
    await g.chooseBaseAsync(1, 2);

    // The Mandalorian (index 1) gets 1 XP token
    expect(g.state.player1.groundArena[1].upgrades.filter(u => u.cardId === "SOR_T01")).toHaveLength(1);
    // Battlefield Marine (index 2) gets no XP
    expect(g.state.player1.groundArena[2].upgrades.filter(u => u.cardId === "SOR_T01")).toHaveLength(0);
    // Carrier itself (index 0) gets no XP ("each OTHER")
    expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === "SOR_T01")).toHaveLength(0);
  });

  it("gives no XP when no other friendly Mandalorions are present", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.shd.sundariPeaceKeeper)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.shd.theDarksaber, 1),
      ])
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // non-Mandalorian only
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.groundArena[1].upgrades).toHaveLength(0);
  });
});
