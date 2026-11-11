import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_202 Inferno Squad — We Can Grieve Later (3/6 Ground, cost 5, Cunning/Villainy)
//   "When Played/When Defeated: You may deal 1 damage to a unit and give a Weakness token to it."
// "A unit" is any unit, Inferno Squad itself included on the When Played side. The halves are
// simultaneous, so a Shield absorbs the damage but the token still lands; a target the damage
// defeats has no host left for the token.

const INFERNO = Cards.units.hmw.infernoSquad;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Ground
const WAMPA = Cards.units.sor.wampa;              // 4/5 Ground
const WEAKNESS = Cards.units.token.weakness;
const SHIELD = Cards.upgrades.token.shield;

const weakness = (u: { upgrades: Array<{ cardId: string }> }) => u.upgrades.filter(x => x.cardId === WEAKNESS).length;
const resolution = (g: GameTestAdapter) =>
  g.lastDispatchResponse?.resolutionNeeded as { type?: string; fromPlayIds?: string[] } | undefined;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14);
}

describe("HMW_202 Inferno Squad — When Played", () => {
  it("may deal 1 damage to an enemy unit and give it a Weakness token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, INFERNO).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(resolution(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    expect(resolution(g)?.fromPlayIds).toHaveLength(2); // the marine and Inferno Squad itself
    await g.chooseGroundUnitAsync(2, 0);

    const marine = g.state.player2.groundArena[0];
    expect(marine.damage).toBe(1);
    expect(weakness(marine)).toBe(1);
    expect(Unit.FromInterface(marine).CurrentPower()).toBe(2);
  });

  it("declining does neither", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, INFERNO).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    const marine = g.state.player2.groundArena[0];
    expect(marine.damage).toBe(0);
    expect(weakness(marine)).toBe(0);
  });

  it("a Shield absorbs the damage, but the Weakness token is still given", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithCardInHandForPlayer(1, INFERNO)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(SHIELD, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    const marine = g.state.player2.groundArena[0];
    expect(marine.damage).toBe(0);
    expect(marine.upgrades.map(u => u.cardId)).toEqual([WEAKNESS]);
  });

  it("a target the damage defeats gets no token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithCardInHandForPlayer(1, INFERNO)
        .WithGroundUnitForPlayer(2, MARINE, true, 2) // 1 HP left
        .WithGroundUnitForPlayer(2, WAMPA)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([WAMPA]);
    expect(weakness(g.state.player2.groundArena[0])).toBe(0);
    expect(g.state.player2.discard.map(d => d.cardId)).toEqual([MARINE]);
  });

  it("the Weakness -1 HP can finish a unit the damage alone left alive", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithCardInHandForPlayer(1, INFERNO)
        .WithGroundUnitForPlayer(2, MARINE, true, 1) // 2 HP left: survives the 1 damage, not the -1 HP
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("can target itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, INFERNO).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    const self = g.state.player1.groundArena[0];
    expect(self.damage).toBe(1);
    expect(weakness(self)).toBe(1);
  });
});

describe("HMW_202 Inferno Squad — When Defeated", () => {
  // Inferno Squad (3/6, 5 damage) attacks a Wampa (4/5) and dies; the Wampa survives with 3.
  function defeatedBoard() {
    return board()
      .WithGroundUnitForPlayer(1, INFERNO, true, 5)
      .WithGroundUnitForPlayer(2, WAMPA)
      .WithGroundUnitForPlayer(2, MARINE);
  }

  it("may deal 1 damage to a unit and give it a Weakness token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(defeatedBoard().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(resolution(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    expect(resolution(g)?.fromPlayIds).toHaveLength(2);
    const marine = g.state.player2.groundArena.find(u => u.cardId === MARINE)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine.playId] });

    const after = g.state.player2.groundArena.find(u => u.cardId === MARINE)!;
    expect(after.damage).toBe(1);
    expect(weakness(after)).toBe(1);
  });

  it("declining does neither", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(defeatedBoard().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    const marine = g.state.player2.groundArena.find(u => u.cardId === MARINE)!;
    expect(marine.damage).toBe(0);
    expect(weakness(marine)).toBe(0);
  });
});
