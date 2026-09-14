import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_038 Purrgil Ultra (Unit 6/10 Space, cost 8, Command/Cunning)
//   "When Played/When Defeated: You may return another friendly non-leader unit to its owner's
//    hand. If you do, deal damage to a unit equal to the returned unit's cost."

const PURRGIL = Cards.units.ash.purrgilUltra;
const WAMPA = Cards.units.sor.wampa;                   // cost 4
const MARINE = Cards.units.sor.battlefieldMarine;      // cost 2
const DURABLE = Cards.units.sor.consularSecurityForce; // 3/7
const DROID = Cards.units.token.battleDroid;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command + Cunning base
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds ?? [];

describe("ASH_038 Purrgil Ultra — When Played", () => {
  it("returns another friendly unit, then deals its cost in damage to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, PURRGIL).WithGroundUnitForPlayer(1, WAMPA).WithGroundUnitForPlayer(2, DURABLE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // return the Wampa
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([WAMPA]);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4);
  });

  it("only another FRIENDLY NON-LEADER unit can be returned", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, PURRGIL)
        .WithGroundUnitForPlayer(1, WAMPA)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.leiaOrgana) // a leader unit
        .WithGroundUnitForPlayer(2, DURABLE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(offer(g)).toEqual([g.state.player1.groundArena[0].playId]);
  });

  it("declining returns nothing and deals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, PURRGIL).WithGroundUnitForPlayer(1, WAMPA).WithGroundUnitForPlayer(2, DURABLE).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("a returned token has no cost — no damage step", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, PURRGIL).WithGroundUnitForPlayer(1, DROID).WithGroundUnitForPlayer(2, DURABLE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("the damage may go to any unit — Purrgil itself included", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, PURRGIL).WithGroundUnitForPlayer(1, WAMPA).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    const purrgil = g.state.player1.spaceArena.find(u => u.cardId === PURRGIL)!;
    expect(offer(g)).toContain(purrgil.playId);
  });
});

describe("ASH_038 Purrgil Ultra — When Defeated", () => {
  it("does the same when it's defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall)
        .WithSpaceUnitForPlayer(1, PURRGIL)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, DURABLE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0); // defeat Purrgil
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // return the Marine
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });
});
