import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_003 Kylo Ren — Supreme Leader (Leader, Command/Villainy; unit side 5/3 Ground)
//   Front: "Action [Exhaust, discard a card from your hand]: Give an Experience token to a unit."
//   Unit:  "When Deployed: You may return a unit from your discard pile to your hand."
// The discard is part of the COST: an empty hand makes the Action unavailable, and the discard is
// still paid when there is no unit to receive the token.

const KYLO = Cards.leaders.ic27.kyloRen;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Ground
const WAMPA = Cards.units.sor.wampa;
const STRIKE_TRUE = Cards.events.sor.strikeTrue;
const XP = Cards.upgrades.token.experience;

const count = (u: { upgrades: Array<{ cardId: string }> }, id: string) =>
  u.upgrades.filter(x => x.cardId === id).length;
const resolution = (g: GameTestAdapter) =>
  g.lastDispatchResponse?.resolutionNeeded as { type?: string; fromPlayIds?: string[]; optional?: boolean } | undefined;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(KYLO)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

describe("IC27_003 Kylo Ren — leader Action", () => {
  it("discards a card as the cost, then gives an Experience token to any unit (enemy included)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithCardInHandForPlayer(1, STRIKE_TRUE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, WAMPA)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.discard.map(d => d.cardId)).toEqual([STRIKE_TRUE]);

    expect(resolution(g)?.fromPlayIds).toHaveLength(2);
    await g.chooseGroundUnitAsync(2, 0);

    expect(count(g.state.player2.groundArena[0], XP)).toBe(1);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.resources.every(r => r.ready)).toBe(true); // no resource cost
  });

  it("is not offered with an empty hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(count(g.state.player1.groundArena[0], XP)).toBe(0);
  });

  it("still discards and exhausts with no unit in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, STRIKE_TRUE).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.discard.map(d => d.cardId)).toEqual([STRIKE_TRUE]);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(resolution(g)).toBeFalsy();
  });
});

describe("IC27_003 Kylo Ren — When Deployed", () => {
  it("may return a unit from your discard pile to your hand; events are not offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithCardInDiscardForPlayer(1, STRIKE_TRUE)
        .WithCardInDiscardForPlayer(1, WAMPA)
        .Build(),
    );

    await g.deployLeaderAsync(1);

    const wampa = g.state.player1.discard.find(d => d.cardId === WAMPA)!;
    expect(resolution(g)?.fromPlayIds).toEqual([wampa.playId]);
    expect(resolution(g)?.optional).toBe(true);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampa.playId] });

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([WAMPA]);
    expect(g.state.player1.discard.map(d => d.cardId)).toEqual([STRIKE_TRUE]);
  });

  it("may decline — the unit stays in the discard pile", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, WAMPA).Build());

    await g.deployLeaderAsync(1);
    expect(resolution(g)?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.discard.map(d => d.cardId)).toEqual([WAMPA]);
  });

  it("no prompt when the discard pile has no unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, STRIKE_TRUE).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(resolution(g)).toBeFalsy();
  });

  it("only your own discard pile counts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(2, WAMPA).Build());

    await g.deployLeaderAsync(1);

    expect(resolution(g)).toBeFalsy();
    expect(g.state.player1.hand).toHaveLength(0);
  });
});
