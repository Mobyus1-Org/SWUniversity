import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_121 Salvage (Event, cost 0, Command)
//   "Play a Vehicle unit from your discard pile (paying its cost). Then, deal 1 damage to it."
//
// The damage is part of Salvage, so it lands before the played unit's own entry effects (Shielded)
// resolve.

const SALVAGE = Cards.events.jtl.salvage;
const AWING = Cards.units.jtl.phoenixSquadronAWing;  // 3/2 Space Vehicle, cost 2, Command/Heroism
const TIE = Cards.units.sor.tieLnFighter;            // 2/1 Space Vehicle, cost 1
const HAULER = Cards.units.law.shieldedHauler;       // 4/5 Space Vehicle, cost 5, Shielded
const MARINE = Cards.units.sor.battlefieldMarine;    // not a Vehicle

function base(resources = 10) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithCardInHandForPlayer(1, SALVAGE);
}

const discardId = (g: GameTestAdapter, cardId: string) => g.state.player1.discard.find(c => c.cardId === cardId)!.playId;
const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];
const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("JTL_121 Salvage", () => {
  it("plays a Vehicle from your discard, paying its cost, then deals 1 damage to it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInDiscardForPlayer(1, AWING).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardId(g, AWING)] });

    const awing = g.state.player1.spaceArena.find(u => u.cardId === AWING)!;
    expect(awing.damage).toBe(1);
    expect(g.state.player1.discard.some(c => c.cardId === AWING)).toBe(false);
    expect(ready(g)).toBe(8); // Salvage 0 + A-Wing 2
  });

  it("a 1-HP Vehicle is defeated by the 1 damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInDiscardForPlayer(1, TIE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardId(g, TIE)] });

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player1.discard.some(c => c.cardId === TIE)).toBe(true);
  });

  it("the damage lands before Shielded — it keeps both the damage and its Shield", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInDiscardForPlayer(1, HAULER).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardId(g, HAULER)] });

    const hauler = g.state.player1.spaceArena.find(u => u.cardId === HAULER)!;
    expect(hauler.damage).toBe(1);
    expect(hauler.upgrades.map(u => u.cardId)).toEqual([Cards.upgrades.token.shield]);
  });

  it("offers only VEHICLE units you can afford", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(2)
        .WithCardInDiscardForPlayer(1, AWING)   // cost 2 — affordable
        .WithCardInDiscardForPlayer(1, HAULER)  // cost 5+ — not
        .WithCardInDiscardForPlayer(1, MARINE)  // not a Vehicle
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(offer(g)).toEqual([discardId(g, AWING)]);
  });

  it("no Vehicle in your discard — nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInDiscardForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.spaceArena).toHaveLength(0);
  });
});
