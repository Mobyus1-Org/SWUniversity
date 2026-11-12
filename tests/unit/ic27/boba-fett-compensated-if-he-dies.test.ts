import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_146 Boba Fett — Compensated If He Dies (4/7 Ground, cost 5, Cunning/Villainy)
//   "When Attack Ends: If the defending unit was defeated, you may ready 2 resources."
// No "if this unit survived" — it resolves even when Boba dies in the trade.

const BOBA = Cards.units.ic27.bobaFett;
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3 — dies to Boba's 4
const CSF = Cards.units.sor.consularSecurityForce; // 3/7 — survives

function board(bobaDamage = 0, exhausted = 3) {
  const state = new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 4)
    .WithGroundUnitForPlayer(1, BOBA, true, bobaDamage)
    .WithGroundUnitForPlayer(2, MARINE)
    .WithGroundUnitForPlayer(2, CSF)
    .Build();
  for (let i = 0; i < exhausted; i++) state.player1.resources[i].ready = false;
  return state;
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as { type?: string } | undefined;
const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

async function attack(g: GameTestAdapter, defenderIdx: number) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[defenderIdx].playId] });
}

describe("IC27_146 Boba Fett", () => {
  it("defender defeated: readies exactly 2 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board());

    await attack(g, 0);
    expect(res(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);

    expect(ready(g)).toBe(3);
  });

  it("declining readies nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board());

    await attack(g, 0);
    await g.chooseNoAsync(1);

    expect(ready(g)).toBe(1);
  });

  it("defender survives: no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board());

    await attack(g, 1);

    expect(res(g)).toBeFalsy();
    expect(ready(g)).toBe(1);
  });

  it("attacking a base: no defending unit, no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(res(g)).toBeFalsy();
  });

  it("Boba dies in the trade and still gets paid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6)); // 1 HP left — the Marine's 3 kills him

    await attack(g, 0);
    expect(g.state.player1.groundArena).toHaveLength(0);
    await g.chooseYesAsync(1);

    expect(ready(g)).toBe(3);
  });

  it("only one exhausted resource: readies just that one", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(0, 1));

    await attack(g, 0);
    await g.chooseYesAsync(1);

    expect(ready(g)).toBe(4);
  });

  it("nothing exhausted: no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(0, 0));

    await attack(g, 0);

    expect(res(g)).toBeFalsy();
  });
});
