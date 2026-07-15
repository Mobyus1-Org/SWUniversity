import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_202 Carson Teva (1/4 Ground, cost 2)
// "Support (…)"
// "While attacking, this unit deals combat damage before the defender."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("ASH_202 Carson Teva", () => {
  it("kills a defender it can destroy before taking any counter-damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.carsonTeva)                  // 1 power
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 2)  // 3/3 with 2 damage → 1 HP
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].damage).toBe(0); // first strike — no counter-damage
  });

  it("still takes counter-damage from a defender that survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.carsonTeva)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3, survives 1 damage
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });

  it("Support grants first strike to the supported attacker", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)          // 3/3 attacker
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)          // 3/3 defender — would trade
        .WithCardInHandForPlayer(1, Cards.units.ash.carsonTeva)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    const attacker = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    expect(attacker.damage).toBe(0); // it struck first and killed the defender
  });
});
