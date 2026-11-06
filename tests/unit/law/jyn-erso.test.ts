import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_005 Jyn Erso — Time to Fight (Leader, Vigilance/Heroism; unit side 3/6 Ground)
//   Front: "Action [1 resource, Exhaust]: If a friendly Rebel unit was defeated this phase, search
//           the top 3 cards of your deck for a card and draw it.
//           Epic Action: If you control 5 or more resources, deploy this leader."
//   Unit:  "On Attack: If a friendly Rebel unit was defeated this phase, search the top 3 cards of
//           your deck for a card and draw it."
// "Friendly" is who controlled the unit when it was defeated. The condition is checked as the
// ability resolves; unmet, the Action is still paid for and does nothing.

const JYN = Cards.leaders.law.jynErso;
const XWING = Cards.units.sor.allianceXWing;      // Rebel
const MARINE = Cards.units.sor.battlefieldMarine; // Rebel
const WAMPA = Cards.units.sor.wampa;              // not Rebel

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(JYN)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8)
    .WithCardInDeckForPlayer(1, WAMPA)
    .WithCardInDeckForPlayer(1, XWING)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, Cards.units.ash.dinosaurTurtle);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

function defeated(g: GameTestAdapter, player: 1 | 2, cardId: string) {
  g.state.roundState.cardsLeftPlayThisPhase.push({ fromPlayer: player, cardId, playId: "x", reason: "defeated" });
}

async function pickFirst(g: GameTestAdapter) {
  const r = res(g);
  const tempId = r?.type === "DeckSearch" ? r.choices[0]?.tempId ?? "0" : "0";
  await g.chooseDeckSearchAsync(1, [tempId]);
}

describe("LAW_005 Jyn Erso — leader Action", () => {
  it("after a friendly Rebel was defeated: search the top 3 and draw one; costs 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    defeated(g, 1, MARINE);

    await g.useLeaderAbilityAsync(1);
    expect(res(g)?.type).toBe("DeckSearch");
    await pickFirst(g);

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player1.deck).toHaveLength(3);
    expect(g.state.player1.deck[0].cardId).not.toBe(WAMPA); // the other two went to the bottom
    expect(readyResources(g)).toBe(7);
  });

  it("an enemy Rebel, or a friendly non-Rebel, doesn't count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    defeated(g, 2, MARINE);
    defeated(g, 1, WAMPA);

    await g.useLeaderAbilityAsync(1);

    expect(res(g)).toBeFalsy();
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(readyResources(g)).toBe(7);
  });

  it("a real defeat in combat sets it up", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build());
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    await g.dispatchAsync(2, "pass-action", {});

    await g.useLeaderAbilityAsync(1);
    expect(res(g)?.type).toBe("DeckSearch");
  });

  it("an empty deck is harmless", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    g.state.player1.deck = [];
    defeated(g, 1, MARINE);

    await g.useLeaderAbilityAsync(1);

    expect(res(g)).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(false);
  });
});

describe("LAW_005 Jyn Erso — deployed On Attack", () => {
  async function attackWithJyn(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.findIndex(u => u.cardId === JYN));
    await g.chooseBaseAsync(1, 2);
  }

  it("searches when a friendly Rebel was defeated; the attack then lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    defeated(g, 1, XWING);

    await attackWithJyn(g);
    expect(res(g)?.type).toBe("DeckSearch");
    await pickFirst(g);

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("no Rebel defeated: the attack just lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await attackWithJyn(g);

    expect(res(g)).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(3);
  });
});
