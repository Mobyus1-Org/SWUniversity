import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_117 Reputable Hunter (3/4 Ground, cost 3) —
//   "If an enemy unit has a Bounty, this unit costs 1 resource less to play."
describe("SHD_117 Reputable Hunter", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana) // Command — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("costs its printed 3 when no enemy unit has a Bounty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // no Bounty
        .WithCardInHandForPlayer(1, Cards.units.shd.reputableHunter)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(3);
  });

  it("costs 1 less when an enemy unit has a Bounty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithGroundUnitForPlayer(2, Cards.units.shd.hylobonEnforcer) // printed Bounty
        .WithCardInHandForPlayer(1, Cards.units.shd.reputableHunter)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(2);
  });

  it("a Bounty on a FRIENDLY unit does not discount it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithGroundUnitForPlayer(1, Cards.units.shd.hylobonEnforcer) // Bounty, but mine
        .WithCardInHandForPlayer(1, Cards.units.shd.reputableHunter)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(3);
  });

  it("counts a Bounty granted by an upgrade on an enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.shd.wanted, playId: "@", owner: 1, controller: 1 },
        ])
        .WithCardInHandForPlayer(1, Cards.units.shd.reputableHunter)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(2);
  });

  it("is playable with only 2 resources while an enemy Bounty is out", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
        .WithGroundUnitForPlayer(2, Cards.units.shd.hylobonEnforcer)
        .WithCardInHandForPlayer(1, Cards.units.shd.reputableHunter)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.shd.reputableHunter)).toBe(true);
  });
});
