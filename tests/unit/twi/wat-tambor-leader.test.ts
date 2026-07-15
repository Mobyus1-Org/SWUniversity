import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// TWI_006 Wat Tambor — Techno Union Foreman
// Leader:   "Action [Exhaust]: If a friendly unit was defeated this phase, give a unit +2/+2 for
//            this phase."
//           "Epic Action: If you control 5 or more resources, deploy this leader."
// Deployed: "On Attack: If a friendly unit was defeated this phase, you may give another unit
//            +2/+2 for this phase."

function seedDefeated(g: GameTestAdapter, player: 1 | 2) {
  g.state.roundState.cardsLeftPlayThisPhase.push({
    fromPlayer: player,
    cardId: Cards.units.sor.battlefieldMarine,
    playId: "dead-0",
    reason: "defeated",
  });
}

describe("TWI_006 Wat Tambor — leader Action (give a unit +2/+2 if a friendly unit was defeated)", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.watTambor)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3 target
      .WithActivePlayer(1);
  }

  it("gives the chosen unit +2/+2 for this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());
    seedDefeated(g, 1);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    const unit = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(unit.CurrentPower()).toBe(5); // 3 + 2
    expect(unit.TotalHP()).toBe(5);      // 3 + 2
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("soft-passes when no friendly unit was defeated this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    const unit = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(unit.CurrentPower()).toBe(3); // unchanged
    expect(g.state.player1.leader.ready).toBe(false); // cost still paid
  });
});

describe("TWI_006 Wat Tambor — Epic Action deploy (5+ resources)", () => {
  it("deploys for free with 5 resources; not with 4", async () => {
    const g5 = new GameTestAdapter();
    g5.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.watTambor)
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
        .MyLeader(Cards.leaders.twi.watTambor)
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

describe("TWI_006 Wat Tambor — deployed On Attack (may give another unit +2/+2)", () => {
  function deployed() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.watTambor, true, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.twi.watTambor)        // [0] deployed leader unit
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)  // [1] another unit
      .WithActivePlayer(1);
  }

  it("gives another unit +2/+2 on accept when a friendly unit was defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().Build());
    seedDefeated(g, 1);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 1);

    const unit = Unit.FromInterface(g.state.player1.groundArena[1]);
    expect(unit.CurrentPower()).toBe(5); // 3 + 2
    expect(unit.TotalHP()).toBe(5);
  });

  it("may decline — no buff", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().Build());
    seedDefeated(g, 1);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    const unit = Unit.FromInterface(g.state.player1.groundArena[1]);
    expect(unit.CurrentPower()).toBe(3);
  });

  it("soft-passes (no prompt) when no friendly unit was defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    const unit = Unit.FromInterface(g.state.player1.groundArena[1]);
    expect(unit.CurrentPower()).toBe(3);
  });
});
