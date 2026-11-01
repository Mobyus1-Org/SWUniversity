import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";

// LOF_162 Hunting Nexu (4/4 Ground, cost 4, Aggression) —
//   "While you control another Aggression unit, this unit gains Raid 2."
// Same card as SHD_168.

const NEXU = Cards.units.lof.huntingNexu;
const AGGRESSION = Cards.units.hmw.filthyDianoga; // Aggression/Villainy, no text
const NON_AGGRESSION = Cards.units.hmw.ewokBrigade;

function board(other?: string, otherPlayer: 1 | 2 = 1) {
  const b = new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithGroundUnitForPlayer(1, NEXU)
    .WithActivePlayer(1);
  if (other) b.WithGroundUnitForPlayer(otherPlayer, other);
  return b;
}

const raid = (g: GameTestAdapter) => {
  const n = g.state.player1.groundArena.find(u => u.cardId === NEXU)!;
  return RaidAmount(n.cardId, n.playId, 1);
};

describe("LOF_162 Hunting Nexu", () => {
  it("gains Raid 2 with another friendly Aggression unit, and attacks a base for 6", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(AGGRESSION).Build());
    expect(raid(g)).toBe(2);

    await g.attackWithGroundUnitAsync(1, 0);
    if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("does not count itself", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    expect(raid(g)).toBe(0);
  });

  it("a non-Aggression friendly unit does not switch it on", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(NON_AGGRESSION).Build());
    expect(raid(g)).toBe(0);
  });

  it("an enemy Aggression unit does not switch it on", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(AGGRESSION, 2).Build());
    expect(raid(g)).toBe(0);
  });
});
