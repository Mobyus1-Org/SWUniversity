import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Hardening TWI_016 Jango Fett — "When a friendly unit deals damage to an enemy unit: You may
// exhaust this leader (deployed: no cost). If you do, exhaust that enemy unit."
//
// These combos exercise ABILITY damage (When Played), not combat: a friendly unit dealing damage
// to an enemy unit via a card ability must also trigger Jango's reaction.
//   JTL_170 War Juggernaut — "When Played: Deal 1 damage to each of any number of units."
//   JTL_140 IG-2000        — "When Played: Deal 1 damage to each of up to 3 units."

describe("TWI_016 Jango Fett + JTL_170 War Juggernaut (ability damage triggers Jango)", () => {
  it("leader side: When Played damage to an enemy → may exhaust Jango to exhaust that enemy", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.jangoFett)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, Cards.units.jtl.warJuggernaut)
        .WithGroundUnitForPlayer(2, Cards.units.sor.steadfastBattalion) // enemy, ready
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithActivePlayer(1)
        .Build(),
    );

    const enemy = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy] }); // War Juggernaut deals 1
    await g.chooseYesAsync(1);                                             // Jango: exhaust it

    const battalion = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.steadfastBattalion)!;
    expect(battalion.damage).toBe(1);
    expect(battalion.ready).toBe(false);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("deployed side: When Played damage to an enemy → may exhaust that enemy (no self-cost)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.jangoFett, true, true, true)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.leaders.twi.jangoFett) // deployed Jango (a friendly unit)
        .WithCardInHandForPlayer(1, Cards.units.jtl.warJuggernaut)
        .WithGroundUnitForPlayer(2, Cards.units.sor.steadfastBattalion) // enemy, ready
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithActivePlayer(1)
        .Build(),
    );

    const enemy = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy] });
    await g.chooseYesAsync(1);

    const battalion = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.steadfastBattalion)!;
    expect(battalion.ready).toBe(false);
  });

  it("does not trigger when the ability damages only a FRIENDLY unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.jangoFett)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, Cards.units.jtl.warJuggernaut)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // friendly target, ready
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithActivePlayer(1)
        .Build(),
    );

    const friendly = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!.playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendly] });

    // No enemy was damaged → no Jango prompt.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("TWI_016 Jango Fett + JTL_140 IG-2000 (ability damage triggers Jango)", () => {
  it("leader side: IG-2000 When Played damage to an enemy → may exhaust Jango to exhaust it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.jangoFett)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, Cards.units.jtl.ig2000)
        .WithGroundUnitForPlayer(2, Cards.units.sor.steadfastBattalion) // enemy, ready
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithActivePlayer(1)
        .Build(),
    );

    const enemy = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy] }); // IG-2000 deals 1
    await g.chooseYesAsync(1);                                             // Jango: exhaust it

    const battalion = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.steadfastBattalion)!;
    expect(battalion.damage).toBe(1);
    expect(battalion.ready).toBe(false);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("deployed side: IG-2000 When Played damage to an enemy → may exhaust that enemy", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.twi.jangoFett, true, true, true)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.leaders.twi.jangoFett) // deployed Jango
        .WithCardInHandForPlayer(1, Cards.units.jtl.ig2000)
        .WithGroundUnitForPlayer(2, Cards.units.sor.steadfastBattalion) // enemy, ready
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithActivePlayer(1)
        .Build(),
    );

    const enemy = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy] });
    await g.chooseYesAsync(1);

    const battalion = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.steadfastBattalion)!;
    expect(battalion.ready).toBe(false);
  });
});
