import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TS26_11 Executioner's Arena (Base) — "Epic Action: For each friendly leader unit, you may
// deal 2 damage to a unit."
//
// "you may" is per iteration, so each repetition can be declined independently, and each
// picks its own target — both damage instances may land on the same unit.

const TOUGH = Cards.units.lof.hyperspaceWayfarer; // 4/10 Space, no abilities — survives 4 damage

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.ts26.executionersArena)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
    .WithSpaceUnitForPlayer(2, TOUGH);
}

describe("TS26_11 Executioner's Arena", () => {
  it("deals 2 damage to the chosen unit for one friendly leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .Build(),
    );

    await g.useBaseAbilityAsync(1);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(2);
    expect(g.state.player1.base.epicActionUsed).toBe(true);
  });

  it("can be declined, dealing no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .Build(),
    );

    await g.useBaseAbilityAsync(1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();

    await g.chooseNoAsync(1);

    expect(g.state.player2.spaceArena[0].damage).toBe(0);
    expect(g.state.player1.base.epicActionUsed).toBe(true);
  });

  it("repeats once per leader unit and may stack both on one target", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.maul)
        .Build(),
    );

    await g.useBaseAbilityAsync(1);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(4);
  });

  it("allows accepting one repetition and declining the next", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.maul)
        .Build(),
    );

    await g.useBaseAbilityAsync(1);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.spaceArena[0].damage).toBe(2);
  });

  it("defeats a unit whose HP the damage exceeds", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        // Coleman Trebor is 2/2 — a single 2-damage hit kills him.
        .WithGroundUnitForPlayer(2, Cards.units.ts26.colemanTrebor)
        .Build(),
    );

    await g.useBaseAbilityAsync(1);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("does nothing when no friendly leader unit is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku) // undeployed
        .Build(),
    );

    await g.useBaseAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
    expect(g.state.player1.base.epicActionUsed).toBe(true);
  });
});
