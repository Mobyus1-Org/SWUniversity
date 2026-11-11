import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";

// IC27_067 Darth Vader — Useless to Resist (8/8 Ground, cost 8, Command/Villainy)
//   "Ambush. Each other friendly unit gains Ambush."

const VADER = Cards.units.ic27.darthVader;
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3 Ground, no text
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7 Ground, no text

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const ambush = (g: GameTestAdapter, idx: number, player: 1 | 2 = 1) => {
  const u = (player === 1 ? g.state.player1 : g.state.player2).groundArena[idx];
  return HasAmbush(u.cardId, u.playId, "Hand", player);
};

describe("IC27_067 Darth Vader — Useless to Resist", () => {
  it("has Ambush himself: played with an enemy unit in play, he may attack it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, VADER).WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0); // 8 power vs 7 HP
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });

  it("each other friendly unit gains Ambush — a unit played afterwards may ambush", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, VADER)
      .WithCardInHandForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)).toBeUndefined(); // traded 3/3 for 3/3
  });

  it("the grant is to friendly units only, and not to Vader via the aura", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, VADER)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    expect(ambush(g, 1)).toBe(true);     // friendly Marine
    expect(ambush(g, 0, 2)).toBe(false); // enemy Marine
  });

  it("control: without Vader a vanilla unit has no Ambush and is not asked", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });
});
