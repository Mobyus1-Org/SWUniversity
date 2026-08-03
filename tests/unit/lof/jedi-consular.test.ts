import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// LOF_094 Jedi Consular (1/4 Ground, cost 2) —
//   "Action [Exhaust, use the Force (lose your Force token)]: Play a unit from your hand.
//    It costs 2 resources less."
describe("LOF_094 Jedi Consular", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  const useAbility = (g: GameTestAdapter) =>
    g.dispatchAsync(1, "use-ability", {
      cardId: Cards.units.lof.jediConsular,
      playId: g.state.player1.groundArena[0].playId,
    });

  it("spends the Force, exhausts, and plays a hand unit for 2 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.lof.jediConsular)
        .WithCardInHandForPlayer(1, Cards.units.sor.echoBaseDefender) // cost 3 → 1
        .Build(),
    );
    g.state.player1.supplemental.forceToken = true;

    await useAbility(g);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.echoBaseDefender)).toBe(true);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(1); // 3 - 2
    expect(g.state.player1.supplemental.forceToken).toBe(false);
    expect(g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.jediConsular)!.ready).toBe(false);
  });

  it("is unavailable without a Force token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.lof.jediConsular)
        .WithCardInHandForPlayer(1, Cards.units.sor.echoBaseDefender)
        .Build(),
    );

    await useAbility(g);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("is unavailable with no unit in hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.lof.jediConsular)
        .WithCardInHandForPlayer(1, Cards.events.shd.daringRaid) // an Event, not a unit
        .Build(),
    );
    g.state.player1.supplemental.forceToken = true;

    await useAbility(g);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("rejects choosing a non-unit card from hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.lof.jediConsular)
        .WithCardInHandForPlayer(1, Cards.units.sor.echoBaseDefender)
        .WithCardInHandForPlayer(1, Cards.events.shd.daringRaid)
        .Build(),
    );
    g.state.player1.supplemental.forceToken = true;

    await useAbility(g);
    await g.chooseCardFromHandAsync(1, 1); // Daring Raid

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("a unit costing 2 or less becomes free", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.lof.jediConsular)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2 → 0
        .Build(),
    );
    g.state.player1.supplemental.forceToken = true;

    await useAbility(g);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(0);
    expect(g.state.player1.groundArena.filter(u => u.cardId === Cards.units.sor.battlefieldMarine).length).toBe(1);
  });

  it("is unavailable while he is exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.lof.jediConsular, false)
        .WithCardInHandForPlayer(1, Cards.units.sor.echoBaseDefender)
        .Build(),
    );
    g.state.player1.supplemental.forceToken = true;

    await useAbility(g);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });
});
