import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_057 Benthic "Two Tubes" — The War Has Just Begun (3/2 Ground, Underworld/Trooper, cost 2)
//   "On Attack: Deal 1 damage to an enemy ground unit."
//   "When Defeated: Deal 1 damage to a base."
//
// Both are mandatory. The On Attack is restricted to ENEMY GROUND units; the When Defeated says
// "a base", so either base is a legal choice.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("LAW_057 Benthic “Two Tubes” — On Attack", () => {
  it("deals 1 damage to a chosen enemy ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.law.benthicTwoTubesLaw)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);       // attack the base, so combat doesn't muddy the count
    await g.chooseGroundUnitAsync(2, 0); // the On Attack target

    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("only ENEMY GROUND units are eligible — friendlies and space units are not", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.law.benthicTwoTubesLaw)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    const afterTarget = await g.chooseBaseAsync(1, 2);

    const res = afterTarget.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player2.groundArena[0].playId);
    expect(res.fromPlayIds).not.toContain(g.state.player2.spaceArena[0].playId);
    expect(res.fromPlayIds).not.toContain(g.state.player1.groundArena[0].playId);
  });

  it("no prompt when the opponent has no ground unit (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.law.benthicTwoTubesLaw).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    const afterTarget = await g.chooseBaseAsync(1, 2);

    expect(afterTarget.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(3); // combat damage only
  });
});

describe("LAW_057 Benthic “Two Tubes” — When Defeated", () => {
  it("deals 1 damage to the chosen base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.law.benthicTwoTubesLaw)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3 power kills a 3/2
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // Benthic's controller picks the enemy base

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("'a base' means either — the controller may pick their own", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.law.benthicTwoTubesLaw)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(0);
  });
});
