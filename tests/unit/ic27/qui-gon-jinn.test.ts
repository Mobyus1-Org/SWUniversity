import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { Unit } from "@/server/engine/unit";

// IC27_079 Qui-Gon Jinn — Unwavering Belief (5/5 Ground, cost 5, Command/Heroism)
//   "Sentinel. When Played: Give another friendly unit +2/+2 for this phase."
// Mandatory ("Give", not "may give"); "another" excludes Qui-Gon himself.

const QUIGON = Cards.units.ic27.quiGonJinn;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14);
}

describe("IC27_079 Qui-Gon Jinn — Unwavering Belief", () => {
  it("has Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, QUIGON).Build());

    expect(HasSentinel(QUIGON, g.state.player1.groundArena[0].playId, 1)).toBe(true);
  });

  it("When Played: gives another friendly unit +2/+2 for this phase — no yes/no", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, QUIGON).Build());
    const marine = g.state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Target");
    expect(res?.type === "Target" ? res.fromPlayIds : []).toEqual([marine]); // not Qui-Gon
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    const buffed = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(buffed.CurrentPower()).toBe(5);
    expect(buffed.TotalHP()).toBe(5);
  });

  it("control: with no other friendly unit there is nothing to choose", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, QUIGON).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(3); // enemies never
  });
});
