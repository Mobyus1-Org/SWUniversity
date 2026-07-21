import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// ASH_T01 Mandalorian token (2/2 Ground) — created by ASH_140 Stronger Together, ASH_257 Choose
// Your Path, etc.
//
// A token is not a card: it can never go to a hand, a discard pile, or be held captive — it is
// set aside instead (CR 7.6.1 / 8.33). This pins that ASH_T01 is treated as a token everywhere,
// alongside the older TWI/JTL/SEC tokens.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

describe("ASH_T01 Mandalorian token", () => {
  it("is recognised as a token unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup().WithGroundUnitForPlayer(1, Cards.units.token.mandalorian).Build(),
    );

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).IsTokenUnit()).toBe(true);
  });

  it("is set aside rather than returned to hand when bounced by Waylay", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.sor.waylay)
        .WithGroundUnitForPlayer(1, Cards.units.token.mandalorian)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand).toHaveLength(0);   // never becomes a card in hand
    expect(g.state.player1.discard).toHaveLength(1); // only Waylay itself
    expect(g.state.player1.discard[0].cardId).toBe(Cards.events.sor.waylay);
  });

  it("is set aside rather than held captive by Take Captive", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.twi.takeCaptive)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)   // the captor
        .WithGroundUnitForPlayer(2, Cards.units.token.mandalorian)       // the token victim
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // captor
    await g.chooseGroundUnitAsync(2, 0); // victim

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].captives).toHaveLength(0); // not held under the captor
    expect(g.state.player2.discard).toHaveLength(0);                 // and not in a discard pile
  });

  it("captures a NON-token unit normally (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.twi.takeCaptive)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].captives).toHaveLength(1);
    expect(g.state.player1.groundArena[0].captives[0].cardId).toBe(Cards.units.sor.consularSecurityForce);
  });

  it("goes nowhere near the discard pile when defeated in combat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // 3 power
        .WithGroundUnitForPlayer(2, Cards.units.token.mandalorian, true, 1) // 2/2 with 1 damage
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.discard).toHaveLength(0);
  });

  it("is recorded as token-defeated, not defeated, when it leaves play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(2, Cards.units.token.mandalorian, true, 1)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const left = g.state.roundState.cardsLeftPlayThisPhase.find(c => c.cardId === Cards.units.token.mandalorian);
    expect(left?.reason).toBe("token-defeated");
  });
});
