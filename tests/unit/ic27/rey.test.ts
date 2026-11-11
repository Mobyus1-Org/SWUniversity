import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_002 Rey — In Balance (Leader, Vigilance/Heroism; unit side 3/6 Ground)
//   Front: "Action [1 resource, Exhaust]: Give an Experience token to a damaged unit."
//   Unit:  "On Attack: You may give an Experience token to a damaged unit."
// "A damaged unit" is either side's, either arena — Rey herself included once deployed.

const REY = Cards.leaders.ic27.rey;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Ground
const XP = Cards.upgrades.token.experience;

const count = (u: { upgrades: Array<{ cardId: string }> }, id: string) =>
  u.upgrades.filter(x => x.cardId === id).length;
const targets = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(REY)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

describe("IC27_002 Rey — leader Action", () => {
  it("gives an Experience token to a damaged unit, either side; undamaged units are not offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithGroundUnitForPlayer(1, MARINE)          // undamaged — ineligible
        .WithGroundUnitForPlayer(1, MARINE, true, 1) // damaged friendly
        .WithGroundUnitForPlayer(2, MARINE, true, 2) // damaged enemy
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    const enemy = g.state.player2.groundArena[0];
    expect(targets(g).sort()).toEqual([g.state.player1.groundArena[1].playId, enemy.playId].sort());

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy.playId] });
    expect(count(g.state.player2.groundArena[0], XP)).toBe(1);
    expect(count(g.state.player1.groundArena[1], XP)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(readyResources(g)).toBe(7);
  });

  it("is still usable with no damaged unit — pays its cost and does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(count(g.state.player1.groundArena[0], XP)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(readyResources(g)).toBe(7);
  });
});

describe("IC27_002 Rey — deployed", () => {
  async function deployAndAttack(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1;
    const reyIdx = g.state.player1.groundArena.findIndex(u => u.cardId === REY);
    await g.attackWithGroundUnitAsync(1, reyIdx);
    await g.chooseBaseAsync(1, 2);
  }

  it("On Attack: may give an Experience token to a damaged unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE, true, 1).Build());

    await deployAndAttack(g);
    await g.chooseYesAsync(1);
    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    expect(targets(g)).toEqual([marine.playId]); // undamaged Rey is not offered
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine.playId] });

    expect(count(g.state.player1.groundArena.find(u => u.cardId === MARINE)!, XP)).toBe(1);
  });

  it("On Attack: declining gives nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE, true, 1).Build());

    await deployAndAttack(g);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(count(g.state.player1.groundArena.find(u => u.cardId === MARINE)!, XP)).toBe(0);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("On Attack: a damaged Rey may give the token to herself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1;
    const rey = g.state.player1.groundArena.find(u => u.cardId === REY)!;
    rey.damage = 2;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    expect(targets(g)).toEqual([rey.playId]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [rey.playId] });
    expect(count(g.state.player1.groundArena[0], XP)).toBe(1);
  });

  it("On Attack: no prompt when nothing is damaged", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    await deployAndAttack(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(3);
  });
});
