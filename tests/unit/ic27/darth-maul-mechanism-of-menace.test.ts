import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_005 Darth Maul — Mechanism of Menace (Leader, Aggression/Villainy; unit side 4/5 Ground)
//   Front: "Action [1 resource, Exhaust]: Deal 1 damage to a unit."
//   Unit:  "On Attack: You may deal 1 damage to a unit."
// "A unit" is either side's, either arena — Maul himself included once deployed.

const MAUL = Cards.leaders.ic27.darthMaul;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Ground
const SHIELD = Cards.upgrades.token.shield;

const resolution = (g: GameTestAdapter) =>
  g.lastDispatchResponse?.resolutionNeeded as { type?: string; fromPlayIds?: string[] } | undefined;
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(MAUL)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

describe("IC27_005 Darth Maul — leader Action", () => {
  it("deals 1 damage to the chosen enemy unit; every unit is offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.useLeaderAbilityAsync(1);
    expect(resolution(g)?.fromPlayIds).toHaveLength(2);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(readyResources(g)).toBe(7);
  });

  it("can damage a friendly unit, defeating it at 1 remaining HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE, true, 2).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(MARINE);
  });

  it("a Shield absorbs the damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(SHIELD, 2)])
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });

  it("is still usable with no unit in play — pays its cost and does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.useLeaderAbilityAsync(1);

    expect(resolution(g)).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(false);
    expect(readyResources(g)).toBe(7);
  });
});

describe("IC27_005 Darth Maul — deployed", () => {
  async function deploy(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1;
    return g.state.player1.groundArena.findIndex(u => u.cardId === MAUL);
  }

  it("On Attack: may deal 1 damage to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter).Build());

    const maulIdx = await deploy(g);
    await g.attackWithGroundUnitAsync(1, maulIdx);
    await g.chooseBaseAsync(1, 2);
    expect(resolution(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    expect(resolution(g)?.fromPlayIds).toHaveLength(3); // Maul, the marine and the space unit
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("On Attack: declining deals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).Build());

    const maulIdx = await deploy(g);
    await g.attackWithGroundUnitAsync(1, maulIdx);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("On Attack: Maul can damage himself (he is the only unit)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    const maulIdx = await deploy(g);
    await g.attackWithGroundUnitAsync(1, maulIdx);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    const maul = g.state.player1.groundArena[maulIdx];
    expect(resolution(g)?.fromPlayIds).toEqual([maul.playId]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [maul.playId] });

    expect(g.state.player1.groundArena[maulIdx].damage).toBe(1);
  });

  it("On Attack: pinging the defender to death means Maul takes no combat damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE, true, 2).Build());

    const maulIdx = await deploy(g);
    await g.attackWithGroundUnitAsync(1, maulIdx);
    await g.chooseGroundUnitAsync(2, 0); // attack the 1-HP marine
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[maulIdx].damage).toBe(0);
  });
});
