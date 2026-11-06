import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";

// LAW_007 Boba Fett — Krayt's Claw Commander (Leader, Command/Villainy; unit side 3/6 Ground)
//   Front: "When a friendly Bounty Hunter unit's attack ends: If the defending unit was defeated, you
//           may exhaust this leader. If you do, create a Credit token.
//           Epic Action: If you control 5 or more resources, deploy this leader."
//   Unit:  "Raid 1. When a friendly Bounty Hunter unit's attack ends: If the defending unit was
//           defeated, create a Credit token."
// The attacker need not survive. "Friendly" is the attacker's controller now.

const BOBA = Cards.leaders.law.bobaFett;
const HUNTER = Cards.units.shd.reputableHunter;     // 3/4 Bounty Hunter, no abilities in play
const MARINE = Cards.units.sor.battlefieldMarine;      // not a Bounty Hunter
const DROID = Cards.units.token.battleDroid;           // 1/1
const WAMPA = Cards.units.sor.wampa;                   // 4/5

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(BOBA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const credits = (g: GameTestAdapter, p: 1 | 2 = 1) => (p === 1 ? g.state.player1 : g.state.player2).supplemental.creditTokens ?? 0;

async function attackUnit(g: GameTestAdapter, player: 1 | 2, attackerIndex: number, defenderPlayId: string) {
  await g.attackWithGroundUnitAsync(player, attackerIndex);
  await g.dispatchAsync(player, "choose-target", { targetPlayIds: [defenderPlayId] });
}

describe("LAW_007 Boba Fett — leader side", () => {
  it("a friendly Bounty Hunter defeats the defender: may exhaust Boba for a Credit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HUNTER).WithGroundUnitForPlayer(2, DROID).Build());

    await attackUnit(g, 1, 0, g.state.player2.groundArena[0].playId);
    expect(res(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);

    expect(credits(g)).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("declining keeps Boba ready and makes no Credit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HUNTER).WithGroundUnitForPlayer(2, DROID).Build());

    await attackUnit(g, 1, 0, g.state.player2.groundArena[0].playId);
    await g.chooseNoAsync(1);

    expect(credits(g)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("triggers even when the Bounty Hunter is defeated too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HUNTER, true, 2).WithGroundUnitForPlayer(2, WAMPA, true, 2).Build());

    await attackUnit(g, 1, 0, g.state.player2.groundArena[0].playId);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
    await g.chooseYesAsync(1);

    expect(credits(g)).toBe(1);
  });

  it("not for a non-Bounty Hunter, nor when the defender survives, nor for a base attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, HUNTER)
      .WithGroundUnitForPlayer(2, DROID).WithGroundUnitForPlayer(2, Cards.units.ash.dinosaurTurtle).Build());

    await attackUnit(g, 1, 0, g.state.player2.groundArena[0].playId); // Marine kills the droid
    expect(res(g)).toBeFalsy();
    await g.dispatchAsync(2, "pass-action", {});
    await attackUnit(g, 1, 1, g.state.player2.groundArena[0].playId); // Hunter bounces off the turtle
    expect(res(g)).toBeFalsy();
    expect(credits(g)).toBe(0);
  });

  it("not for the opponent's Bounty Hunter", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, HUNTER).WithGroundUnitForPlayer(1, DROID).WithActivePlayer(2).Build());

    await attackUnit(g, 2, 0, g.state.player1.groundArena[0].playId);

    expect(res(g)).toBeFalsy();
    expect(credits(g, 1) + credits(g, 2)).toBe(0);
  });
});

describe("LAW_007 Boba Fett — deployed", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const bobaIndex = (g: GameTestAdapter) => g.state.player1.groundArena.findIndex(u => u.cardId === BOBA);

  it("Raid 1, and Boba's own kill makes a Credit with no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, DROID).Build());
    await deployed(g);
    const boba = g.state.player1.groundArena[bobaIndex(g)];
    expect(RaidAmount(BOBA, boba.playId, 1)).toBe(1);

    await attackUnit(g, 1, bobaIndex(g), g.state.player2.groundArena[0].playId);

    expect(res(g)).toBeFalsy();
    expect(credits(g)).toBe(1);
  });

  it("another friendly Bounty Hunter's kill, every time", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HUNTER).WithGroundUnitForPlayer(1, HUNTER)
      .WithGroundUnitForPlayer(2, DROID).WithGroundUnitForPlayer(2, DROID).Build());
    await deployed(g);

    await attackUnit(g, 1, 0, g.state.player2.groundArena[0].playId);
    await g.dispatchAsync(2, "pass-action", {});
    await attackUnit(g, 1, 1, g.state.player2.groundArena[0].playId);

    expect(credits(g)).toBe(2);
  });
});
