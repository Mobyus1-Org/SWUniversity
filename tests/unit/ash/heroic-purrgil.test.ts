import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_207 Heroic Purrgil (3/6 Space, cost 5)
// "Ambush (When you play this unit, it may attack an enemy unit.)"
// "While attacking using Ambush, this unit gets +2/+0."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_207 Heroic Purrgil", () => {
  it("deals 5 damage when attacking via Ambush (3 base + 2)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.heroicPurrgil)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // 4/10 — survives to be measured
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(5);
  });

  it("deals only 3 damage on a normal attack (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.heroicPurrgil)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(3);
  });

  it("clears the Ambush buff once the attack has resolved", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.heroicPurrgil)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(5);
    // The buff is ForAttack, so nothing survives into the rest of the phase.
    expect(g.state.currentEffects.filter(e => e.duration === "ForAttack")).toHaveLength(0);
  });

  it("may decline the Ambush attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.heroicPurrgil)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.spaceArena[0].damage).toBe(0);
    expect(g.state.player1.spaceArena).toHaveLength(1); // it entered play, it just didn't attack
  });
});
