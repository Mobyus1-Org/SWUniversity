import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// IC27_126 Saw Gerrera — For the Cause (6/5 Ground, cost 5, Aggression/Aggression)
//   "On Attack: You may double another friendly unit's power for this phase."
// Doubling is a multiplier: it applies after every other modifier (Raid included) and stacks.

const SAW = Cards.units.ic27.sawGerrera;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const BRAGGART = Cards.units.sor.cantinaBraggart; // 0/3, Raid 2
const XWING = Cards.units.sor.allianceXWing;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, SAW);
}

const targets = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] } | undefined)?.fromPlayIds ?? [];
const power = (u: Parameters<typeof Unit.FromInterface>[0]) => Unit.FromInterface(u).CurrentPower();

async function sawAttacks(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.chooseBaseAsync(1, 2);
}

describe("IC27_126 Saw Gerrera", () => {
  it("doubles the chosen friendly unit's power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, XWING).Build());

    await sawAttacks(g);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });

    expect(power(g.state.player1.groundArena[1])).toBe(6);
    expect(power(g.state.player1.spaceArena[0])).toBe(2);
    expect(g.state.player2.base.damage).toBe(6); // Saw's own attack is untouched
  });

  it("offers only OTHER friendly units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, XWING)
      .WithGroundUnitForPlayer(2, MARINE).Build());

    await sawAttacks(g);
    await g.chooseYesAsync(1);

    expect([...targets(g)].sort()).toEqual(
      [g.state.player1.groundArena[1].playId, g.state.player1.spaceArena[0].playId].sort());
  });

  it("declining changes nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    await sawAttacks(g);
    await g.chooseNoAsync(1);

    expect(power(g.state.player1.groundArena[1])).toBe(3);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("no other friendly unit: no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).Build());

    await sawAttacks(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("doubles the MODIFIED power (Experience token: 4 → 8)", async () => {
    const g = new GameTestAdapter();
    const state = board().WithGroundUnitForPlayer(1, MARINE).Build();
    state.player1.groundArena[1].upgrades = [{ cardId: Cards.upgrades.token.experience, playId: "xp", owner: 1, controller: 1 }];
    g.loadNewState(state);

    await sawAttacks(g);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });

    expect(power(g.state.player1.groundArena[1])).toBe(8);
  });

  it("Raid is added before doubling: a doubled Cantina Braggart attacks for (0 + 2) × 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, BRAGGART).Build());

    await sawAttacks(g);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(6 + 4);
  });
});
