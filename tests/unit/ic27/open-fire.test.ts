import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_136 Open Fire (Event, cost 3, Aggression, Tactic) — reprint of SOR_172.
//   "Deal 4 damage to a unit."

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
    .WithCardInHandForPlayer(1, Cards.events.ic27.openFire);
}

describe("IC27_136 Open Fire", () => {
  it("deals 4 damage to the chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4);
  });

  it("can hit a friendly unit — 'a unit' is unqualified", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(4);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
