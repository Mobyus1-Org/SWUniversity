import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_237 Easy Prey (Event, cost 1, Cunning, Innate) —
//   "Create a Beast token."
//   "An opponent creates a Beast token. Give a Weakness token to it."
//
// Fully automatic — no targets at all. The subtlety is "it": the Weakness goes on the OPPONENT's
// new Beast, not yours, so you end up with a 3/3 and they end up with a 2/2.
//
// Beast tokens are 3/3 and Weakness is −1/−1, so the opponent's survives; a lethal-token sweep is
// not in play here, but the counts are, which is what catches a double-resolution.

const EASY_PREY = "HMW_237";
const BEAST = "HMW_T03";
const WEAKNESS = "HMW_T02";
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP) // Cunning
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, EASY_PREY)
    .WithActivePlayer(1);
}

const beasts = (g: GameTestAdapter, p: 1 | 2) =>
  (p === 1 ? g.state.player1 : g.state.player2).groundArena.filter(u => u.cardId === BEAST);

describe("HMW_237 Easy Prey", () => {
  it("creates exactly one Beast for each player", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(beasts(g, 1)).toHaveLength(1);
    expect(beasts(g, 2)).toHaveLength(1);
  });

  it("puts the Weakness token on the OPPONENT's Beast only", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(beasts(g, 2)[0].upgrades.map(u => u.cardId)).toEqual([WEAKNESS]);
    expect(beasts(g, 1)[0].upgrades).toHaveLength(0);
  });

  it("leaves you a 3/3 and the opponent a 2/2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    const mine = Unit.FromInterface(beasts(g, 1)[0]);
    const theirs = Unit.FromInterface(beasts(g, 2)[0]);
    expect([mine.CurrentPower(), mine.TotalHP()]).toEqual([3, 3]);
    expect([theirs.CurrentPower(), theirs.TotalHP()]).toEqual([2, 2]);
  });

  it("both Beasts enter play exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(beasts(g, 1)[0].ready).toBe(false);
    expect(beasts(g, 2)[0].ready).toBe(false);
  });

  it("asks for nothing — the whole card is automatic", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("works the same when player 2 plays it — the Weakness follows the OPPONENT", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.yellow30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(2, MARINE, 14)
        .WithCardInHandForPlayer(2, EASY_PREY)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.playCardFromHandAsync(2, 0);

    expect(beasts(g, 2)[0].upgrades).toHaveLength(0);        // the caster's is clean
    expect(beasts(g, 1)[0].upgrades.map(u => u.cardId)).toEqual([WEAKNESS]);
  });
});
