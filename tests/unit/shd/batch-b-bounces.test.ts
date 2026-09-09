import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

//   SHD_206 Spare the Target — "Return an ENEMY non-leader unit to its owner's hand. Collect that
//                               unit's Bounties." The return is unconditional; the collection only
//                               happens if the unit had a Bounty.
//   SHD_207 A New Adventure   — "Return a non-leader unit that costs 6 or less to its owner's hand.
//                               Then, ITS OWNER may play it for free."

const SPARE = Cards.events.shd.spareTheTarget;
const ADVENTURE = Cards.events.shd.aNewAdventure;
const BOUNTY_UNIT = "SHD_027";   // Hylobon Enforcer — "Bounty: Draw a card" (the printing
                                 // that is actually registered in the bounty dictionary)
const COST_6 = "ASH_131";        // Dinosaur Turtle, cost 6 — at the cap
const COST_8 = "ASH_038";        // Purrgil Ultra, cost 8 — over it
const MARINE = Cards.units.sor.battlefieldMarine;
const SECURITY = Cards.units.sor.consularSecurityForce;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}

const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
};
const find = (g: GameTestAdapter, p: 1 | 2, cardId: string) => {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId);
};

describe("SHD_206 Spare the Target", () => {
  it("returns the enemy unit and collects its Bounty for the caster", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, SPARE)
        .WithGroundUnitForPlayer(2, BOUNTY_UNIT)
        .WithCardInDeckForPlayer(1, MARINE)
        .Build(),
    );
    const handBefore = g.state.player1.hand.length;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, BOUNTY_UNIT)!.playId] });
    // Collecting is itself an optional prompt, offered to the CASTER.
    await g.chooseYesAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.hand.some(c => c.cardId === BOUNTY_UNIT)).toBe(true);
    // Spare the Target left hand (-1) and the Bounty drew a card (+1) → net unchanged.
    expect(g.state.player1.hand.length).toBe(handBefore);
  });

  it("the Bounty prompt goes to the CASTER and can be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, SPARE)
        .WithGroundUnitForPlayer(2, BOUNTY_UNIT)
        .WithCardInDeckForPlayer(1, MARINE)
        .Build(),
    );
    const deckBefore = g.state.player1.deck.length;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, BOUNTY_UNIT)!.playId] });
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.deck.length).toBe(deckBefore); // no draw
  });

  it("returns a unit with NO Bounty just the same — the collection is the conditional half", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, SPARE).WithGroundUnitForPlayer(2, SECURITY).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, SECURITY)!.playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.hand.some(c => c.cardId === SECURITY)).toBe(true);
  });

  it("offers ENEMY non-leader units only", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, SPARE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );
    g.state.activePlayer = 2;
    await g.deployLeaderAsync(2);
    await g.dispatchAsync(2, "pass-action", {});
    const enemyLeader = g.state.player2.groundArena.find(u => u.cardId !== SECURITY)!;

    await g.playCardFromHandAsync(1, 0);

    expect(offered(g)).toEqual([find(g, 2, SECURITY)!.playId]);
    expect(offered(g)).not.toContain(enemyLeader.playId);
  });
});

describe("SHD_207 A New Adventure", () => {
  it("returns the unit, then lets its OWNER replay it for free", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, ADVENTURE).WithGroundUnitForPlayer(2, SECURITY).Build(),
    );
    const p2SpentBefore = g.state.player2.resources.filter(r => !r.ready).length;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, SECURITY)!.playId] });
    await g.chooseYesAsync(2); // the OWNER decides, not the caster

    expect(find(g, 2, SECURITY)).toBeTruthy();
    expect(g.state.player2.resources.filter(r => !r.ready).length).toBe(p2SpentBefore);
  });

  it("the replay is optional — declining leaves it in hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, ADVENTURE).WithGroundUnitForPlayer(2, SECURITY).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, SECURITY)!.playId] });
    await g.chooseNoAsync(2);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.hand.some(c => c.cardId === SECURITY)).toBe(true);
  });

  it("offers both sides' non-leader units at cost 6 or less, and excludes a cost-8", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, ADVENTURE)
        .WithGroundUnitForPlayer(1, COST_6)
        .WithSpaceUnitForPlayer(2, COST_8)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(offered(g)).toContain(find(g, 1, COST_6)!.playId);
    expect(offered(g)).toContain(find(g, 2, SECURITY)!.playId);
    expect(offered(g)).not.toContain(find(g, 2, COST_8)!.playId);
  });

  it("is playable with no legal target and simply does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, ADVENTURE).WithSpaceUnitForPlayer(2, COST_8).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(find(g, 2, COST_8)).toBeTruthy();
  });
});
