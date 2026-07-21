import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// ASH_226 Qi'ra — Master of Teräs Käsi (9/7 Ground, cost 7)
// "This unit gets –1/–0 for each card in your hand."
// "When Played: You may discard a card from your hand. If you do, deal 3 damage to a unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

describe("ASH_226 Qi'ra", () => {
  it("is full 9 power with an empty hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.qira)
        .Build(),
    );

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(9);
  });

  it("gets –1/–0 for each card in its controller's hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.qira)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(6);
  });

  it("counts only its controller's hand, not the opponent's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.qira)
        .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(9);
  });

  it("does not go below 0 power with a huge hand", async () => {
    const g = new GameTestAdapter();
    const builder = baseSetup().WithGroundUnitForPlayer(1, Cards.units.ash.qira);
    for (let i = 0; i < 12; i++) builder.WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine);
    g.loadNewState(builder.Build());

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(0);
  });

  it("When Played: discards a card and deals 3 damage to a chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.qira)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0); // discard the Marine
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("may decline — nothing is discarded and no damage is dealt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.qira)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("does not prompt when its controller's hand is empty after playing her", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.qira)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
