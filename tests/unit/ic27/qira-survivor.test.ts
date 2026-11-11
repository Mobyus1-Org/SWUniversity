import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// IC27_045 Qi'ra — Survivor (1/1 Ground, cost 3, Vigilance/Vigilance)
//   "When Played: Give 2 Experience tokens to this unit.
//    When Defeated: Choose a unit. You may give an Experience token to it for each Experience token
//    that was on this unit."

const QIRA = Cards.units.ic27.qira;
const MARINE = Cards.units.sor.battlefieldMarine;
const RIVALS_FALL = Cards.events.shd.rivalsFall;
const XP = Cards.upgrades.token.experience;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const xp = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;
const xpTokens = (n: number) => Array.from({ length: n }, () => ({ cardId: XP, playId: "@", owner: 1 as const, controller: 1 as const }));

describe("IC27_045 Qi'ra — When Played", () => {
  it("gives her exactly 2 Experience tokens (3/3)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, QIRA).Build());

    await g.playCardFromHandAsync(1, 0);

    const qira = g.state.player1.groundArena[0];
    expect(xp(qira)).toBe(2);
    expect(Unit.FromInterface(qira).CurrentPower()).toBe(3);
    expect(Unit.FromInterface(qira).TotalHP()).toBe(3);
  });
});

describe("IC27_045 Qi'ra — When Defeated", () => {
  async function defeatQira(g: GameTestAdapter) {
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
  }

  function withQira(xpCount: number) {
    const state = board()
      .WithCardInHandForPlayer(1, RIVALS_FALL)
      .WithGroundUnitForPlayer(1, QIRA)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build();
    state.player1.groundArena[0].upgrades = xpTokens(xpCount).map((t, i) => ({ ...t, playId: `x${i}` }));
    return state;
  }

  it("gives the chosen unit one token per token she carried — any unit, enemy included", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(withQira(3));
    const enemy = g.state.player2.groundArena[0].playId;

    await defeatQira(g);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
    expect(xp(g.state.player2.groundArena[0])).toBe(3);
  });

  it("declining gives nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(withQira(2));

    await defeatQira(g);
    await g.chooseNoAsync(1);

    expect(xp(g.state.player1.groundArena[0])).toBe(0);
    expect(xp(g.state.player2.groundArena[0])).toBe(0);
  });

  it("with no tokens on her there is no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(withQira(0));

    await defeatQira(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(xp(g.state.player1.groundArena[0])).toBe(0);
  });

  it("played normally, then defeated, she passes on the 2 her When Played gave", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithCardInHandForPlayer(1, QIRA)
      .WithCardInHandForPlayer(1, RIVALS_FALL)
      .WithGroundUnitForPlayer(1, MARINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    const qira = g.state.player1.groundArena.find(u => u.cardId === QIRA)!.playId;
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [qira] });
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(xp(g.state.player1.groundArena[0])).toBe(2);
  });
});
