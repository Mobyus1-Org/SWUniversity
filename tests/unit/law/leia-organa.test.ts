import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";

// LAW_010 Leia Organa — Someone Who Loves You (leader; deployed 2/2 Ground)
// FRONT:    "Action [2 resources, Exhaust]: For this phase, give a unit +1/+1 for each different
//            aspect it has."
// DEPLOYED: "Overwhelm"
//           "When Deployed: Choose a unit. Give an Experience token to that unit for each different
//            aspect among units you control."

// Battlefield Marine (SOR_095) has Command + Heroism → 2 different aspects.
// System Patrol Craft (SOR_066) has Vigilance only → 1 aspect.
// Scavenging Sandcrawler (LAW_238) — used as a plain body.

function xpCount(unit: { upgrades: { cardId: string }[] }) {
  return unit.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience).length;
}

describe("LAW_010 Leia Organa — leader side Action", () => {
  it("gives +1/+1 for each DIFFERENT aspect the chosen unit has", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.law.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Command + Heroism = 2 aspects
      .Build();
    g.loadNewState(s);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    const marine = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(marine.CurrentPower()).toBe(5); // 3 + 2
    expect(marine.TotalHP()).toBe(5); // 3 + 2
    // Cost: 2 resources + exhaust.
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(6);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("a single-aspect unit only gets +1/+1", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.law.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft) // Vigilance only
      .Build();
    g.loadNewState(s);

    await g.useLeaderAbilityAsync(1);
    await g.chooseSpaceUnitAsync(1, 0);

    const craft = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(craft.CurrentPower()).toBe(4); // 3 + 1
    expect(craft.TotalHP()).toBe(5); // 4 + 1
  });
});

describe("LAW_010 Leia Organa — deployed side", () => {
  it("has Overwhelm", () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.law.leiaOrgana, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.law.leiaOrgana)
      .Build();
    g.loadNewState(s);

    const leia = g.state.player1.groundArena[0];
    expect(HasOverwhelm(leia.cardId, leia.playId, 1)).toBe(true);
  });

  it("When Deployed: gives an Experience token per different aspect among units you control", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.law.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
      // Units you control: Marine (Command, Heroism) + Patrol Craft (Vigilance) → 3 distinct
      // aspects. Leia herself deploys as a unit (Command, Heroism) — no new aspects.
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(s);

    await g.deployLeaderAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // give the tokens to the Marine

    expect(xpCount(g.state.player1.groundArena[0])).toBe(3);
  });

  it("counts each aspect once, however many units share it", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.law.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
      // Three copies of the same 2-aspect unit → still only 2 distinct aspects.
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.deployLeaderAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(xpCount(g.state.player1.groundArena[0])).toBe(2); // Command + Heroism
  });
});
