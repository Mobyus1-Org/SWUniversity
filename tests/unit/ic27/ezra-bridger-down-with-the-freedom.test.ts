import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_113 Ezra Bridger — Down With the Freedom (1/3 Ground, cost 2, Aggression/Heroism)
//   "Raid 2. On Attack: Give another friendly Heroism unit Raid 2 for this phase."

const EZRA = Cards.units.ic27.ezraBridger;
const MARINE = Cards.units.sor.battlefieldMarine;     // 3/3 Command/Heroism
const XWING = Cards.units.sor.allianceXWing;          // 2/3 space, Heroism
const SWOOP = Cards.units.sor.swoopRacer;             // Cunning — not Heroism
const TROOPER = Cards.units.sor.deathStarStormtrooper; // Villainy

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, EZRA);
}

const targets = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] } | undefined)?.fromPlayIds ?? [];

describe("IC27_113 Ezra Bridger", () => {
  it("Raid 2: he attacks the base for 1 + 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("offers only OTHER friendly Heroism units, either arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, XWING)
      .WithGroundUnitForPlayer(1, SWOOP).WithGroundUnitForPlayer(1, TROOPER)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect([...targets(g)].sort()).toEqual(
      [g.state.player1.groundArena[1].playId, g.state.player1.spaceArena[0].playId].sort());
  });

  it("the chosen unit attacks later this phase with +2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, XWING).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });
    expect(g.state.player2.base.damage).toBe(3);

    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3 + 5);
  });

  it("with no other friendly Heroism unit there is no prompt and the attack lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, SWOOP).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(3);
  });
});
