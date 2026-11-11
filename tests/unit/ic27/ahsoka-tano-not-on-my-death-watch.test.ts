import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_039 Ahsoka Tano — Not on My Death Watch (4/5 Ground, cost 5, Vigilance/Heroism)
//   "When Played: You may defeat a unit that costs 3 or less."

const AHSOKA = Cards.units.ic27.ahsokaTano;
const MARINE = Cards.units.sor.battlefieldMarine;       // cost 2
const SECURITY = Cards.units.sor.consularSecurityForce; // cost 4
const TIE = Cards.units.sor.tieLnFighter;               // cost 1, space

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, AHSOKA);
}

describe("IC27_039 Ahsoka Tano — Not on My Death Watch", () => {
  it("offers every unit that costs 3 or less, either side and arena; the pick is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithGroundUnitForPlayer(2, SECURITY)
      .WithSpaceUnitForPlayer(2, TIE)
      .Build());
    const expected = [g.state.player1.groundArena[0].playId, g.state.player2.groundArena[0].playId, g.state.player2.spaceArena[0].playId];

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type === "Target" ? [...(res.fromPlayIds ?? [])].sort() : []).toEqual([...expected].sort());
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });

    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player2.discard.map(d => d.cardId)).toContain(TIE);
  });

  it("declining defeats nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("no prompt when nothing costs 3 or less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });
});
