import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_151 Red Five — Running the Trench (3/4 Space, Rebel/Vehicle/Fighter, cost 3)
// "On Attack: You may deal 2 damage to a damaged unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
    .WithSpaceUnitForPlayer(1, Cards.units.jtl.redFive);
}

describe("JTL_151 Red Five", () => {
  it("On Attack: deals 2 damage to a chosen damaged unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards, true, 1) // damaged (4 HP, 1 dmg)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3); // 1 + 2
  });

  it("declining the optional trigger deals no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards, true, 1)
        .Build(),
    );

    const attacked = await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(1); // unchanged
    expect(attacked).toBeDefined();
  });

  it("an UNDAMAGED unit is not a legal target", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // undamaged
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 1) // damaged
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    const undamagedPlayId = g.state.player2.groundArena.find(
      u => u.cardId === Cards.units.sor.gamorreanGuards,
    )!.playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [undamagedPlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.gamorreanGuards)!.damage).toBe(0);
  });

  it("no prompt at all when no unit is damaged", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // undamaged
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // The attack resolved with no On-Attack prompt left open.
    expect(g.state.player2.base.damage).toBe(3); // Red Five's power
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("can target a damaged FRIENDLY unit ('a damaged unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards, true, 1) // friendly, damaged
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(3); // 1 + 2
  });
});
