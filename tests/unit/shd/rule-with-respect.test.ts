import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameState } from "@/lib/engine/game";
import { Cards } from "../../card-helpers";

// SHD_106 Rule with Respect (Event, cost 4, Command/Heroism)
//   "A friendly unit captures each enemy non-leader unit that attacked your base this phase."
//
// "Attacked your base" means an attack declared on the base — the attacked-base ledger records
// exactly that. No same-arena clause, so any friendly unit may be the captor.

const EVENT = Cards.events.shd.ruleWithRespect;
const MARINE = Cards.units.sor.battlefieldMarine;
const DURABLE = Cards.units.sor.consularSecurityForce;
const SPACE = Cards.units.lof.hyperspaceWayfarer;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, EVENT);
}

/** Records that player 2's ground unit at `i` attacked player 1's base this phase. */
function attackedMyBase(state: GameState, i: number, arena: "groundArena" | "spaceArena" = "groundArena") {
  const u = state.player2[arena][i];
  state.roundState.unitsAttackedThisPhase.push({ fromPlayer: 2, cardId: u.cardId, playId: u.playId, attackedBasePlayer: 1 });
}

describe("SHD_106 Rule with Respect", () => {
  it("end to end: an enemy unit that attacked your base is captured by the chosen friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, DURABLE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);
    expect(g.state.player1.base.damage).toBe(3);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // captor

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].captives.map(c => c.cardId)).toEqual([MARINE]);
  });

  it("captures EACH such unit — all under the one chosen captor", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, DURABLE)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithGroundUnitForPlayer(2, DURABLE) // did not attack the base — stays
      .Build();
    attackedMyBase(state, 0);
    attackedMyBase(state, 1);
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].captives).toHaveLength(2);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([DURABLE]);
  });

  it("the captor can be in the other arena — there is no same-arena clause", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, SPACE)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build();
    attackedMyBase(state, 0);
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.spaceArena[0].captives.map(c => c.cardId)).toEqual([MARINE]);
  });

  it("a LEADER unit that attacked your base is not captured", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, DURABLE)
      .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren) // a deployed leader unit
      .WithGroundUnitForPlayer(2, MARINE)
      .Build();
    attackedMyBase(state, 0);
    attackedMyBase(state, 1);
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].captives.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([Cards.leaders.sor.sabineWren]);
  });

  it("a unit that attacked twice is captured once", async () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(1, DURABLE).WithGroundUnitForPlayer(2, MARINE).Build();
    attackedMyBase(state, 0);
    attackedMyBase(state, 0);
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].captives).toHaveLength(1);
  });

  it("an attack on the OPPONENT's base (by your own unit) doesn't count", async () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(1, DURABLE).WithGroundUnitForPlayer(2, MARINE).Build();
    const mine = state.player1.groundArena[0];
    state.roundState.unitsAttackedThisPhase.push({ fromPlayer: 1, cardId: mine.cardId, playId: mine.playId, attackedBasePlayer: 2 });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.groundArena[0].captives).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("no enemy attacked your base — the event does nothing and asks nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, DURABLE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });
});
