import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_001 Nala Se — Clone Engineer
// Leader:   "Ignore the aspect penalty on Clone units you play."
//           "Epic Action: If you control 4 or more resources, deploy this leader."
// Deployed: "Ignore the aspect penalty on Clone units you play."
//           "Each friendly Clone unit gains: 'When Defeated: Heal 2 damage from your base.'"
//
// Base SOR_023 provides Command; Nala Se provides Vigilance + Villainy.
// TWI_158 Clone Heavy Gunner (cost 2, Aggression, Clone) normally pays a +2 Aggression penalty.

describe("TWI_001 Nala Se — aspect penalty waiver on Clone units", () => {
  it("lets you play a Clone unit at its printed cost (penalty ignored)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.nalaSe)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, Cards.units.twi.cloneHeavyGunner) // Clone, cost 2
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.twi.cloneHeavyGunner)).toBe(true);
  });

  it("does NOT waive the penalty under a different leader", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.nuteGunray) // Vigilance/Villainy — does not cover Aggression, no waiver
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, Cards.units.twi.cloneHeavyGunner)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // Needs 2 + 2 penalty = 4; with only 2 resources the play is rejected.
    expect(g.state.player1.groundArena.length).toBe(0);
    expect(g.state.player1.hand.length).toBe(1);
  });
});

describe("TWI_001 Nala Se — Epic Action deploy (4+ resources)", () => {
  it("deploys for free with 4 resources; not with 3", async () => {
    const g4 = new GameTestAdapter();
    g4.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.nalaSe)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
        .WithActivePlayer(1)
        .Build(),
    );
    await g4.deployLeaderAsync(1);
    expect(g4.state.player1.leader.deployed).toBe(true);

    const g3 = new GameTestAdapter();
    g3.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.nalaSe)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithActivePlayer(1)
        .Build(),
    );
    await g3.deployLeaderAsync(1);
    expect(g3.state.player1.leader.deployed).toBe(false);
  });
});

describe("TWI_001 Nala Se — deployed: friendly Clone units heal 2 from base when defeated", () => {
  it("heals 2 damage from your base when a friendly Clone unit is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP, 5) // 5 damage on base
        .MyLeader(Cards.leaders.twi.nalaSe, true, true, true) // deployed
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.leaders.twi.nalaSe)          // deployed leader unit
        .WithGroundUnitForPlayer(1, Cards.units.twi.cloneHeavyGunner)  // friendly Clone, 1/3
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // enemy 3/3
        .WithActivePlayer(2)
        .Build(),
    );

    const cloneIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.twi.cloneHeavyGunner);
    await g.attackWithGroundUnitAsync(2, 0);       // marine attacks
    await g.chooseGroundUnitAsync(1, cloneIdx);    // targets the Clone → defeats it

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.twi.cloneHeavyGunner)).toBe(false);
    expect(g.state.player1.base.damage).toBe(3); // 5 - 2 healed
  });

  it("does NOT heal when Nala Se is not in play (leader undeployed)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP, 5)
        .MyLeader(Cards.leaders.twi.nalaSe) // undeployed — grant is on the deployed side only
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.twi.cloneHeavyGunner)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithActivePlayer(2)
        .Build(),
    );

    const cloneIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.twi.cloneHeavyGunner);
    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, cloneIdx);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.twi.cloneHeavyGunner)).toBe(false);
    expect(g.state.player1.base.damage).toBe(5); // unchanged
  });

  it("does NOT heal when the defeated unit is not a Clone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP, 5)
        .MyLeader(Cards.leaders.twi.nalaSe, true, true, true)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.leaders.twi.nalaSe)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // non-Clone, 3/3
        .WithGroundUnitForPlayer(2, Cards.units.sor.generalDodonna)    // enemy 4/4 kills the marine
        .WithActivePlayer(2)
        .Build(),
    );

    const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.sor.battlefieldMarine);
    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, marineIdx);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(false);
    expect(g.state.player1.base.damage).toBe(5); // unchanged
  });
});
