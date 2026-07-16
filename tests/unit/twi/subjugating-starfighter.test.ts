import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_112 Subjugating Starfighter (3/3 Space, cost 4) —
//   "Ambush (When you play this unit, it may ready and attack an enemy unit.)
//    When Played: If you have the initiative, create a Battle Droid token."
describe("TWI_112 Subjugating Starfighter", () => {
  function build(initiative: 1 | 2, withEnemy = true) {
    const b = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithInitiativePlayerBeing(initiative)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.units.twi.subjugatingStarfighter);
    if (withEnemy) b.WithSpaceUnitForPlayer(2, Cards.units.token.xWing);
    return b.Build();
  }

  it("When Played: creates a Battle Droid token when you have the initiative", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build(1));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Subjugating Starfighter — When Played"); // resolve WP first
    await g.chooseNoAsync(1); // decline Ambush

    expect(g.state.player1.groundArena.filter(u => u.cardId === Cards.units.token.battleDroid)).toHaveLength(1);
    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.twi.subjugatingStarfighter)).toBe(true);
  });

  it("When Played: creates no Battle Droid token without the initiative", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build(2)); // opponent has initiative

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Subjugating Starfighter — When Played");
    await g.chooseNoAsync(1); // decline Ambush

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.token.battleDroid)).toBe(false);
  });

  it("Ambush: may ready and attack an enemy unit when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build(1));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Subjugating Starfighter — Ambush"); // resolve Ambush first
    await g.chooseYesAsync(1); // accept Ambush attack
    await g.chooseSpaceUnitAsync(2, 0); // attack the enemy X-Wing (2/2)

    // 3-power starfighter vs 2/2 X-Wing: X-Wing defeated, starfighter takes 2 (survives, 3 HP).
    expect(g.state.player2.spaceArena.some(u => u.cardId === Cards.units.token.xWing)).toBe(false);
    const sf = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.twi.subjugatingStarfighter);
    expect(sf?.damage).toBe(2);
  });
});
