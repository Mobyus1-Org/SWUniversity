import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_045 Yaddle — A Chance To Make Things Right (2/4 Ground, Force/Jedi/Republic, cost 2)
// "Restore 1"
// "On Attack: Each other friendly Jedi unit gains Restore 1 for this phase."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 8) // damage for Restore to heal
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
    .WithInitiativePlayerBeing(2)
    .WithInitiativeClaimed(); // player 2 auto-passes so player 1 can attack twice
}

describe("LOF_045 Yaddle", () => {
  it("has Restore 1: heals 1 from your base when she attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.lof.yaddle).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(7); // 8 - 1 restored
  });

  it("On Attack: another friendly Jedi gains Restore 1 for this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.yaddle)
        .WithGroundUnitForPlayer(1, Cards.units.sor.obiWanKenobi) // Jedi, no innate Restore
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0); // Yaddle attacks → grants Restore 1
    await g.chooseBaseAsync(1, 2);
    const afterYaddle = g.state.player1.base.damage; // 8 - 1 (her own Restore)

    await g.attackWithGroundUnitAsync(1, 1); // Obi-Wan attacks with the granted Restore 1
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(afterYaddle - 1);
  });

  it("does not grant Restore to a non-Jedi friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.yaddle)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel/Trooper — not a Jedi
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    const afterYaddle = g.state.player1.base.damage;

    await g.attackWithGroundUnitAsync(1, 1); // the Marine attacks — no Restore
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(afterYaddle); // unchanged
  });

  it("does not grant Restore to an ENEMY Jedi unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.yaddle)
        .WithGroundUnitForPlayer(1, Cards.units.sor.obiWanKenobi) // friendly Jedi
        .WithGroundUnitForPlayer(2, Cards.units.sor.obiWanKenobi) // ENEMY Jedi
        .Build(),
    );

    const enemyJediPlayId = g.state.player2.groundArena[0].playId;
    const friendlyJediPlayId = g.state.player1.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(1, 0); // Yaddle attacks
    await g.chooseBaseAsync(1, 2);

    const granted = g.state.currentEffects.filter(e => e.cardId === Cards.units.lof.yaddle);
    const targets = granted.map(e => e.targetPlayId);
    expect(targets).toContain(friendlyJediPlayId); // the friendly Jedi gained it
    expect(targets).not.toContain(enemyJediPlayId); // the enemy Jedi did not
    expect(granted.every(e => e.affectedPlayer === 1)).toBe(true);
  });

  it("does not grant Restore to herself twice ('each OTHER friendly Jedi')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.lof.yaddle).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(7); // 8 - 1, not 8 - 2
  });
});
