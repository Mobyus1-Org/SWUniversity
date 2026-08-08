import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { playCost } from "@/server/engine/card-playability";

// TS26_10 Dooku's Palace (Base) — "Epic Action: Play a unit from your hand. It costs 1
// resource less for each friendly leader unit."
//
// Expectations run against playCost rather than the printed cost: Battlefield Marine is
// Command/Heroism and this base + leader only cover Command, Vigilance and Villainy, so the
// real cost carries a +2 aspect penalty. playCost is the engine's single source for that.

const readyResources = (g: GameTestAdapter) =>
  g.state.player1.resources.filter(r => r.ready).length;

const MARINE = Cards.units.sor.battlefieldMarine;

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.ts26.dookusPalace)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, MARINE);
}

describe("TS26_10 Dooku's Palace", () => {
  it("reduces the unit's cost by 1 for a single friendly leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .Build(),
    );
    const full = playCost(g.state, 1, MARINE);
    const before = readyResources(g);

    await g.useBaseAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(true);
    expect(readyResources(g)).toBe(before - (full - 1));
    expect(g.state.player1.base.epicActionUsed).toBe(true);
  });

  it("reduces the cost by 2 for two friendly leader units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.maul)
        .Build(),
    );
    const full = playCost(g.state, 1, MARINE);
    const before = readyResources(g);

    await g.useBaseAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(true);
    expect(readyResources(g)).toBe(before - (full - 2));
  });

  it("charges full price when no friendly leader unit is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku) // undeployed — not a leader UNIT
        .Build(),
    );
    const full = playCost(g.state, 1, MARINE);
    const before = readyResources(g);

    await g.useBaseAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(true);
    expect(readyResources(g)).toBe(before - full);
  });

  it("never reduces the cost below 0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        // 5 leader units vs a cost of 4 — the reduction overshoots.
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.maul)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.rex)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.savageOpress)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.asajjVentress)
        .Build(),
    );
    const full = playCost(g.state, 1, MARINE);
    const before = readyResources(g);
    expect(full).toBeLessThan(5); // guards the premise: the reduction really does overshoot

    await g.useBaseAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(true);
    expect(readyResources(g)).toBe(before); // free, never negative
  });

  it("rejects a non-unit card from hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
        .Build(),
    );

    await g.useBaseAbilityAsync(1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();

    await g.chooseCardFromHandAsync(1, 1); // the event
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);

    // Prompt still live — the unit is still playable.
    await g.chooseCardFromHandAsync(1, 0);
    expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(true);
  });
});
