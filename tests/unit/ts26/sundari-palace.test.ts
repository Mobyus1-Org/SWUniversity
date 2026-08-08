import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TS26_12 Sundari Palace (Base) — "Epic Action: For each friendly leader unit, you may
// resource a card from your hand and ready it. If you do, defeat that many friendly
// resources at the start of the regroup phase."
//
// Each repetition is an independent "may" over the CURRENT hand, so the prompt is rebuilt
// between iterations rather than pre-chained with stale hand indices. The debt is recorded
// as an UntilStartOfRegroup effect carrying the number actually resourced.

const MARINE = Cards.units.sor.battlefieldMarine;

const resourceCount = (g: GameTestAdapter) => g.state.player1.resources.length;
const readyCount = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.ts26.sundariPalace)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 5)
    .WithCardInHandForPlayer(1, MARINE)
    .WithCardInHandForPlayer(1, Cards.units.ts26.colemanTrebor);
}

describe("TS26_12 Sundari Palace", () => {
  it("resources a chosen card ready for one friendly leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .Build(),
    );
    const before = resourceCount(g);
    const readyBefore = readyCount(g);

    await g.useBaseAbilityAsync(1);
    await g.chooseOptionAsync(1, "0"); // resource hand card 0

    expect(resourceCount(g)).toBe(before + 1);
    expect(readyCount(g)).toBe(readyBefore + 1); // it enters READY
    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player1.base.epicActionUsed).toBe(true);
  });

  it("can skip the repetition, resourcing nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .Build(),
    );
    const before = resourceCount(g);

    await g.useBaseAbilityAsync(1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    await g.chooseOptionAsync(1, "skip");

    expect(resourceCount(g)).toBe(before);
    expect(g.state.player1.hand).toHaveLength(2);
  });

  it("repeats once per leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.maul)
        .Build(),
    );
    const before = resourceCount(g);

    await g.useBaseAbilityAsync(1);
    await g.chooseOptionAsync(1, "0");
    await g.chooseOptionAsync(1, "0"); // indices re-derived from the shrunken hand

    expect(resourceCount(g)).toBe(before + 2);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("defeats one resource per card resourced at the start of regroup", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.maul)
        .Build(),
    );

    await g.useBaseAbilityAsync(1);
    await g.chooseOptionAsync(1, "0");
    await g.chooseOptionAsync(1, "0");
    const afterEpic = resourceCount(g);

    // End the action phase so the regroup phase starts.
    // P1 already acted, so the turn is P2's — pass in that order to end the action phase.
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});
    expect(g.state.gamePhase).not.toBe("ActionPhase");

    expect(resourceCount(g)).toBe(afterEpic - 2);
  });

  it("charges no regroup debt when every repetition was skipped", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .Build(),
    );
    const before = resourceCount(g);

    await g.useBaseAbilityAsync(1);
    await g.chooseOptionAsync(1, "skip");

    // P1 already acted, so the turn is P2's — pass in that order to end the action phase.
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});
    expect(g.state.gamePhase).not.toBe("ActionPhase");

    expect(resourceCount(g)).toBe(before);
  });

  it("does nothing when no friendly leader unit is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku) // undeployed
        .Build(),
    );
    const before = resourceCount(g);

    await g.useBaseAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(resourceCount(g)).toBe(before);
    expect(g.state.player1.hand).toHaveLength(2);
    expect(g.state.player1.base.epicActionUsed).toBe(true);
  });
});
