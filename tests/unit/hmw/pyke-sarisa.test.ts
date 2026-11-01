import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// HMW_246 Pyke Sarisa (4/3 Space, cost 4, Villainy) —
//   "When Played: Give a unit Sentinel for this phase."
// Same text as SOR_086 Gladiator Star Destroyer. Mandatory; any unit, either side.

const SARISA = Cards.units.hmw.pykeSarisa;
const MARINE = Cards.units.sor.battlefieldMarine;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, SARISA)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithGroundUnitForPlayer(2, MARINE)
    .WithActivePlayer(1);
}

const sentinel = (u: { cardId: string; playId: string; controller: 1 | 2 }) =>
  HasSentinel(u.cardId, u.playId, u.controller);

describe("HMW_246 Pyke Sarisa", () => {
  it("prompts for a target unit (mandatory)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });

  it("gives an enemy unit Sentinel for this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    const enemy = g.state.player2.groundArena[0];
    expect(sentinel(enemy)).toBe(false);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy.playId] });

    expect(sentinel(g.state.player2.groundArena[0])).toBe(true);
    expect(sentinel(g.state.player1.groundArena[0])).toBe(false); // only the chosen unit
  });

  it("can give a friendly unit Sentinel", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    const friendly = g.state.player1.groundArena[0];

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendly.playId] });

    expect(sentinel(g.state.player1.groundArena[0])).toBe(true);
    expect(sentinel(g.state.player2.groundArena[0])).toBe(false);
  });
});
