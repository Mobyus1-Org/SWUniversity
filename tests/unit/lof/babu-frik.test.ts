import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_206 Babu Frik (1/4 Ground, Underworld) —
// "Action [Exhaust]: You may attack with a friendly Droid unit. For this attack, it deals damage
//  equal to its remaining HP instead of its power."
// R2-D2 (TWI_193) is a 2/4 Droid used as the friendly Droid.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("LOF_206 Babu Frik", () => {
  it("sends a friendly Droid to attack, dealing damage equal to its remaining HP, not its power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.babuFrik)          // [0]
        .WithGroundUnitForPlayer(1, Cards.units.twi.r2d2FullOfSolutions) // [1] R2-D2, 2/4, undamaged
        .Build(),
    );
    const babuPlayId = g.state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.lof.babuFrik, playId: babuPlayId });
    await g.chooseGroundUnitAsync(1, 1); // choose R2-D2 as the attacker
    await g.chooseBaseAsync(1, 2);       // attack the enemy base

    // R2-D2 has 4 remaining HP → deals 4, not its 2 power.
    expect(g.state.player2.base.damage).toBe(4);
    expect(g.state.player1.groundArena[0].ready).toBe(false); // Babu Frik exhausted (the cost)
    expect(g.state.player1.groundArena[1].ready).toBe(false); // R2-D2 exhausted from attacking
  });

  it("uses the Droid's CURRENT remaining HP (damaged Droid deals less)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.babuFrik)
        .WithGroundUnitForPlayer(1, Cards.units.twi.r2d2FullOfSolutions, true, 1) // 4 HP – 1 damage = 3
        .Build(),
    );
    const babuPlayId = g.state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.lof.babuFrik, playId: babuPlayId });
    await g.chooseGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3); // 3 remaining HP
  });

  it("the same Droid attacking normally deals its printed power (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.twi.r2d2FullOfSolutions) // 2/4
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2); // its 2 power — no HP override
  });

  it("no action is offered when there is no other friendly Droid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.babuFrik)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not a Droid
        .Build(),
    );
    const babuPlayId = g.state.player1.groundArena[0].playId;

    const res = await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.lof.babuFrik, playId: babuPlayId });

    expect(res.lastDispatchResponse?.invalidAction).toBe(true);
  });
});

describe("LOF_206 Babu Frik + LOF_056 Size Matters Not combo", () => {
  it("a Droid wearing Size Matters Not deals its 5-based remaining HP when sent by Babu Frik", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.lof.babuFrik)
      .WithGroundUnitForPlayer(1, Cards.units.twi.r2d2FullOfSolutions) // R2-D2, printed 2/4
      .Build();
    // Size Matters Not makes R2-D2's printed HP 5 (undamaged → 5 remaining HP).
    s.player1.groundArena[1].upgrades = [GameStateBuilder.Upgrade(Cards.upgrades.lof.sizeMattersNot, 1)];
    g.loadNewState(s);
    const babuPlayId = g.state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.lof.babuFrik, playId: babuPlayId });
    await g.chooseGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    // Babu Frik uses remaining HP (5, from Size Matters Not) — not R2-D2's 2 power, nor the 5 power
    // Size Matters Not would grant, since Babu Frik overrides power with HP entirely.
    expect(g.state.player2.base.damage).toBe(5);
  });
})
