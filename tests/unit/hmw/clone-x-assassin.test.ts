import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_059 Clone X Assassin (1/3 Ground, cost 2, Vigilance/Villainy, Imperial/Clone/Trooper) —
//   "When Defeated: You may give a Weakness token to a unit."
//
// "A unit" is unqualified, so either side is a legal target — including whatever just killed it.
//
// The Weakness token is the only upgrade in the engine that LOWERS its host's HP, so it can be
// immediately lethal. The defeat trigger therefore has to sweep afterwards, and this is the first
// card where that sweep happens while another defeat is already resolving.

const ASSASSIN = "HMW_059";
const WEAKNESS = "HMW_T02";
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14)
    .WithActivePlayer(2);
}

/** P2 attacks the Assassin with a 3/3, which kills it (1/3) and survives the counter. */
async function killTheAssassin(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(2, 0);
  const idx = g.state.player1.groundArena.findIndex(u => u.cardId === ASSASSIN);
  await g.chooseGroundUnitAsync(1, idx);
}

const tokensOn = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(x => x.cardId === WEAKNESS).length;

describe("HMW_059 Clone X Assassin", () => {
  it("gives a Weakness token to a chosen enemy unit when defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, ASSASSIN)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await killTheAssassin(g);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(tokensOn(g.state.player2.groundArena[0])).toBe(1);
  });

  it("can token a FRIENDLY unit — 'a unit' is unqualified", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, ASSASSIN)
        .WithGroundUnitForPlayer(1, CSF)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await killTheAssassin(g);
    await g.chooseYesAsync(1);
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === CSF);
    await g.chooseGroundUnitAsync(1, idx);

    expect(tokensOn(g.state.player1.groundArena[idx])).toBe(1);
  });

  it("is optional — declining gives no token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, ASSASSIN)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await killTheAssassin(g);
    await g.chooseNoAsync(1);

    expect(tokensOn(g.state.player2.groundArena[0])).toBe(0);
  });

  it("the −1/−1 is real: a tokened 3/3 becomes a 2/2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, ASSASSIN)
        .WithGroundUnitForPlayer(2, CSF)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await killTheAssassin(g);
    await g.chooseYesAsync(1);
    const idx = g.state.player2.groundArena.findIndex(u => u.cardId === MARINE);
    await g.chooseGroundUnitAsync(2, idx);

    const marine = g.state.player2.groundArena.find(u => u.cardId === MARINE)!;
    expect(Unit.FromInterface(marine).CurrentPower()).toBe(2); // 3 - 1
    expect(Unit.FromInterface(marine).TotalHP()).toBe(2);      // 3 - 1
  });

  it("a lethal token defeats the target and the body is swept", async () => {
    // The Weakness token lowers HP, so a unit already at its last point dies on attach.
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, ASSASSIN)
        .WithGroundUnitForPlayer(2, CSF)
        .WithGroundUnitForPlayer(2, MARINE, true, 2) // 3/3 on 2 damage → 1 HP left
        .Build(),
    );

    await killTheAssassin(g);
    await g.chooseYesAsync(1);
    const idx = g.state.player2.groundArena.findIndex(u => u.cardId === MARINE);
    await g.chooseGroundUnitAsync(2, idx);

    expect(g.state.player2.groundArena.some(u => u.cardId === MARINE)).toBe(false);
  });

  it("does not fire when a DIFFERENT unit is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, ASSASSIN)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    // P2's 3/7 kills the 3/3 Marine; the Assassin is untouched, so nothing should be asked.
    await g.attackWithGroundUnitAsync(2, 0);
    const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.chooseGroundUnitAsync(1, marineIdx);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(tokensOn(g.state.player2.groundArena[0])).toBe(0);
  });
});
