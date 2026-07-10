import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// The eight common "Force" bases share one passive ability:
//   "When a friendly Force unit attacks: The Force is with you (create your Force token)."
// It is a passive that re-triggers every attack, so a player can gain the token,
// use it, and gain it again in the same phase.

describe("LOF Force bases — create Force token when a friendly Force unit attacks", () => {
  it("creates the controller's Force token when a friendly Force unit attacks the base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.lof.nightsisterLair)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.lof.gungi) // Force trait, no On Attack
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("creates the Force token when the Force unit attacks an enemy unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.lof.nightsisterLair)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.lof.gungi)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("does not create a Force token when a non-Force unit attacks", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.lof.nightsisterLair)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not a Force unit
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.supplemental.forceToken).toBeFalsy();
  });

  it("does not create a Force token when the base is not a Force base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP) // ordinary base, no Force ability
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.lof.gungi)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.supplemental.forceToken).toBeFalsy();
  });

  it("is idempotent — no error when the player already controls the Force", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.lof.nightsisterLair)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.lof.gungi)
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("also fires for another of the eight bases (Fortress Vader)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.lof.fortressVader)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.lof.gungi)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("fires on an Ambush attack (Force unit played with Ambush granted)", async () => {
    // The passive fires on every attack path, not just normal attacks. Here an Energy
    // Conversion Lab effect (SOR_022) grants Ambush to the played Force unit, mirroring the
    // "gain the Force by Ambush-attacking the turn it's played" interaction.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.lof.nightsisterLair)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.lof.gungi) // Force unit
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // Ambush target
      .WithCurrentEffect({ cardId: Cards.bases.sor.energyConversionLab, duration: "Phase", affectedPlayer: 1 })
      .Build();
    g.loadNewState(state); // player 1 does NOT control the Force

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // resolve Ambush
    await g.chooseGroundUnitAsync(2, 0); // Ambush-attack the enemy Marine

    expect(g.state.player2.groundArena[0]?.damage ?? "defeated").not.toBe(0); // the Ambush attack happened
    expect(g.state.player1.supplemental.forceToken).toBe(true); // and the base created the Force token
  });

  it("re-triggers each attack: gain the Force, use it, and gain it again in one phase", async () => {
    // A passive, so a player can gain their Force token, spend it (Cure Wounds), and gain it
    // again the same phase by attacking with another Force unit.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.lof.nightsisterLair)
      .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance, for Cure Wounds
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.lof.cureWounds)
      .WithGroundUnitForPlayer(1, Cards.units.lof.gungi) // Force attacker #1 (index 0)
      .WithGroundUnitForPlayer(1, Cards.units.lof.gungi) // Force attacker #2 (index 1)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 6) // heal target (index 2)
      .Build();
    g.loadNewState(state); // player 1 does NOT control the Force

    // Gain: first Force unit attacks the base.
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player1.supplemental.forceToken).toBe(true);

    // Use: Cure Wounds spends the Force to heal 6. (Reset the turn to P1 — an attack
    // hands the action to the opponent; this test drives consecutive P1 actions.)
    g.state.activePlayer = 1;
    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player1.groundArena[2].playId] });
    expect(g.state.player1.supplemental.forceToken).toBe(false);
    expect(g.state.player1.groundArena[2].damage).toBe(0);

    // Gain again: second Force unit attacks — the passive re-triggers.
    g.state.activePlayer = 1;
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });
});
