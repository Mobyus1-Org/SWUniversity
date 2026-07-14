import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { CardInPlay } from "@/lib/engine/core-models";

// ASH_T02 Advantage token (CR 8.15) — a token upgrade with the INNATE trait that gives the
// attached unit +1 power and +0 HP, and has:
//   "When attached unit's attack or defense ends: Defeat this upgrade."

function advantage(n: number): CardInPlay[] {
  return Array.from({ length: n }, () => ({
    cardId: Cards.upgrades.token.advantage,
    playId: "@",
    owner: 1 as const,
    controller: 1 as const,
  }));
}

function advantageCount(unit: { upgrades: { cardId: string }[] } | undefined): number {
  return unit ? unit.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage).length : -1;
}

describe("ASH_T02 Advantage token — stats", () => {
  it("gives the attached unit +1 power and +0 HP", () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // Battlefield Marine is 3/3.
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, advantage(1))
      .Build();
    g.loadNewState(s);

    const unit = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(unit.CurrentPower()).toBe(4); // 3 + 1
    expect(unit.TotalHP()).toBe(3); // unchanged — Advantage is +0 HP
  });

  it("stacks: each Advantage token gives another +1 power", () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, advantage(3))
      .Build();
    g.loadNewState(s);

    const unit = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(unit.CurrentPower()).toBe(6); // 3 + 3
    expect(unit.TotalHP()).toBe(3);
  });
});

describe("ASH_T02 Advantage token — defeats itself when the attack or defense ends", () => {
  it("is defeated after the attached unit attacks a base, but the +1 still counts", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, advantage(2))
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // 3 power + 2 Advantage = 5 damage dealt before the tokens defeat.
    expect(g.state.player2.base.damage).toBe(5);
    expect(advantageCount(g.state.player1.groundArena[0])).toBe(0);
  });

  it("is defeated on BOTH the attacker and the defending unit", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // Scavenging Sandcrawler is 1/7 — both units survive the trade, so their upgrades can be checked.
      .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, advantage(1))
      .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, advantage(1))
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Attacker: 1 + 1 = 2 damage to the defender. Defender: 1 + 1 = 2 counter-damage.
    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player1.groundArena[0].damage).toBe(2);

    // The attacker's attack ended and the defender's defense ended — both tokens defeat.
    expect(advantageCount(g.state.player1.groundArena[0])).toBe(0);
    expect(advantageCount(g.state.player2.groundArena[0])).toBe(0);
  });

  it("leaves Advantage tokens on units that did not attack or defend", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, advantage(1))
      // A bystander that takes no part in the attack.
      .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler)
      .WithUpgradesOnGroundUnitForPlayer(1, 1, advantage(2))
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(advantageCount(g.state.player1.groundArena[0])).toBe(0); // attacked
    expect(advantageCount(g.state.player1.groundArena[1])).toBe(2); // untouched
  });

  it("the +1 is counted in combat damage, so it can defeat the defender", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // 3-power Marine + 1 Advantage = 4, enough to defeat a System Patrol Craft (3/4).
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, advantage(1))
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(s);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    // Attacker deals 3 + 1 = 4 to a 4 HP defender — defeated.
    expect(g.state.player2.spaceArena).toHaveLength(0);
    // The attacker survives (took 3 counter-damage on 4 HP) and its token is spent.
    expect(advantageCount(g.state.player1.spaceArena[0])).toBe(0);
  });
});
