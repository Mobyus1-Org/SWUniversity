import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_128 Outflank (Event, cost 1, Command, Tactic) — "Attack with 2 units (one at a time)."
//
// First consumer of the sequential multi-attack mechanic. "One at a time" is the whole
// difficulty: the second attacker is chosen only AFTER the first attack has fully resolved, so
// the eligible list has to be rebuilt (the first attacker is exhausted by then, and either unit
// may have died).
//
// The chain is built by attaching the next pick as the attack's continuation, which is also what
// makes the count survive a defender's counter-attack killing the first attacker.

const OUTFLANK = "SHD_128";
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, OUTFLANK)
    .WithActivePlayer(1);
}

describe("SHD_128 Outflank", () => {
  it("attacks with two different units, one at a time", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);  // first attacker
    await g.chooseBaseAsync(1, 2);
    await g.chooseGroundUnitAsync(1, 1);  // second attacker, chosen after the first resolved
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(6); // 3 + 3
    expect(g.state.player1.groundArena.every(u => !u.ready)).toBe(true);
  });

  it("does not offer the first attacker again — it is exhausted by then", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const firstPlayId = g.state.player1.groundArena[0].playId;
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    expect(pending?.type).toBe("Target");
    const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
    expect(offered).not.toContain(firstPlayId);
    expect(offered).toHaveLength(1);
  });

  it("stops cleanly when only one unit can attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("continues to the second attack even if the first attacker dies to the counter", async () => {
    // The chain rides on the attack's continuation, so a dead attacker must not swallow it.
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)   // 3/3, dies to the 3-power counter
        .WithGroundUnitForPlayer(1, CSF)
        .WithGroundUnitForPlayer(2, CSF)      // 3/7, survives and counters for 3
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.chooseGroundUnitAsync(1, marineIdx);
    await g.chooseGroundUnitAsync(2, 0);       // attack into the 3/7
    expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(false);

    // The second pick still happens.
    const csfIdx = g.state.player1.groundArena.findIndex(u => u.cardId === CSF);
    await g.chooseGroundUnitAsync(1, csfIdx);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("does nothing with no unit able to attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE, false).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.base.damage).toBe(0);
  });
});
