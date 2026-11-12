import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { ActionAbilities } from "@/server/engine/actions/action-ability";

// IC27_120 Rey — Embracing Destiny (6/6 Ground, cost 5, Aggression/Heroism)
//   "Action [1 resource, discard a card from your hand]: Attack with a unit. It gets +2/+0 for this
//    attack."  No [Exhaust] in the cost — Rey may attack with herself.

const REY = Cards.units.ic27.reyEmbracingDestiny;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3

function board(opts: { resources?: number; hand?: boolean } = {}) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, opts.resources ?? 3)
    .WithGroundUnitForPlayer(1, REY)
    .WithGroundUnitForPlayer(1, MARINE);
  if (opts.hand !== false) b = b.WithCardInHandForPlayer(1, MARINE);
  return b;
}

const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const reyId = (g: GameTestAdapter) => g.state.player1.groundArena[0].playId;

async function useAction(g: GameTestAdapter) {
  await g.dispatchAsync(1, "use-ability", { cardId: REY, playId: reyId(g) });
}

describe("IC27_120 Rey — Embracing Destiny", () => {
  it("pays 1, discards a card, then another unit attacks with +2/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await useAction(g);
    await g.chooseCardFromHandAsync(1, 0);
    expect(ready(g)).toBe(2);
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([MARINE]);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5);
    expect(g.state.player1.groundArena[0].ready).toBe(true); // Rey herself never exhausted
  });

  it("Rey can attack with herself (+2 → 8)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await useAction(g);
    await g.chooseCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [reyId(g)] });
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(8);
  });

  it("empty hand: the Action is unavailable", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board({ hand: false }).Build());
    expect(ActionAbilities(REY, 1, reyId(g))).not.toContain(REY);
  });

  it("no resource: the Action is rejected", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board({ resources: 0 }).Build());

    await useAction(g);

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
