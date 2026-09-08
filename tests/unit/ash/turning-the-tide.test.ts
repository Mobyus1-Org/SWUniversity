import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// ASH_138 Turning the Tide. Cost 3 Command Tactic event.
//   "Choose a unit. Deal 1 damage to it for each friendly unit."
//
// "Friendly" is from the caster's side and spans BOTH arenas. The target is unrestricted — either
// player's units, and your own included.

const TIDE = Cards.events.ash.turningTheTide;
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3 Ground
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7 Ground
const XWING = Cards.units.sor.wingLeader;               // Space

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, TIDE);
}

const enemy = (g: GameTestAdapter, cardId: string) =>
  g.state.player2.groundArena.find(u => u.cardId === cardId);

describe("ASH_138 Turning the Tide", () => {
  it("deals 1 damage per friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );
    const victim = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [victim] });

    expect(enemy(g, SECURITY)!.damage).toBe(2);
  });

  it("counts friendly SPACE units too, not just the target's arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithSpaceUnitForPlayer(1, XWING)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );
    const victim = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [victim] });

    expect(enemy(g, SECURITY)!.damage).toBe(2);
  });

  it("does NOT count enemy units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );
    const victim = g.state.player2.groundArena.find(u => u.cardId === SECURITY)!.playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [victim] });

    expect(enemy(g, SECURITY)!.damage).toBe(1);
  });

  it("deals nothing when you control no units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, SECURITY).Build());
    const victim = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [victim] });

    expect(enemy(g, SECURITY)!.damage).toBe(0);
  });

  it("can be aimed at your own unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );
    const own = g.state.player1.groundArena.find(u => u.cardId === SECURITY)!.playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [own] });

    expect(g.state.player1.groundArena.find(u => u.cardId === SECURITY)!.damage).toBe(2);
  });
});
