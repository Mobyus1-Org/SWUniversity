import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_008 Hera Syndulla — Spectre Two
// Leader:   "Ignore the aspect penalty on SPECTRE cards you play."
//           "Epic Action: If you control 6 or more resources, deploy this leader."
// Deployed: "Ignore the aspect penalty on SPECTRE cards you play."
//           "On Attack: You may give an Experience token to another unique unit."
//
// Base SOR_023 (green30HP) provides Command; Hera provides Command + Heroism.
// SOR_146 Zeb (cost 5, Aggression/Heroism, SPECTRE) normally pays a +2 Aggression penalty.
// TWI_158 Clone Heavy Gunner (cost 2, Aggression, NOT Spectre) is the control.

describe("SOR_008 Hera Syndulla — aspect penalty waiver on Spectre cards", () => {
  it("lets you play a Spectre card at its printed cost (penalty ignored)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.heraSyndulla)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, Cards.units.sor.zebOrrelios) // SOR_146, Spectre, cost 5
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5) // exactly printed cost
        .WithActivePlayer(1)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.zebOrrelios)).toBe(true);
    expect(g.state.player1.hand.length).toBe(0);
  });

  it("still charges the aspect penalty on a NON-Spectre card with the same aspect", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.heraSyndulla)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, Cards.units.twi.cloneHeavyGunner) // TWI_158, Aggression, NOT Spectre, cost 2
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2) // printed cost only
        .WithActivePlayer(1)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // Needs 2 + 2 penalty = 4; with only 2 resources the play is rejected.
    expect(g.state.player1.groundArena.length).toBe(0);
    expect(g.state.player1.hand.length).toBe(1);
  });

  it("waiver still applies once Hera has deployed (both sides carry the ability)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.heraSyndulla, true, true, true) // deployed
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.heraSyndulla) // deployed leader unit
        .WithCardInHandForPlayer(1, Cards.units.sor.zebOrrelios) // SOR_146, Spectre, cost 5
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.zebOrrelios)).toBe(true);
  });
});

describe("SOR_008 Hera Syndulla — Epic Action deploy (6+ resources)", () => {
  function deploySetup(resourceCount: number) {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, resourceCount)
      .WithActivePlayer(1);
  }

  it("deploys for free with 6 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deploySetup(6).Build());
    await g.deployLeaderAsync(1);
    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.resources.length).toBe(6);
  });

  it("cannot deploy with 5 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deploySetup(5).Build());
    await g.deployLeaderAsync(1);
    expect(g.state.player1.leader.deployed).toBe(false);
  });
});

describe("SOR_008 Hera Syndulla — deployed On Attack (give Experience to another unique unit)", () => {
  function deployedSetup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla, true, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.heraSyndulla)   // [0] deployed Hera
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalDodonna)   // [1] unique friendly unit
      .WithActivePlayer(1);
  }

  it("gives an Experience token to a chosen another unique unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());

    const dodonna = g.state.player1.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(1, 0); // Hera attacks
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [dodonna] });

    const target = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.generalDodonna)!;
    expect(target.upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
  });

  it("may decline — no Experience token given", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    const target = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.generalDodonna)!;
    expect(target.upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(false);
  });

  it("does not trigger when there is no OTHER unique unit to target", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.heraSyndulla, true, true, true)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.heraSyndulla) // only Hera; no other unique unit
        .WithActivePlayer(1)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // No ability-option prompt — attack resolves straight away.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(4); // Hera has 4 power
  });
});
