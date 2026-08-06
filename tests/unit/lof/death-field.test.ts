import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_141 Death Field (Event, cost 4, Aggression/Villainy, Force) —
//   "Deal 2 damage to each non-Vehicle enemy unit. If you control a Force unit, draw a card."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce)
    .WithCardInHandForPlayer(1, Cards.events.lof.deathField);
}

describe("LOF_141 Death Field", () => {
  it("deals 2 damage to each non-Vehicle enemy unit in both arenas", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 non-Vehicle ground
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // 4/10 Creature, non-Vehicle space
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player2.spaceArena[0].damage).toBe(2);
  });

  it("leaves enemy Vehicle units untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(2, Cards.units.jtl.phoenixSquadronAWing) // 3/2 Vehicle
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // non-Vehicle
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(0); // Vehicle — spared
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("leaves FRIENDLY units untouched — 'each non-Vehicle ENEMY unit'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("defeats enemy units the 2 damage is lethal to", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sec.sithAssassin) // 3/2 — dies
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 — survives
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.groundArena.length).toBe(1);
    expect(g.state.player2.groundArena[0].cardId).toBe(Cards.units.sor.consularSecurityForce);
  });

  it("draws a card while you control a Force unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sec.sithAssassin) // Force/Sith
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    const handBefore = g.state.player1.hand.length;
    await g.playCardFromHandAsync(1, 0);

    // Death Field left the hand (-1) and the draw put a card back (+1).
    expect(g.state.player1.hand.length).toBe(handBefore);
    expect(g.state.player1.hand[0].cardId).toBe(Cards.units.sor.consularSecurityForce);
  });

  it("control: no draw without a friendly Force unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel/Trooper — not Force
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    const handBefore = g.state.player1.hand.length;
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.length).toBe(handBefore - 1); // only Death Field left the hand
    expect(g.state.player2.groundArena[0].damage).toBe(2); // the damage still happened
  });

  it("an ENEMY Force unit does not enable the draw — 'you control'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sec.sithAssassin) // enemy Force unit
        .Build(),
    );

    const handBefore = g.state.player1.hand.length;
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.length).toBe(handBefore - 1);
  });

  it("resolves with no enemy units in play and still draws off a friendly Force unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sec.sithAssassin)
        .Build(),
    );

    const handBefore = g.state.player1.hand.length;
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.length).toBe(handBefore);
  });
});
