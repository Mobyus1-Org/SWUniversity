import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// IC27_187 Jar Jar Binks — Bumbling Representative (1/5 Ground, cost 2, Heroism)
//   "On Attack: Discard a card from your deck. If it costs 6 or more, this unit gets +4/+0 for this
//    attack."
// The discarded card is the top one. An empty deck discards nothing, so there is no buff.

const JARJAR = Cards.units.ic27.jarJarBinks;
const COST5 = Cards.units.ic27.moffGideon;          // cost 5
const COST6 = Cards.units.ic27.grandAdmiralThrawn;  // cost 6

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, JARJAR);
}

describe("IC27_187 Jar Jar Binks — On Attack", () => {
  it("discards the top card; cost 6 or more gives +4/+0 for this attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDeckForPlayer(1, COST6).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.deck).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([COST6]);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("the buff lasts only for the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDeckForPlayer(1, COST6).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(1);
  });

  it("control: a cost-5 card is still discarded but gives no buff", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDeckForPlayer(1, COST5).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([COST5]);
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("only the TOP card is discarded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDeckForPlayer(1, COST6).WithCardInDeckForPlayer(1, COST5).Build());
    const top = g.state.player1.deck[g.state.player1.deck.length - 1].cardId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([top]);
    expect(g.state.player1.deck).toHaveLength(1);
  });

  it("an empty deck discards nothing and gives no buff", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
  });
});
