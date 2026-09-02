import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";

// HMW_118 Ryyk Blademaster (5/4 Ground, cost 4, Command/Heroism, Wookiee) —
//   "While you control 6 or more resources, this unit gains Ambush and Overwhelm."
//
// One condition, TWO keyword dictionaries — a card that registers in only one of them is
// half-implemented and nothing warns you, because each dictionary is a separate hand-written
// switch.
//
// "Control 6 or more resources" counts every resource, exhausted ones included: the wording is
// about control, not readiness. That is the same reading the Epic Action deploy conditions use.

const BLADEMASTER = "HMW_118";
const FILLER = Cards.units.sor.battlefieldMarine;

function board(resources: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, FILLER, resources)
    .WithGroundUnitForPlayer(1, BLADEMASTER)
    .WithActivePlayer(1);
}

function keywords(g: GameTestAdapter) {
  const u = g.state.player1.groundArena.find(x => x.cardId === BLADEMASTER)!;
  return {
    ambush: HasAmbush(u.cardId, u.playId, undefined, 1) === true,
    overwhelm: HasOverwhelm(u.cardId, u.playId, 1) === true,
  };
}

describe("HMW_118 Ryyk Blademaster", () => {
  it("gains BOTH Ambush and Overwhelm at 6 resources", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6).Build());

    expect(keywords(g)).toEqual({ ambush: true, overwhelm: true });
  });

  it("has neither at 5 resources", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(5).Build());

    expect(keywords(g)).toEqual({ ambush: false, overwhelm: false });
  });

  it("counts EXHAUSTED resources too — the text says control, not ready", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, FILLER, 6, false) // all six exhausted
        .WithGroundUnitForPlayer(1, BLADEMASTER)
        .WithActivePlayer(1)
        .Build(),
    );

    expect(keywords(g)).toEqual({ ambush: true, overwhelm: true });
  });

  it("the OPPONENT's resources do not count", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, FILLER, 3)
        .FillResourcesForPlayer(2, FILLER, 9)
        .WithGroundUnitForPlayer(1, BLADEMASTER)
        .WithActivePlayer(1)
        .Build(),
    );

    expect(keywords(g)).toEqual({ ambush: false, overwhelm: false });
  });

  it("Overwhelm really applies in combat at 6 resources", async () => {
    // The dictionary answering true is not the same as combat honouring it, so this drives the
    // keyword through a real attack: a 5-power Blademaster into a 3/3 spills 2 to the base.
    const g = new GameTestAdapter();
    g.loadNewState(board(6).WithGroundUnitForPlayer(2, FILLER).Build());

    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === BLADEMASTER);
    await g.attackWithGroundUnitAsync(1, idx);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0); // the 3/3 died
    expect(g.state.player2.base.damage).toBe(2);         // 5 power - 3 HP spilled over
  });

  it("control: at 5 resources the same attack spills nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(5).WithGroundUnitForPlayer(2, FILLER).Build());

    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === BLADEMASTER);
    await g.attackWithGroundUnitAsync(1, idx);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(0); // no Overwhelm, no spill
  });
});
