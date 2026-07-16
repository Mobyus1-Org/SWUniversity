import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TS26_058 Backed by the Pykes (Event, cost 3) —
//   "Give an Experience token to a friendly unit.
//    You may deal damage to a unit equal to the number of Experience tokens on friendly units."
describe("TS26_058 Backed by the Pykes", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // enemy damage target
      .WithCardInHandForPlayer(1, Cards.events.ts26.backedByThePykes);
  }

  it("gives an Experience token and deals damage equal to friendly Experience-token count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // friendly recipient
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1), // 1 pre-existing XP
        ])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // give the XP to the friendly Marine
    await g.chooseYesAsync(1);           // opt into the damage
    await g.chooseGroundUnitAsync(2, 0); // deal it to the enemy Marine

    // Friendly Marine now has 2 Experience tokens (1 pre-existing + 1 given).
    const friendly = g.state.player1.groundArena[0];
    expect(friendly.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience)).toHaveLength(2);
    // Damage dealt = 2 (the friendly XP-token count).
    const enemy = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine);
    expect(enemy?.damage).toBe(2);
  });

  it("may decline the optional damage; the Experience token is still given", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // give the XP
    await g.chooseNoAsync(1);            // decline the damage

    expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === Cards.upgrades.token.experience)).toHaveLength(1);
    const enemy = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine);
    expect(enemy?.damage).toBe(0);
  });
});
