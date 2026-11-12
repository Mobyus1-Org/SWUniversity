import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_124 K-2SO — Evacuate the Vault Door (10/5 Ground, cost 9, Aggression/Heroism)
//   "When Defeated: Deal 5 damage to each enemy unit and each enemy base."

const K2 = Cards.units.ic27.k2so;
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3
const CSF = Cards.units.sor.consularSecurityForce; // 3/7
const SWOOP = Cards.units.sor.swoopRacer;          // 4/3
const XWING = Cards.units.sor.allianceXWing;       // 2/3 space

function board(k2Damage: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, K2, true, k2Damage)
    .WithGroundUnitForPlayer(1, MARINE);
}

describe("IC27_124 K-2SO", () => {
  it("dying in combat deals 5 to each enemy unit (both arenas) and the enemy base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(4) // 1 HP left — the Swoop Racer's 4 kills him
      .WithGroundUnitForPlayer(2, SWOOP)
      .WithGroundUnitForPlayer(2, CSF)
      .WithSpaceUnitForPlayer(2, XWING)
      .Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
    expect(g.state.player1.groundArena[0].damage).toBe(0);  // friendly unit untouched
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([CSF]);
    expect(g.state.player2.groundArena[0].damage).toBe(5);
    expect(g.state.player2.spaceArena).toHaveLength(0);     // X-Wing (3 HP) defeated
    expect(g.state.player2.base.damage).toBe(5);
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("with no enemy units, the enemy base is still hit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(0).WithCardInHandForPlayer(1, Cards.events.ic27.openFire)
      .FillResourcesForPlayer(1, MARINE, 10).Build());
    g.state.player1.groundArena[0].damage = 4;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("a Shield on an enemy unit absorbs the 5", async () => {
    const g = new GameTestAdapter();
    const state = board(4).WithGroundUnitForPlayer(2, SWOOP).WithGroundUnitForPlayer(2, CSF).Build();
    state.player2.groundArena[1].upgrades = [{ cardId: Cards.upgrades.token.shield, playId: "sh", owner: 2, controller: 2 }];
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });

  it("not defeated: nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(0).WithGroundUnitForPlayer(2, SWOOP).WithGroundUnitForPlayer(2, CSF).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(0); // CSF untouched
    expect(g.state.player2.base.damage).toBe(0);
  });
});
