import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_044 Razor Crest — Reliable Gunship (3/4 Space, cost 4, Vigilance/Heroism)
//   "Restore 2. When Played: You may return an upgrade from your discard pile to your hand."
// Only UPGRADE cards qualify — a unit or event in the discard is not a legal pick.

const UPGRADE = Cards.upgrades.sor.academyTraining;
const UNIT = Cards.units.sor.battlefieldMarine;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, UNIT, 10)
    .WithCardInHandForPlayer(1, Cards.units.shd.razorCrest);
}

describe("SHD_044 Razor Crest — When Played", () => {
  it("may return an upgrade from the discard pile to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, UPGRADE).Build());
    const discardPlayId = g.state.player1.discard[0].playId;

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardPlayId] });

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([UPGRADE]);
    expect(g.state.player1.discard).toHaveLength(0);
  });

  it("only the upgrade is offered when the discard also holds a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, UNIT).WithCardInDiscardForPlayer(1, UPGRADE).Build());
    const upgradePlayId = g.state.player1.discard.find(c => c.cardId === UPGRADE)!.playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type === "Target" ? res.fromPlayIds : undefined).toEqual([upgradePlayId]);
  });

  it("declining leaves the discard pile untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, UPGRADE).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([UPGRADE]);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("no prompt when the discard holds no upgrade (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, UNIT).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([UNIT]);
  });
});

describe("SHD_044 Razor Crest — Restore 2", () => {
  it("heals 2 damage from its controller's base when it attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.lukeSkywalker)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithSpaceUnitForPlayer(1, Cards.units.shd.razorCrest)
        .Build(),
    );
    g.state.player1.base.damage = 5;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(3);
    expect(g.state.player2.base.damage).toBe(3);
  });
});
