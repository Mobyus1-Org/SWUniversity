import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// LOF_002 Mother Talzin — Power Through Magick (leader; deployed 3/7 Ground)
// FRONT:    "Action [Exhaust, use the Force (lose your Force token)]: Give a unit –1/–1 for this phase."
// DEPLOYED: "On Attack: You may give a unit –1/–1 for this phase."

function setup(deployed: boolean) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.lof.motherTalzin, true, deployed)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler) // 1/7 — survives the debuff
    .Build();
}

function enemy(g: GameTestAdapter) {
  return Unit.FromInterface(g.state.player2.groundArena[0]);
}

describe("LOF_002 Mother Talzin — leader side Action", () => {
  it("uses the Force to give a unit –1/–1 for this phase", async () => {
    const g = new GameTestAdapter();
    const s = setup(false);
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.supplemental.forceToken).toBe(false); // the Force was spent
    expect(enemy(g).CurrentPower()).toBe(0); // 1 - 1
    expect(enemy(g).TotalHP()).toBe(6); // 7 - 1
    expect(g.state.player1.leader.ready).toBe(false); // exhausted as the cost
  });

  it("is not available without a Force token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(false)); // no Force token

    const used = await g.useLeaderAbilityAsync(1);

    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(enemy(g).CurrentPower()).toBe(1); // untouched
  });
});

describe("LOF_002 Mother Talzin — deployed side On Attack", () => {
  it("may give a unit –1/–1 for this phase when she attacks", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.motherTalzin, true, true) // deployed
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.lof.motherTalzin) // the leader unit (3/7)
      .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler)
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(enemy(g).CurrentPower()).toBe(0); // 1 - 1
    expect(enemy(g).TotalHP()).toBe(6); // 7 - 1
    // No Force token is needed on the deployed side.
    expect(g.state.player1.supplemental.forceToken).toBeFalsy();
  });

  it("declining the deployed On Attack changes nothing", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.motherTalzin, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.lof.motherTalzin)
      .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler)
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    const attacked = await g.chooseBaseAsync(1, 2);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(attacked.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(enemy(g).CurrentPower()).toBe(1);
    expect(enemy(g).TotalHP()).toBe(7);
  });
});
