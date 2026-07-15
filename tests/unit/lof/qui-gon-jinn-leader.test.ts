import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_016 Qui-Gon Jinn — Student of the Living Force (Ground leader)
// Leader:   "Action [Exhaust, use the Force (lose your Force token)]: Return a friendly non-leader
//            unit to its owner's hand. Play a non-Villainy unit that costs less than the returned
//            unit from your hand for free."
//           "Epic Action: If you control 6 or more resources, deploy this leader."
// Deployed: "When this unit completes an attack (and survives): You may return a friendly non-leader
//            unit to its owner's hand. Play a non-Villainy unit that costs less than the returned
//            unit from your hand for free."
//
// Gamorrean Guards SOR_211 = cost 4 (Cunning, non-Villainy). Battlefield Marine SOR_095 = cost 2
// (Command/Heroism, non-Villainy) → a legal cheaper free play.

const RETURN_UNIT = Cards.units.sor.gamorreanGuards;  // cost 4
const FREE_UNIT = Cards.units.sor.battlefieldMarine;  // cost 2, non-Villainy

describe("LOF_016 Qui-Gon Jinn (leader) — Action: return a unit, play a cheaper non-Villainy unit free", () => {
  it("returns a friendly unit and plays a cheaper non-Villainy unit for free", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.quiGonJinn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, RETURN_UNIT) // friendly non-leader unit to return
      .WithCardInHandForPlayer(1, FREE_UNIT)   // cheaper non-Villainy unit
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithActivePlayer(1)
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);   // return the Gamorrean
    await g.chooseCardFromHandAsync(1, 0); // play the Marine for free

    expect(g.state.player1.hand.some(c => c.cardId === RETURN_UNIT)).toBe(true); // returned to hand
    expect(g.state.player1.groundArena.some(u => u.cardId === FREE_UNIT)).toBe(true); // played
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(14); // played for free
    expect(g.state.player1.supplemental.forceToken).toBe(false);
  });

  it("is unavailable without the Force", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.quiGonJinn)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, RETURN_UNIT)
        .WithCardInHandForPlayer(1, FREE_UNIT)
        .WithActivePlayer(1)
        .Build(),
    );

    const used = await g.useLeaderAbilityAsync(1);
    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.cardId === RETURN_UNIT)).toBe(true); // not returned
  });

  it("returns the unit even when no cheaper non-Villainy unit can be played", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.quiGonJinn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, FREE_UNIT) // cost 2 — nothing in hand costs less than 2
      .WithCardInHandForPlayer(1, RETURN_UNIT) // cost 4, not < 2
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithActivePlayer(1)
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // return the Marine; no legal free play follows

    expect(g.state.player1.hand.filter(c => c.cardId === FREE_UNIT).length).toBe(1); // returned
    expect(g.state.player1.groundArena.length).toBe(0);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
  });
});

describe("LOF_016 Qui-Gon Jinn — Epic Action deploy (6+ resources)", () => {
  it("deploys for free with 6 resources; not with 5", async () => {
    const g6 = new GameTestAdapter();
    g6.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.quiGonJinn)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithActivePlayer(1)
        .Build(),
    );
    await g6.deployLeaderAsync(1);
    expect(g6.state.player1.leader.deployed).toBe(true);

    const g5 = new GameTestAdapter();
    g5.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.lof.quiGonJinn)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithActivePlayer(1)
        .Build(),
    );
    await g5.deployLeaderAsync(1);
    expect(g5.state.player1.leader.deployed).toBe(false);
  });
});

describe("LOF_016 Qui-Gon Jinn (deployed) — When Attack Ends: return + free play", () => {
  function deployedSetup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.quiGonJinn, true, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.lof.quiGonJinn) // [0] deployed leader unit (attacker)
      .WithGroundUnitForPlayer(1, RETURN_UNIT)                  // [1] friendly non-leader to return
      .WithCardInHandForPlayer(1, FREE_UNIT)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithActivePlayer(1);
  }

  it("returns a unit and plays a cheaper one for free on accept", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0); // Qui-Gon attacks
    await g.chooseBaseAsync(1, 2);           // hits the base (survives)
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 1);     // return the Gamorrean
    await g.chooseCardFromHandAsync(1, 0);   // play the Marine free

    expect(g.state.player1.hand.some(c => c.cardId === RETURN_UNIT)).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.cardId === FREE_UNIT)).toBe(true);
  });

  it("does nothing on decline", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.some(c => c.cardId === RETURN_UNIT)).toBe(false); // not returned
    expect(g.state.player1.groundArena.some(u => u.cardId === RETURN_UNIT)).toBe(true); // still in play
  });
});
