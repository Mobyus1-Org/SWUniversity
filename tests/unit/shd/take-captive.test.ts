import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_131 Take Captive (Event, cost 3) — a reprint of TWI_128.
//   "A friendly unit captures an enemy non-leader unit in the same arena."
describe("SHD_131 Take Captive", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism — no aspect penalty on a Command event
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("a friendly ground unit captures an enemy ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // captor
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // victim
        .WithCardInHandForPlayer(1, Cards.events.shd.takeCaptiveShd)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // captor
    await g.chooseGroundUnitAsync(2, 0); // victim

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.groundArena[0].captives.length).toBe(1);
    expect(g.state.player1.groundArena[0].captives[0].cardId).toBe(Cards.units.sor.battlefieldMarine);
  });

  it("an EXHAUSTED friendly unit can be the captor — capturing is not an attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, false) // exhausted captor
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.events.shd.takeCaptiveShd)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.groundArena[0].captives.length).toBe(1);
  });

  it("cannot capture across arenas — a ground captor is only offered ground victims", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // ground captor
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)       // enemy is in SPACE
        .WithCardInHandForPlayer(1, Cards.events.shd.takeCaptiveShd)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // captor chosen — no eligible same-arena victim

    expect(g.state.player2.spaceArena.length).toBe(1);
    expect(g.state.player1.groundArena[0].captives.length).toBe(0);
  });

  it("cannot capture an enemy leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .TheirLeader(Cards.leaders.sor.sabineWren, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // captor
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren)      // deployed enemy leader
        .WithCardInHandForPlayer(1, Cards.events.shd.takeCaptiveShd)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // captor chosen — the only enemy is a leader

    expect(g.state.player2.groundArena.length).toBe(1);
    expect(g.state.player1.groundArena[0].captives.length).toBe(0);
  });
});
