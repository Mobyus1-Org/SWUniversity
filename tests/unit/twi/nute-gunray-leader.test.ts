import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_002 Nute Gunray — Vindictive Viceroy
// Leader:   "Action [Exhaust]: If 2 or more friendly units were defeated this phase, create a
//            Battle Droid token."
//           "Epic Action: If you control 6 or more resources, deploy this leader."
// Deployed: "On Attack: Create a Battle Droid token."

const BATTLE_DROID = "TWI_T01";

function seedDefeated(g: GameTestAdapter, player: 1 | 2, count: number) {
  for (let i = 0; i < count; i++) {
    g.state.roundState.cardsLeftPlayThisPhase.push({
      fromPlayer: player,
      cardId: Cards.units.sor.battlefieldMarine,
      playId: `dead-${i}`,
      reason: "defeated",
    });
  }
}

describe("TWI_002 Nute Gunray — leader Action (create a Battle Droid if 2+ friendly units defeated)", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.nuteGunray)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("creates a Battle Droid token when 2 friendly units were defeated this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());
    seedDefeated(g, 1, 2);

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.groundArena.some(u => u.cardId === BATTLE_DROID)).toBe(true);
    expect(g.state.player1.leader.ready).toBe(false); // exhausted
  });

  it("soft-passes (no token) when fewer than 2 friendly units were defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());
    seedDefeated(g, 1, 1);

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.groundArena.some(u => u.cardId === BATTLE_DROID)).toBe(false);
    expect(g.state.player1.leader.ready).toBe(false); // still exhausted (cost paid)
  });

  it("does not count enemy defeats", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());
    seedDefeated(g, 2, 3); // enemy units defeated

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.groundArena.some(u => u.cardId === BATTLE_DROID)).toBe(false);
  });
});

describe("TWI_002 Nute Gunray — Epic Action deploy (6+ resources)", () => {
  it("deploys for free with 6 resources; not with 5", async () => {
    const g6 = new GameTestAdapter();
    g6.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.nuteGunray)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithActivePlayer(1)
        .Build(),
    );
    await g6.deployLeaderAsync(1);
    expect(g6.state.player1.leader.deployed).toBe(true);

    const g5 = new GameTestAdapter();
    g5.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.nuteGunray)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithActivePlayer(1)
        .Build(),
    );
    await g5.deployLeaderAsync(1);
    expect(g5.state.player1.leader.deployed).toBe(false);
  });
});

describe("TWI_002 Nute Gunray — deployed On Attack (create a Battle Droid token)", () => {
  it("creates a Battle Droid token on attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.nuteGunray, true, true, true)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.leaders.twi.nuteGunray) // deployed leader unit
        .WithActivePlayer(1)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.groundArena.some(u => u.cardId === BATTLE_DROID)).toBe(true);
  });
});
