import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";

// ASH_172 Razor Crest (3/5 Space, cost 4) — "Saboteur (When this unit attacks, ignore Sentinel and
// defeat the defender's Shields.)\nOn Attack: You may discard a card from your hand. If you do,
// this unit gets +2/+0 for this attack."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_172 Razor Crest — Saboteur", () => {
  it("has printed Saboteur", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, Cards.units.ash.razorCrest).Build());
    const crest = g.state.player1.spaceArena[0];
    expect(HasKeyword(Cards.units.ash.razorCrest, "Saboteur", crest.playId, 1)).toBe(true);
  });
});

describe("ASH_172 Razor Crest — On Attack", () => {
  it("may discard a card from hand for +2/+0 this attack", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.razorCrest)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player1.hand).toHaveLength(0); // discarded
    expect(g.state.player2.base.damage).toBe(5); // power 3 + 2 buff
  });

  it("may decline — no buff, attacks at normal power", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.razorCrest)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand).toHaveLength(1); // not discarded
    expect(g.state.player2.base.damage).toBe(3); // power 3 only
  });

  it("does not offer the option with an empty hand (control)", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.razorCrest)
      .Build();
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 0);
    const resp = await g.chooseBaseAsync(1, 2);

    expect(resp.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(3);
  });
});
