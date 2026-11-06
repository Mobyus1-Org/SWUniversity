import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TS26_01 Count Dooku — Offering Aid (Leader, Vigilance/Villainy; unit side 6/7 Ground)
//   Front: "Action [Exhaust]: Choose 2 players. They each heal 1 damage from their base and create
//           a Battle Droid token. Epic Action: If you control 7 or more resources, deploy this leader."
//   Unit:  "Restore 2. On Attack: Create 2 Battle Droid tokens."
// With two players, "choose 2 players" can only mean both of them — there is nothing to ask.

const DOOKU = Cards.leaders.ts26.countDooku;
const DROID = Cards.units.token.battleDroid;
const MARINE = Cards.units.sor.battlefieldMarine;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 5)
    .MyLeader(DOOKU)
    .TheirBase(Cards.bases.common.green30HP, 4)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

const droids = (units: { cardId: string }[]) => units.filter(u => u.cardId === DROID).length;

describe("TS26_01 Count Dooku — leader Action", () => {
  it("each player heals 1 from their base and creates a Battle Droid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.base.damage).toBe(4);
    expect(g.state.player2.base.damage).toBe(3);
    expect(droids(g.state.player1.groundArena)).toBe(1);
    expect(droids(g.state.player2.groundArena)).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("an undamaged base still gets its Battle Droid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().TheirBase(Cards.bases.common.green30HP, 0).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player2.base.damage).toBe(0);
    expect(droids(g.state.player2.groundArena)).toBe(1);
  });
});

describe("TS26_01 Count Dooku — deployed", () => {
  it("Restore 2, and On Attack creates 2 Battle Droids for him only", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});

    await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.findIndex(u => u.cardId === DOOKU));
    await g.chooseBaseAsync(1, 2);

    expect(droids(g.state.player1.groundArena)).toBe(2);
    expect(droids(g.state.player2.groundArena)).toBe(0);
    expect(g.state.player1.base.damage).toBe(3);  // 5 – Restore 2
    expect(g.state.player2.base.damage).toBe(10); // 4 + 6
  });
});
