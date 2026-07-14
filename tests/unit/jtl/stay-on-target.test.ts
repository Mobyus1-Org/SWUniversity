import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_177 Stay on Target (Event, cost 2, Aggression, Tactic)
// "Attack with a Vehicle unit. For this attack, it gets +2/+0 and gains:
//  'When this unit deals damage to a base: Draw a card.'"

function setup(extra: (b: GameStateBuilder) => GameStateBuilder = b => b) {
  return extra(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
      .WithCardInHandForPlayer(1, Cards.events.jtl.stayOnTarget)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      // System Patrol Craft (3/4 Space) is a Vehicle.
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft),
  ).Build();
}

describe("JTL_177 Stay on Target", () => {
  it("attacks a base with +2/+0 and draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0); // the Vehicle attacks
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5); // 3 + 2
    // The event left hand (-1) and the draw added one back.
    expect(g.state.player1.hand.length).toBe(handBefore - 1 + 1);
  });

  it("draws no card when the attack hits a unit instead of a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(b => b.WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)));
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0); // attack the enemy craft

    // 3 + 2 = 5 damage to the 4 HP defender → defeated.
    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player1.hand.length).toBe(handBefore - 1); // no draw
  });

  it("the +2/+0 lasts only for that attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // The ForAttack effect is cleared once the attack resolves.
    expect(g.state.currentEffects.some(e => e.cardId === Cards.events.jtl.stayOnTarget)).toBe(false);
  });

  it("can only be played with a Vehicle unit to attack with", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
      .WithCardInHandForPlayer(1, Cards.events.jtl.stayOnTarget)
      // Battlefield Marine is NOT a Vehicle.
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined(); // no legal attacker
    expect(g.state.player2.base.damage).toBe(0);
  });
});
