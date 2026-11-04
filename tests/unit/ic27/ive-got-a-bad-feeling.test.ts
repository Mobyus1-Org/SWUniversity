import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_166 I've Got A Bad Feeling (Event, cost 4, Cunning/Heroism)
//   "Return a non-leader unit to its owner's hand. Give a Shield token to a friendly unit."
// Both halves are mandatory and resolve in order, so a friendly unit just returned can't take the
// Shield. Either half still happens when the other has no legal choice.

const EVENT = Cards.events.ic27.iveGotABadFeeling;
const MARINE = Cards.units.sor.battlefieldMarine;
const WAMPA = Cards.units.sor.wampa;
const SHIELD = Cards.upgrades.token.shield;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, EVENT);
}

const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? res.fromPlayIds : undefined;
};

describe("IC27_166 I've Got A Bad Feeling", () => {
  it("returns an enemy unit to its owner's hand, then shields a friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build());
    const marine = g.state.player1.groundArena[0].playId;
    const wampa = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    expect(offered(g)).toEqual(expect.arrayContaining([marine, wampa])); // either side
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampa] });
    expect(offered(g)).toEqual([marine]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.hand.map(c => c.cardId)).toContain(WAMPA);
    expect(g.state.player1.groundArena[0].upgrades.map(u => u.cardId)).toEqual([SHIELD]);
  });

  it("a friendly unit returned by the first half can't take the Shield", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, WAMPA).Build(),
    );
    const marine = g.state.player1.groundArena[0].playId;
    const wampa = g.state.player1.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });
    expect(offered(g)).toEqual([wampa]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampa] });

    expect(g.state.player1.hand.map(c => c.cardId)).toContain(MARINE);
    expect(g.state.player1.groundArena[0].upgrades.map(u => u.cardId)).toEqual([SHIELD]);
  });

  it("with no friendly unit left, the return still happens and there is no Shield prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.hand.map(c => c.cardId)).toContain(WAMPA);
  });

  it("a deployed leader unit can't be returned", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    const leader = g.state.player1.groundArena.find(u => u.cardId !== MARINE)!.playId;
    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!.playId;

    await g.playCardFromHandAsync(1, 0);

    expect(offered(g)).toEqual([marine]);
    expect(offered(g)).not.toContain(leader);
  });
});
