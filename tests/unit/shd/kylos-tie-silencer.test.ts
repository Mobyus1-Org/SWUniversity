import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameState } from "@/lib/engine/game";
import { DiscardPlayableCards } from "@/server/engine/card-playability";
import { Cards } from "../../card-helpers";

// SHD_135 Kylo's TIE Silencer — Ruthlessly Efficient (Unit 3/2 Space, cost 2, Villainy/Aggression)
//   "Action: If this unit was discarded from your hand or deck this phase, play it from your
//    discard pile (paying its cost)."
//
// A discard-hosted Action. "Discarded from your hand or deck" is a record of how THIS copy reached
// the pile — one defeated out of play doesn't qualify.

const SILENCER = Cards.units.shd.kylosTieSilencer;
const MARINE = Cards.units.sor.battlefieldMarine;
const DURABLE = Cards.units.sor.consularSecurityForce; // cost 4

function base(resources: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.darthVader) // Aggression/Villainy — no penalty on the Silencer
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const silencerInDiscard = (g: GameTestAdapter) => g.state.player1.discard.find(c => c.cardId === SILENCER);

/** Records that the Silencer at the top of player 1's discard got there from hand or deck. */
function discardedFrom(state: GameState, from: "Hand" | "Deck") {
  const c = state.player1.discard.find(d => d.cardId === SILENCER)!;
  state.roundState.cardsDiscardedThisPhase.push({ player: 1, cardId: SILENCER, playId: c.playId, from });
}

describe("SHD_135 Kylo's TIE Silencer", () => {
  it("end to end: discarded from hand, then played from the discard paying its cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(10)
        .WithCardInHandForPlayer(1, Cards.events.ash.recklessSacrifice)
        .WithCardInHandForPlayer(1, SILENCER)
        .WithGroundUnitForPlayer(2, DURABLE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0); // discard the Silencer
    await g.chooseGroundUnitAsync(2, 0);
    expect(silencerInDiscard(g)).toBeDefined();
    await g.dispatchAsync(2, "pass-action", {});

    const before = ready(g);
    await g.dispatchAsync(1, "use-ability", { cardId: SILENCER, playId: silencerInDiscard(g)!.playId });

    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([SILENCER]);
    expect(silencerInDiscard(g)).toBeUndefined();
    expect(before - ready(g)).toBe(2);
  });

  it("milled from the deck also qualifies — and play-card from the Discard zone works too", async () => {
    const g = new GameTestAdapter();
    const state = base(4).WithCardInDiscardForPlayer(1, SILENCER).Build();
    discardedFrom(state, "Deck");
    g.loadNewState(state);

    await g.dispatchAsync(1, "play-card", { cardId: SILENCER, fromZone: "Discard", playId: silencerInDiscard(g)!.playId });

    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([SILENCER]);
    expect(ready(g)).toBe(2);
  });

  it("a Silencer that reached the discard any other way (defeated) can't be played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(4).WithCardInDiscardForPlayer(1, SILENCER).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: SILENCER, playId: silencerInDiscard(g)!.playId });

    expect(g.lastDispatchResponse?.invalidReason ?? "").toMatch(/condition is not met/);
    expect(silencerInDiscard(g)).toBeDefined();
    expect(ready(g)).toBe(4);
  });

  it("unaffordable → refused, and nothing moves", async () => {
    const g = new GameTestAdapter();
    const state = base(1).WithCardInDiscardForPlayer(1, SILENCER).Build();
    discardedFrom(state, "Hand");
    g.loadNewState(state);

    await g.dispatchAsync(1, "use-ability", { cardId: SILENCER, playId: silencerInDiscard(g)!.playId });

    expect(g.lastDispatchResponse?.invalidReason ?? "").toMatch(/Not enough resources/);
    expect(silencerInDiscard(g)).toBeDefined();
    expect(g.state.player1.spaceArena).toHaveLength(0);
  });

  it("the opponent can't play it out of YOUR discard", async () => {
    const g = new GameTestAdapter();
    const state = base(4)
      .WithActivePlayer(2)
      .FillResourcesForPlayer(2, MARINE, 4)
      .WithCardInDiscardForPlayer(1, SILENCER)
      .Build();
    discardedFrom(state, "Hand");
    g.loadNewState(state);

    await g.dispatchAsync(2, "use-ability", { cardId: SILENCER, playId: silencerInDiscard(g)!.playId });

    expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
    expect(silencerInDiscard(g)).toBeDefined();
    expect(g.state.player2.spaceArena).toHaveLength(0);
  });

  it("DiscardPlayableCards (the discard pile's Play button) lists it only once it qualifies", () => {
    const state = base(4).WithCardInDiscardForPlayer(1, SILENCER).Build();
    expect(DiscardPlayableCards(state, 1)).toEqual([]);

    discardedFrom(state, "Hand");
    expect(DiscardPlayableCards(state, 1)).toEqual([
      { playId: state.player1.discard[0].playId, cardId: SILENCER, cost: 2 },
    ]);
  });
});
