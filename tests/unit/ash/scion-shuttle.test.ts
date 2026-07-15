import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_046 Scion Shuttle (1/3 Space, cost 2)
// "Support (…)"
// "While this unit is attacking, the defending unit gets –1/–1."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("ASH_046 Scion Shuttle", () => {
  it("the defender it attacks gets –1/–1: it hits back for one less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.scionShuttle) // 1/3
        .WithSpaceUnitForPlayer(2, Cards.units.token.xWing)      // 2/2 → 1/1 while defending
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    // The X-Wing's HP drops to 1, so the Shuttle's 1 power kills it…
    expect(g.state.player2.spaceArena).toHaveLength(0);
    // …and its power drops to 1, so the Shuttle only takes 1 counter-damage.
    expect(g.state.player1.spaceArena[0].damage).toBe(1);
  });

  it("the debuff does not linger after the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.scionShuttle)
        .WithSpaceUnitForPlayer(2, Cards.units.ash.unsanctionedPatrol) // 4/4 → 3/3, survives
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    const defender = g.state.player2.spaceArena[0];
    expect(g.state.currentEffects.filter(e => e.targetPlayId === defender.playId)).toHaveLength(0);
  });

  it("Support grants it — the supported attacker debuffs its defender", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.token.xWing) // 2/2 plain attacker
        .WithSpaceUnitForPlayer(2, Cards.units.token.xWing) // 2/2 defender → 1/1
        .WithCardInHandForPlayer(1, Cards.units.ash.scionShuttle)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(1, 0); // our X-Wing attacks
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(0);
    const attacker = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.token.xWing)!;
    expect(attacker.damage).toBe(1); // counter-damage reduced from 2 to 1
  });
});
