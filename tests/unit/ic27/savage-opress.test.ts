import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_108 is a reprint of TWI_137: same text and stats, so this mirrors TWI_137's tests.

// IC27_108 Savage Opress — Monster (7/7 Ground)
// "When Played: If you control fewer units (including this one) than an opponent, ready this unit."

const SAVAGE = Cards.units.ic27.savageOpress;
const MARINE = Cards.units.sor.battlefieldMarine;
const SECURITY = Cards.units.sor.consularSecurityForce;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, SAVAGE);
}

const savage = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === SAVAGE)!;

describe("IC27_108 Savage Opress — When Played", () => {
  it("readies himself when you control FEWER units than the opponent", async () => {
    const g = new GameTestAdapter();
    // After he lands: 1 v 2.
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(savage(g).ready).toBe(true);
  });

  it("control: stays exhausted on EQUAL counts — he counts himself", async () => {
    const g = new GameTestAdapter();
    // After he lands: 1 v 1.
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(savage(g).ready).toBe(false);
  });
});
