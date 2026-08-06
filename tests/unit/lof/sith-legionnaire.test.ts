import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// LOF_081 Sith Legionnaire (2/2 Ground, cost 2, Command/Villainy, Sith/Trooper) —
//   "While you control another Villainy unit, this unit gets +2/+0."
describe("LOF_081 Sith Legionnaire", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren);
  }

  const legionnaire = (g: GameTestAdapter) =>
    Unit.FromInterface(g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.sithLegionnaire)!);

  it("is a plain 2/2 with no other friendly unit — it does not count itself", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.lof.sithLegionnaire).Build());

    expect(legionnaire(g).CurrentPower()).toBe(2);
    expect(legionnaire(g).TotalHP()).toBe(2);
  });

  it("gets +2/+0 while another friendly Villainy unit is in play", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.lof.sithLegionnaire)
        .WithGroundUnitForPlayer(1, Cards.units.sec.sithAssassin) // Villainy
        .Build(),
    );

    expect(legionnaire(g).CurrentPower()).toBe(4);
    expect(legionnaire(g).TotalHP()).toBe(2); // +2/+0 — HP must not move
  });

  it("counts a friendly Villainy unit in the other arena", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.lof.sithLegionnaire)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter) // Villainy, Space
        .Build(),
    );

    expect(legionnaire(g).CurrentPower()).toBe(4);
  });

  it("is a while-condition, not per-unit — two other Villainy units still give +2", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.lof.sithLegionnaire)
        .WithGroundUnitForPlayer(1, Cards.units.sec.sithAssassin)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    expect(legionnaire(g).CurrentPower()).toBe(4);
  });

  it("control: another friendly NON-Villainy unit gives nothing", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.lof.sithLegionnaire)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Command/Heroism
        .Build(),
    );

    expect(legionnaire(g).CurrentPower()).toBe(2);
  });

  it("control: an ENEMY Villainy unit gives nothing — 'you control'", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.lof.sithLegionnaire)
        .WithGroundUnitForPlayer(2, Cards.units.sec.sithAssassin)
        .Build(),
    );

    expect(legionnaire(g).CurrentPower()).toBe(2);
  });

  it("loses the bonus while it has lost all abilities", () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.lof.sithLegionnaire)
      .WithGroundUnitForPlayer(1, Cards.units.sec.sithAssassin)
      .Build();
    // Force Lightning — "loses all abilities for this phase".
    state.currentEffects.push({
      cardId: "SOR_138",
      duration: "Phase",
      affectedPlayer: 1,
      targetPlayId: state.player1.groundArena[0].playId,
    });
    g.loadNewState(state);

    expect(legionnaire(g).CurrentPower()).toBe(2);
  });
});
