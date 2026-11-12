import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";

// IC27_106 Kylo Ren — Relentless (5/5 Ground, cost 5, Aggression/Villainy)
//   "Hidden. On Attack: If this is the first time this unit has attacked this phase, ready him."

const KYLO = Cards.units.ic27.kyloRenRelentless;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, KYLO);
}

async function attackBase(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.chooseBaseAsync(1, 2);
}

describe("IC27_106 Kylo Ren — Relentless", () => {
  it("has Hidden", () => {
    expect(HasHidden(KYLO)).toBe(true);
  });

  it("his first attack this phase readies him", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await attackBase(g);

    expect(g.state.player2.base.damage).toBe(5);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("his second attack the same phase leaves him exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await attackBase(g);
    await g.dispatchAsync(2, "pass-action", {});
    await attackBase(g);

    expect(g.state.player2.base.damage).toBe(10);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("a blanked Kylo stays exhausted", async () => {
    const g = new GameTestAdapter();
    const state = board().Build();
    state.currentEffects.push({
      cardId: Cards.events.sor.forceLightning, duration: "Phase", affectedPlayer: 1,
      targetPlayId: state.player1.groundArena[0].playId,
    });
    g.loadNewState(state);

    await attackBase(g);

    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});
