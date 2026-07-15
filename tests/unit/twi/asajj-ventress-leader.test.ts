import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_014 Asajj Ventress — Unparalleled Adversary
// Leader:   "Action [Exhaust]: Attack with a unit. If you played an event this phase, it gets
//            +1/+0 for this attack."
//           "Epic Action: If you control 4 or more resources, deploy this leader."
// Deployed: "On Attack: If you played an event this phase, this unit gets +1/+0 for this attack
//            and deals combat damage before the defender." (first strike)

function seedEventPlayed(g: GameTestAdapter, player: 1 | 2) {
  g.state.roundState.cardsPlayedThisPhase.push({
    fromPlayer: player,
    cardId: Cards.events.sor.tacticalAdvantage, // an Event
    playId: "played-0",
  });
}

describe("TWI_014 Asajj Ventress — leader Action (attack with a unit; +1/+0 if an event was played)", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.asajjVentress)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3 attacker
      .WithActivePlayer(1);
  }

  it("chosen unit attacks with +1/+0 when an event was played this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());
    seedEventPlayed(g, 1);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // attack with the marine
    await g.chooseBaseAsync(1, 2);       // ...the enemy base

    expect(g.state.player2.base.damage).toBe(4); // 3 + 1
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("no +1/+0 when no event was played this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3); // no bonus
  });
});

describe("TWI_014 Asajj Ventress — Epic Action deploy (4+ resources)", () => {
  it("deploys for free with 4 resources; not with 3", async () => {
    const g4 = new GameTestAdapter();
    g4.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.asajjVentress)
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
        .MyLeader(Cards.leaders.twi.asajjVentress)
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

describe("TWI_014 Asajj Ventress — deployed On Attack (+1/+0 and first strike if an event was played)", () => {
  function deployed() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.asajjVentress, true, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.twi.asajjVentress)  // [0] deployed Asajj 3/4
      .WithGroundUnitForPlayer(2, Cards.units.sor.generalDodonna)   // enemy 4/4
      .WithActivePlayer(1);
  }

  it("gets +1/+0 and first strike — defeats the 4-HP defender and takes no counter-damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().Build());
    seedEventPlayed(g, 1);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // Asajj attacks Dodonna

    // With +1/+0 Asajj deals 4 = Dodonna's 4 HP → defeated before it deals counter-damage.
    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.units.sor.generalDodonna)).toBe(false);
    const asajj = g.state.player1.groundArena.find(u => u.cardId === Cards.leaders.twi.asajjVentress)!;
    expect(asajj.damage).toBe(0); // no counter-damage (first strike)
  });

  it("without an event: no +1/+0 and no first strike — Asajj takes counter-damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Asajj deals only 3 (Dodonna survives at 3/4) and takes 4 counter → defeated.
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.leaders.twi.asajjVentress)).toBe(false);
    expect(g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.generalDodonna)!.damage).toBe(3);
  });
});
