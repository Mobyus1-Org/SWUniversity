import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_167 Lando Calrissian — Check This Out (4/4 Ground, cost 3, Cunning/Cunning)
//   "When Played: Return 3 friendly resources to their owners' hands. Then, you may resource up to
//    3 cards from your hand."

const LANDO = Cards.units.ic27.landoCalrissian;
const MARINE = Cards.units.sor.battlefieldMarine;
const SWOOP = Cards.units.sor.swoopRacer;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8)
    .WithCardInHandForPlayer(1, LANDO)
    .WithCardInHandForPlayer(1, SWOOP);
}

const res = (g: GameTestAdapter) =>
  g.lastDispatchResponse?.resolutionNeeded as { type?: string; fromPlayIds?: string[]; maxTargets?: number } | undefined;
const resourceIds = (g: GameTestAdapter, n: number) => g.state.player1.resources.slice(0, n).map(r => r.playId);

describe("IC27_167 Lando Calrissian", () => {
  it("returns the 3 chosen resources, then resources the chosen hand cards exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    expect(res(g)?.maxTargets).toBe(3);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: resourceIds(g, 3) });

    expect(g.state.player1.resources).toHaveLength(5);
    expect(g.state.player1.hand).toHaveLength(4); // Swoop + 3 Marines

    const handBefore = g.state.player1.hand.map(c => c.cardId);
    await g.chooseCardFromHandAsync(1, handBefore.indexOf(SWOOP));
    await g.chooseCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] }); // stop at 2

    expect(g.state.player1.resources).toHaveLength(7);
    expect(g.state.player1.hand).toHaveLength(2);
    const added = g.state.player1.resources.slice(-2);
    expect(added.every(r => !r.ready)).toBe(true);
    expect(added.map(r => r.cardId)).toContain(SWOOP);
    expect(g.state.player1.discard).toHaveLength(0); // resourcing is not discarding
  });

  it("returning fewer than 3 is refused", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: resourceIds(g, 2) });

    expect(g.state.player1.resources).toHaveLength(8);

    // Still waiting: exactly 3 afterwards resolves.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: resourceIds(g, 3) });
    expect(g.state.player1.resources).toHaveLength(5);
  });

  it("resourcing is optional — 'up to 3' includes none", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: resourceIds(g, 3) });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });

    expect(g.state.player1.resources).toHaveLength(5);
    expect(g.state.player1.hand).toHaveLength(4);
    expect(res(g)).toBeFalsy();
  });

  it("caps the resourcing at 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: resourceIds(g, 3) });
    for (let i = 0; i < 3; i++) await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.resources).toHaveLength(8);
    expect(g.state.player1.hand).toHaveLength(1);
    expect(res(g)).toBeFalsy();
  });

  it("a resource the opponent owns goes to the opponent's hand", async () => {
    const g = new GameTestAdapter();
    const state = board().Build();
    state.player1.resources[0].owner = 2;
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: resourceIds(g, 3) });

    expect(g.state.player2.hand).toHaveLength(1);
    expect(g.state.player1.hand).toHaveLength(3);
  });
});
