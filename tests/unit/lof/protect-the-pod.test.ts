import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_128 Protect the Pod (Event, cost 4, Command, Tactic)
// "A friendly non-Vehicle unit deals damage equal to its remaining HP to an enemy unit."

function setup(extra: (b: GameStateBuilder) => GameStateBuilder = b => b) {
  return extra(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.events.lof.protectThePod)
      // Scavenging Sandcrawler is 1/7 and NOT a Vehicle? It is a Vehicle — use the Marine (3/3).
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler), // 1/7 enemy to soak damage
  ).Build();
}

describe("LOF_128 Protect the Pod", () => {
  it("deals damage equal to the friendly unit's remaining HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // friendly Battlefield Marine (3/3, undamaged)
    await g.chooseGroundUnitAsync(2, 0); // enemy Sandcrawler (1/7)

    expect(g.state.player2.groundArena[0].damage).toBe(3); // its remaining HP = 3
  });

  it("uses REMAINING HP, not total HP", async () => {
    const g = new GameTestAdapter();
    // The Marine already has 2 damage → remaining HP is 1.
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.events.lof.protectThePod)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2)
      .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1); // 3 HP - 2 damage = 1
  });

  it("can defeat the enemy unit", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.events.lof.protectThePod)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 remaining HP
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 HP enemy
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("cannot be played with no friendly non-Vehicle unit", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.events.lof.protectThePod)
      // The only friendly unit is a Vehicle (System Patrol Craft).
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler)
      .Build();
    g.loadNewState(s);

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("cannot be played with no enemy unit", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.events.lof.protectThePod)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
