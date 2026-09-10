import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_109 Endless Legions (Event, cost 14, Command ×2)
//   "Reveal any number of resources you control. Play each unit revealed this way for free (one at
//    a time)."
//
// Offered one resource at a time until the player says Done. Only unit resources are worth
// revealing; each one leaves the resource row (no replacement) and is played — its When Played
// fires as for any play.

const EVENT = Cards.events.shd.endlessLegions;
const MARINE = Cards.units.sor.battlefieldMarine;
const WAMPA = Cards.units.sor.wampa;
const ADELPHI = Cards.units.shd.adelphiPatrolWing; // has a When Played
const FILLER = Cards.events.shd.bravado;           // a non-unit resource

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command + Command base — no penalty
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, FILLER, 13)
    .FillResourcesForPlayer(1, MARINE, 1)
    .FillResourcesForPlayer(1, WAMPA, 1)
    .WithCardInHandForPlayer(1, EVENT);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds ?? [];
const resourceOf = (g: GameTestAdapter, cardId: string) => g.state.player1.resources.find(r => r.cardId === cardId)!;

describe("SHD_109 Endless Legions", () => {
  it("plays revealed unit resources for free, one at a time, until Done", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [resourceOf(g, MARINE).playId] });
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);

    await g.chooseYesAsync(1); // offered again
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [resourceOf(g, WAMPA).playId] });

    expect(g.state.player1.groundArena.map(u => u.cardId).sort()).toEqual([MARINE, WAMPA].sort());
    expect(g.state.player1.resources).toHaveLength(13); // 15 − 2, nothing replaces them
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull(); // no unit resources left
  });

  it("offers only UNIT resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect([...offer(g)].sort()).toEqual([resourceOf(g, MARINE).playId, resourceOf(g, WAMPA).playId].sort());
  });

  it("Done stops the loop — the rest stay as resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [resourceOf(g, MARINE).playId] });
    await g.chooseNoAsync(1); // Done

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
    expect(g.state.player1.resources.some(r => r.cardId === WAMPA)).toBe(true);
  });

  it("each played unit's When Played fires before the next reveal", async () => {
    const g = new GameTestAdapter();
    // A ready friendly unit, so Adelphi's "you may attack with a unit" has something to offer.
    g.loadNewState(base().FillResourcesForPlayer(1, ADELPHI, 1).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [resourceOf(g, ADELPHI).playId] });

    // Adelphi's "you may attack with a unit" offer — proof its When Played ran.
    const res = g.lastDispatchResponse?.resolutionNeeded as { helperText?: string };
    expect(res.helperText ?? "").toMatch(/Attack with a unit/);
    await g.chooseNoAsync(1);

    // ...then the loop resumes.
    await g.chooseYesAsync(1);
    expect(offer(g)).toContain(resourceOf(g, MARINE).playId);
  });

  it("no unit resources — the event just resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .FillResourcesForPlayer(1, FILLER, 14)
        .WithCardInHandForPlayer(1, EVENT)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.hand).toHaveLength(0);
  });
});
