import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_156 Trench Run (Event, cost 1, Aggression/Heroism, Gambit)
// "Attack with a Fighter unit. For this attack, it gets +4/+0 and gains:
//  'On Attack: Discard 2 cards from the defending player's deck. Deal unpreventable damage equal
//   to the difference in the discarded cards' costs to this unit.'"

// System Patrol Craft (SOR_066) is a 3/4 Space Fighter. Battlefield Marine (SOR_095) costs 2 and
// Battle Droid Escort (TWI_229) costs 3 — a cost difference of 1.
const COST_2 = Cards.units.sor.battlefieldMarine;
const COST_3 = Cards.units.twi.battleDroidEscort;

function setup(deck: string[], extra: (b: GameStateBuilder) => GameStateBuilder = b => b) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
    .WithCardInHandForPlayer(1, Cards.events.jtl.trenchRun)
    .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft); // the Fighter
  for (const c of deck) b = b.WithCardInDeckForPlayer(2, c); // the DEFENDING player's deck
  return extra(b).Build();
}

describe("JTL_156 Trench Run", () => {
  it("attacks with +4/+0, mills 2 of the defender's deck, and self-damages by the cost difference", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([COST_2, COST_3]));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // 3 + 4 = 7 damage to the base.
    expect(g.state.player2.base.damage).toBe(7);
    // Two cards left the defending player's deck and went to their discard.
    expect(g.state.player2.deck).toHaveLength(0);
    expect(g.state.player2.discard).toHaveLength(2);
    // |3 - 2| = 1 unpreventable damage to the attacker itself.
    expect(g.state.player1.spaceArena[0].damage).toBe(1);
  });

  it("deals no self-damage when the discarded cards cost the same", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([COST_2, COST_2]));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.spaceArena[0].damage).toBe(0); // |2 - 2| = 0
    expect(g.state.player2.deck).toHaveLength(0);
  });

  it("the self-damage is unpreventable — a Shield on the attacker does not absorb it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup([COST_2, COST_3], b =>
        b.WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.token.shield, playId: "@", owner: 1, controller: 1 },
        ]),
      ),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const craft = g.state.player1.spaceArena[0];
    expect(craft.damage).toBe(1); // damage landed
    expect(craft.upgrades.filter(u => u.cardId === Cards.upgrades.token.shield)).toHaveLength(1); // Shield intact
  });

  it("the +4/+0 lasts only for that attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([COST_2, COST_3]));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.currentEffects.some(e => e.cardId === Cards.events.jtl.trenchRun)).toBe(false);
  });

  it("cannot be played without a Fighter unit", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
      .WithCardInHandForPlayer(1, Cards.events.jtl.trenchRun)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not a Fighter
      .Build();
    g.loadNewState(s);

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(0);
  });
});
