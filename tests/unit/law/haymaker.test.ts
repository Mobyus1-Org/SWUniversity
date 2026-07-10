import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_168 Haymaker — Command event, cost 4.
// "Give an Experience token to a friendly unit. That unit deals damage equal to its
//  power to an enemy unit in the same arena."
describe("LAW_168 Haymaker", () => {
  it("gives an Experience token, then that unit deals its (boosted) power to an enemy unit in the same arena", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)   // SOR_095, power 3 → 4 after XP
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 9 HP survivor, same arena
      .WithCardInHandForPlayer(1, Cards.events.law.haymaker)
      .Build();
    g.loadNewState(state);

    const friendlyPlayId = state.player1.groundArena[0].playId;
    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendlyPlayId] }); // give XP to marine
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });    // deal power to walker

    const marine = g.state.player1.groundArena[0];
    // Experience token attached...
    expect(marine.upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
    // ...and it dealt its boosted power (3 base + 1 from XP = 4) to the enemy.
    expect(g.state.player2.groundArena[0].damage).toBe(4);
  });

  it("cannot hit an enemy in a different arena (same-arena restriction)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)   // ground
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)    // SOR_066, only enemy, in SPACE
      .WithCardInHandForPlayer(1, Cards.events.law.haymaker)
      .Build();
    g.loadNewState(state);

    const friendlyPlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendlyPlayId] }); // XP still given

    // XP was granted, but there is no same-arena (ground) enemy → no damage dealt.
    const marine = g.state.player1.groundArena[0];
    expect(marine.upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });
});
