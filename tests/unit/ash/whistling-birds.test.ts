import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { CardInPlay } from "@/lib/engine/core-models";
import { UpgradeEligibleTargets } from "@/server/engine/card-db/upgrade-attach-restrictions";

// ASH_183 Whistling Birds (Upgrade, cost 3, Aggression; +2/+2)
// "Attach to a non-Vehicle unit."
// "Attached unit gains: 'When Attack Ends: If this unit dealt combat damage to an opponent's base,
//  deal 2 damage to each unit that opponent controls in this unit's arena.'"

function birds(): CardInPlay[] {
  return [{ cardId: Cards.upgrades.ash.whistlingBirds, playId: "@", owner: 1, controller: 1 }];
}

function setup(extra: (b: GameStateBuilder) => GameStateBuilder = b => b) {
  return extra(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // Battlefield Marine (3/3 Ground, non-Vehicle) carrying the birds → 5/5.
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, birds()),
  ).Build();
}

describe("ASH_183 Whistling Birds — attach restriction and stats", () => {
  it("gives the attached unit +2/+2", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    const marine = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(marine.CurrentPower()).toBe(5); // 3 + 2
    expect(marine.TotalHP()).toBe(5); // 3 + 2
  });

  it("can only attach to a non-Vehicle unit", () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // non-Vehicle
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft) // Vehicle
      .Build();
    g.loadNewState(s);

    const eligible = UpgradeEligibleTargets(Cards.upgrades.ash.whistlingBirds, g.state, 1);

    expect(eligible).toEqual([g.state.player1.groundArena[0].playId]); // the Vehicle is excluded
  });
});

describe("ASH_183 Whistling Birds — When Attack Ends", () => {
  it("after damaging the enemy base, deals 2 to each enemy unit in the attacker's arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(b => b
      // Two enemy GROUND units (same arena as the attacker) and one SPACE unit (different arena).
      .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler) // 1/7
      .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)));

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5); // 3 + 2 from the birds
    // Every enemy unit in the GROUND arena took 2.
    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena[1].damage).toBe(2);
    // The space arena is untouched — "in this unit's arena".
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });

  it("does not fire when the attack hit a unit instead of a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(b => b
      .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler)
      .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler)));

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack a unit, not the base

    // The defender took 5 combat damage; the OTHER enemy unit took nothing.
    expect(g.state.player2.groundArena[0].damage).toBe(5);
    expect(g.state.player2.groundArena[1].damage).toBe(0);
  });

  it("only damages units the DAMAGED opponent controls, not friendly units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(b => b
      .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler) // a friendly bystander
      .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler)));

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player1.groundArena[1].damage).toBe(0); // friendly unit untouched
  });

  it("can defeat the enemy units it damages", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(b => b
      // Battle Droid tokens are 1/1 — 2 damage defeats them.
      .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid)
      .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid)));

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });
});
