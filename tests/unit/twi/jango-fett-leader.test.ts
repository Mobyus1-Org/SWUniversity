import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_016 Jango Fett — Concealing the Conspiracy
// Leader:   "When a friendly unit deals damage to an enemy unit: You may exhaust this leader. If you
//            do, exhaust that enemy unit."
//           "Epic Action: If you control 5 or more resources, deploy this leader."
// Deployed: "When a friendly unit deals damage to an enemy unit: You may exhaust that unit."

describe("TWI_016 Jango Fett — leader reaction (friendly unit damages an enemy → exhaust leader → exhaust that enemy)", () => {
  function setup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.jangoFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.generalDodonna)     // 4/4 attacker
      .WithGroundUnitForPlayer(2, Cards.units.sor.steadfastBattalion) // enemy 5/5, survives + ready
      .WithActivePlayer(1);
  }

  it("exhausts the damaged enemy unit on accept (and exhausts Jango)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 0); // Dodonna attacks
    await g.chooseGroundUnitAsync(2, 0);     // ...the enemy Battalion (deals 4, it survives at 5 HP)
    await g.chooseYesAsync(1);               // exhaust Jango to exhaust the Battalion

    const battalion = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.steadfastBattalion)!;
    expect(battalion.ready).toBe(false);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("may decline — enemy stays ready, Jango stays ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    const battalion = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.steadfastBattalion)!;
    expect(battalion.ready).toBe(true);
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("TWI_016 Jango Fett — Epic Action deploy (5+ resources)", () => {
  it("deploys for free with 5 resources; not with 4", async () => {
    const g5 = new GameTestAdapter();
    g5.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.jangoFett)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithActivePlayer(1)
        .Build(),
    );
    await g5.deployLeaderAsync(1);
    expect(g5.state.player1.leader.deployed).toBe(true);

    const g4 = new GameTestAdapter();
    g4.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.jangoFett)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
        .WithActivePlayer(1)
        .Build(),
    );
    await g4.deployLeaderAsync(1);
    expect(g4.state.player1.leader.deployed).toBe(false);
  });
});

describe("TWI_016 Jango Fett — deployed reaction (friendly unit damages an enemy → exhaust that enemy, no self-cost)", () => {
  function deployed() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.jangoFett, true, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.twi.jangoFett)        // deployed Jango 3/7
      .WithGroundUnitForPlayer(2, Cards.units.sor.steadfastBattalion) // enemy 5/5, survives + ready
      .WithActivePlayer(1);
  }

  it("exhausts the damaged enemy on accept without exhausting Jango's leader zone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().Build());

    await g.attackWithGroundUnitAsync(1, 0); // Jango attacks (deals 3, Battalion survives at 5 HP)
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);

    const battalion = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.steadfastBattalion)!;
    expect(battalion.ready).toBe(false);
  });

  it("may decline — enemy stays ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    const battalion = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.steadfastBattalion)!;
    expect(battalion.ready).toBe(true);
  });
});
