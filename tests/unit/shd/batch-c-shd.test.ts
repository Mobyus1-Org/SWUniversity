import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

//   SHD_163 Migs Mayfeld — "When A PLAYER discards a card from their hand: You may deal 2 damage
//                           to a unit or base. Use this ability only once each round."
//   SHD_198 Omega        — "Ignore the aspect penalty on the FIRST Clone unit you play each round.
//                           When Played: Search the top 5 for a Clone card, reveal it, draw it."
//   SHD_239 Toro Calican — "When you play another BOUNTY HUNTER unit: You may deal 1 damage to it.
//                           If you do, ready this unit. Use this ability only once each round."

const MIGS = Cards.units.shd.migsMayfeldTriggerman;
const OMEGA = Cards.units.shd.omegaPartOfTheSquad;
const TORO = Cards.units.shd.toroCalican;
const CLONE = "TWI_241";        // Phase I Clone Trooper, cost 2, [Heroism]
const HUNTER = "C26_003";       // Zam Wesell, 2/4 cost 2, Bounty Hunter
const MARINE = Cards.units.sor.battlefieldMarine;
const SECURITY = Cards.units.sor.consularSecurityForce;
/** Forces a hand discard by the opponent. */
const DISCARD_EVENT = "SHD_181"; // Pillage — "the opponent discards 2 cards from their hand"

/** Command base + Command leader, so a [Heroism] Clone is off-aspect by 2 without a waiver. */
function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.ash.moffGideonIndomitableWarlord) // Command/Villainy — no Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}

const at = (g: GameTestAdapter, p: 1 | 2, cardId: string) => {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId);
};
const spent = (g: GameTestAdapter, p: 1 | 2) =>
  (p === 1 ? g.state.player1 : g.state.player2).resources.filter(r => !r.ready).length;

describe("SHD_198 Omega — Part of the Squad", () => {
  it("waives the aspect penalty on the first Clone unit played that round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, OMEGA).WithCardInHandForPlayer(1, CLONE).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(spent(g, 1)).toBe(2); // printed cost, no +2 off-aspect penalty
  });

  it("only waives it ONCE each round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, OMEGA)
        .WithCardInHandForPlayer(1, CLONE)
        .WithCardInHandForPlayer(1, CLONE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const afterFirst = spent(g, 1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);

    expect(afterFirst).toBe(2);
    expect(spent(g, 1) - afterFirst).toBe(4); // cost 2 + the 2 penalty
  });

  it("does not waive it for a NON-Clone unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, OMEGA).WithCardInHandForPlayer(1, Cards.units.sor.wampa).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(spent(g, 1)).toBe(6); // Wampa cost 4 + 2 off-aspect
  });

  it("control: without Omega the penalty stands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, CLONE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(spent(g, 1)).toBe(4);
  });
});

describe("SHD_239 Toro Calican — Ambitious Upstart", () => {
  it("damages the played Bounty Hunter to ready himself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, TORO, false)  // exhausted
        .WithCardInHandForPlayer(1, HUNTER)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(at(g, 1, HUNTER)!.damage).toBe(1);
    expect(at(g, 1, TORO)!.ready).toBe(true);
  });

  it("is optional — declining leaves him exhausted and the newcomer unhurt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, TORO, false).WithCardInHandForPlayer(1, HUNTER).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(at(g, 1, HUNTER)!.damage).toBe(0);
    expect(at(g, 1, TORO)!.ready).toBe(false);
  });

  it("does not fire for a NON-Bounty-Hunter unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, TORO, false).WithCardInHandForPlayer(1, MARINE).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(at(g, 1, TORO)!.ready).toBe(false);
  });

  it("fires only once each round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, TORO, false)
        .WithCardInHandForPlayer(1, HUNTER)
        .WithCardInHandForPlayer(1, HUNTER)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});

describe("SHD_163 Migs Mayfeld — Triggerman", () => {
  /**
   * Pillage makes a player discard 2 from hand. Its own prompt picks who discards; the discarding
   * player then chooses which cards. Migs' offer follows that.
   */
  async function pillageThenMigs(g: GameTestAdapter) {
    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // "No" = the OPPONENT discards
    // The discard is resolved one card at a time, so answer until player 2's hand is empty.
    let guard = 0;
    while (g.state.player2.hand.length > 0 && guard++ < 4) {
      await g.dispatchAsync(2, "choose-target", { targetIndices: [0] });
    }
  }

  function board() {
    return base()
      .WithGroundUnitForPlayer(1, MIGS)
      .WithCardInHandForPlayer(1, DISCARD_EVENT)
      .WithCardInHandForPlayer(2, MARINE)
      .WithCardInHandForPlayer(2, MARINE)
      .WithGroundUnitForPlayer(2, SECURITY);
  }

  it("offers 2 damage after a hand discard, and applies it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await pillageThenMigs(g);
    expect(g.state.player2.hand).toHaveLength(0); // the discard really happened
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, SECURITY)!.playId] });

    expect(at(g, 2, SECURITY)!.damage).toBe(2);
  });

  it("is optional", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await pillageThenMigs(g);
    await g.chooseNoAsync(1);

    expect(at(g, 2, SECURITY)!.damage).toBe(0);
  });

  it("can hit a base instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await pillageThenMigs(g);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
  });

  it("fires only once each round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithCardInHandForPlayer(1, DISCARD_EVENT)
        .WithCardInHandForPlayer(2, MARINE)
        .WithCardInHandForPlayer(2, MARINE)
        .Build(),
    );

    await pillageThenMigs(g);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, SECURITY)!.playId] });
    await g.dispatchAsync(2, "pass-action", {});
    await pillageThenMigs(g);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(at(g, 2, SECURITY)!.damage).toBe(2); // still just the first hit
  });
});
