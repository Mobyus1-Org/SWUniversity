import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";
import { ActionAbilities } from "@/server/engine/actions/action-ability";

// IC27_107 Aurra Sing — Getting Even (1/7 Ground, cost 6, Aggression/Villainy)
//   "Hidden. Action [Exhaust]: Deal 4 damage to a unit."

const AURRA = Cards.units.ic27.aurraSing;
const CSF = Cards.units.sor.consularSecurityForce; // 3/7
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3

function board(ready = true) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, AURRA, ready)
    .WithGroundUnitForPlayer(2, CSF)
    .WithGroundUnitForPlayer(2, MARINE);
}

const targets = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] } | undefined)?.fromPlayIds ?? [];

async function useAction(g: GameTestAdapter) {
  await g.dispatchAsync(1, "use-ability", { cardId: AURRA, playId: g.state.player1.groundArena[0].playId });
}

describe("IC27_107 Aurra Sing", () => {
  it("has Hidden", () => {
    expect(HasHidden(AURRA)).toBe(true);
  });

  it("Action: exhausts her and deals 4 damage to the chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await useAction(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player2.groundArena[0].damage).toBe(4);
  });

  it("offers every unit on the table, herself included", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await useAction(g);

    expect([...targets(g)].sort()).toEqual([
      g.state.player1.groundArena[0].playId,
      g.state.player2.groundArena[0].playId,
      g.state.player2.groundArena[1].playId,
    ].sort());
  });

  it("4 damage defeats a 3-HP unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await useAction(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[1].playId] });

    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([CSF]);
  });

  it("exhausted, the Action is unavailable", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(false).Build());
    return useAction(g).then(() => {
      expect(g.state.player2.groundArena.every(u => u.damage === 0)).toBe(true);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    });
  });

  it("is registered as an Action ability", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    expect(ActionAbilities(AURRA, 1, g.state.player1.groundArena[0].playId)).toContain(AURRA);
  });
});
