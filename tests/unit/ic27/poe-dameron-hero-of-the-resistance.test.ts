import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// IC27_115 Poe Dameron — Hero of the Resistance (2/4 Ground, cost 2, Aggression/Heroism)
//   "When you play another Resistance card: This unit gets +1/+0 for this phase."

const POE = Cards.units.ic27.poeDameron;
const BLACK_ONE = Cards.units.ic27.blackOne;     // Resistance unit, cost 3
const MARINE = Cards.units.sor.battlefieldMarine; // Rebel, not Resistance

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 12)
    .FillResourcesForPlayer(2, MARINE, 12)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(2, MARINE);
}

const poePower = (g: GameTestAdapter) =>
  Unit.FromInterface(g.state.player1.groundArena.find(u => u.cardId === POE)!).CurrentPower();

/** Plays hand card 0 and answers any trigger-ordering prompt. */
async function play(g: GameTestAdapter, player: 1 | 2) {
  await g.playCardFromHandAsync(player, 0);
  const res = g.lastDispatchResponse?.resolutionNeeded as { type?: string; options?: string[] } | undefined;
  if (res?.type === "Option" && res.options?.some(o => o.includes("Reaction"))) {
    await g.chooseOptionAsync(player, res.options.find(o => o.includes("Reaction"))!);
  }
}

describe("IC27_115 Poe Dameron", () => {
  it("playing another Resistance card gives him +1/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, POE).WithCardInHandForPlayer(1, BLACK_ONE).Build());

    await play(g, 1);

    expect(poePower(g)).toBe(3);
  });

  it("two Resistance plays stack (+2)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, POE)
      .WithCardInHandForPlayer(1, BLACK_ONE).WithCardInHandForPlayer(1, Cards.units.sec.craitVeteran).Build());

    await play(g, 1);
    await g.dispatchAsync(2, "pass-action", {});
    await play(g, 1);

    expect(poePower(g)).toBe(4);
  });

  it("a non-Resistance card does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, POE).WithCardInHandForPlayer(1, MARINE).Build());

    await play(g, 1);

    expect(poePower(g)).toBe(2);
  });

  it("his own play does not count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, POE).Build());

    await play(g, 1);

    expect(poePower(g)).toBe(2);
  });

  it("an opponent's Resistance card does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, POE).WithCardInHandForPlayer(2, BLACK_ONE).WithActivePlayer(2).Build());

    await play(g, 2);

    expect(poePower(g)).toBe(2);
  });

  it("a blanked Poe gets nothing", async () => {
    const g = new GameTestAdapter();
    const state = board().WithGroundUnitForPlayer(1, POE).WithCardInHandForPlayer(1, BLACK_ONE).Build();
    state.currentEffects.push({
      cardId: Cards.events.sor.forceLightning, duration: "Phase", affectedPlayer: 1,
      targetPlayId: state.player1.groundArena[0].playId,
    });
    g.loadNewState(state);

    await play(g, 1);

    expect(poePower(g)).toBe(2);
  });
});
