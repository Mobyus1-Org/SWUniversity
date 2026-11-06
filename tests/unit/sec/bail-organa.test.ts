import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { ActionAbilities } from "@/server/engine/actions/action-ability";

// SEC_008 Bail Organa — Doing Everything He Can (Leader, Command/Heroism; unit side 3/3 Ground)
//   Front: "Action [1 resource, Exhaust]: If a friendly unit was defeated this phase, return a
//           friendly resource to its owner's hand. If you do, put the top card of your deck into
//           play as a resource.
//           Action [Exhaust, discard 2 cards from your hand]: If you control 4 or more resources,
//           deploy this leader."
//   Unit:  "When you play a card from your resources: Heal 1 damage from your base."
// The deploy is an ordinary Action, not an Epic Action: he can deploy again after being defeated.

const BAIL = Cards.leaders.sec.bailOrgana;
const MARINE = Cards.units.sor.battlefieldMarine;
const WAMPA = Cards.units.sor.wampa;
const SQUAD = Cards.units.sec.dogmaticShockSquad; // Plot, no When Played
const L337 = Cards.units.shd.l337;                // Smuggle [4 Cunning Heroism]

function board(resources = 4) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 10)
    .MyLeader(BAIL)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const exhaustedResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => !r.ready).length;

function friendlyDefeated(g: GameTestAdapter, player: 1 | 2 = 1) {
  g.state.roundState.cardsLeftPlayThisPhase.push({ fromPlayer: player, cardId: MARINE, playId: "dead", reason: "defeated" });
}

describe("SEC_008 Bail Organa — resource Action", () => {
  it("after a friendly defeat: a resource goes back to hand and the top card of the deck replaces it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(3).WithCardInDeckForPlayer(1, WAMPA).Build());
    friendlyDefeated(g);
    const returning = g.state.player1.resources[1].playId;

    await g.useLeaderAbilityAsync(1);
    const r = res(g);
    expect(r?.type === "Target" ? r.fromPlayIds : []).toEqual(g.state.player1.resources.map(x => x.playId));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [returning] });

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.resources).toHaveLength(3);
    expect(g.state.player1.resources.map(x => x.cardId)).toContain(WAMPA);
    expect(exhaustedResources(g)).toBe(1); // the new resource enters exhausted; the paid one went home
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("with an empty deck, the resource still goes back to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(3).Build());
    friendlyDefeated(g);

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.resources[0].playId] });

    expect(g.state.player1.resources).toHaveLength(2);
    expect(exhaustedResources(g)).toBe(0);
  });

  it("does nothing without a friendly defeat — an enemy's doesn't count — but is still paid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(3).WithCardInDeckForPlayer(1, WAMPA).Build());
    friendlyDefeated(g, 2);

    await g.useLeaderAbilityAsync(1);

    expect(res(g)).toBeFalsy();
    expect(g.state.player1.resources).toHaveLength(3);
    expect(exhaustedResources(g)).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("a stolen resource goes back to its owner's hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(2).FillResourcesForPlayer(1, WAMPA, 1, true, 1, true).Build());
    g.state.player1.resources[2].owner = 2;
    friendlyDefeated(g);

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.resources[2].playId] });

    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([WAMPA]);
    expect(g.state.player1.hand).toHaveLength(0);
  });
});

describe("SEC_008 Bail Organa — deploy Action", () => {
  it("exhaust and discard 2 cards from hand: he deploys", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(4).WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, WAMPA).Build());

    await g.deployLeaderAsync(1);
    expect(res(g)?.type).toBe("Target"); // first discard
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.discard.map(c => c.cardId).sort()).toEqual([MARINE, WAMPA].sort());
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([BAIL]);
  });

  it("not with fewer than 2 cards in hand, nor with 3 resources, nor while exhausted", async () => {
    for (const [state, ready] of [
      [board(4).WithCardInHandForPlayer(1, MARINE).Build(), true],
      [board(3).WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, WAMPA).Build(), true],
      [board(4).WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, WAMPA).Build(), false],
    ] as const) {
      const g = new GameTestAdapter();
      g.loadNewState(state);
      g.state.player1.leader.ready = ready;
      await g.deployLeaderAsync(1);
      expect(g.state.player1.leader.deployed).toBeFalsy();
      expect(g.state.player1.hand.length).toBeGreaterThan(0);
    }
  });

  it("is not an Epic Action: after he is defeated he can deploy again", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(4).WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, WAMPA)
      .WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, WAMPA)
      .WithGroundUnitForPlayer(2, WAMPA).Build());
    await g.deployLeaderAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    expect(g.state.player1.leader.deployed).toBe(true);

    // The Wampa defeats him: he returns to the leader zone. Ready him as a new round would.
    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [g.state.player1.groundArena.find(u => u.cardId === BAIL)!.playId] });
    expect(g.state.player1.leader.deployed).toBeFalsy();
    g.state.player1.leader.ready = true;

    await g.deployLeaderAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("the resource Action is still offered alongside it (1 resource)", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(4).Build());
    expect(ActionAbilities(BAIL, 1)).toContain(BAIL);
  });
});

describe("SEC_008 Bail Organa — deployed: playing from resources heals 1", () => {
  it("each card played with Plot as he deploys heals 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(24).FillResourcesForPlayer(1, SQUAD, 2)
      .WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, MARINE)
      .WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, MARINE).Build());
    const squadIdx = () => g.state.player1.resources.findIndex(r => r.cardId === SQUAD);

    await g.deployLeaderAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    await g.choosePlotCardAsync(1, squadIdx());
    expect(g.state.player1.base.damage).toBe(9);
    await g.choosePlotCardAsync(1, squadIdx());

    expect(g.state.player1.base.damage).toBe(8);
    expect(g.state.player1.groundArena.filter(u => u.cardId === SQUAD)).toHaveLength(2);
  });

  it("a Smuggle play heals 1; undeployed, nothing", async () => {
    for (const deployed of [true, false]) {
      let b = board(8).FillResourcesForPlayer(1, L337, 1);
      if (deployed) b = b.MyLeader(BAIL, true, true, true).WithGroundUnitForPlayer(1, BAIL);
      const g = new GameTestAdapter();
      g.loadNewState(b.WithCardInDeckForPlayer(1, MARINE).Build());

      await g.smuggleResourceAsync(1, g.state.player1.resources.findIndex(r => r.cardId === L337));
      if (res(g)?.type === "Option") await g.chooseNoAsync(1); // L3-37's own When Played

      expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(L337);
      expect(g.state.player1.base.damage).toBe(deployed ? 9 : 10);
    }
  });
});
