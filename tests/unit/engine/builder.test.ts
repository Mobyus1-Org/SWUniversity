import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";

describe("GameStateBuilder", () => {
  function buildState() {
    return new GameStateBuilder()
      .WithActivePlayer(1)
      .WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 23)
      .MyLeader("SOR_014")
      .TheirBase("SOR_025", 11)
      .TheirLeader("SHD_014", true, false, true)
      .FillResourcesForPlayer(1, "SHD_160", 8)
      .WithCardInHandForPlayer(1, "JTL_153")
      .WithCardInHandForPlayer(1, "SOR_168")
      .WithCardInHandForPlayer(1, "SOR_103")
      .WithCardInHandForPlayer(1, "SOR_141")
      .WithCardInHandForPlayer(1, "SOR_150")
      .WithGroundUnitForPlayer(1, "SOR_145")
      .WithGroundUnitForPlayer(1, "SHD_160")
      .WithGroundUnitForPlayer(2, "SOR_211", false)
      .WithGroundUnitForPlayer(2, "TWI_187", false)
      .WithCurrentRoundBeing(7)
      .WithInitiativePlayerBeing(2)
      .WithInitiativeClaimed()
      .Build()
    ;
  }

  it("produces the correct base damage values", () => {
    const g = new GameTestAdapter(false);
    g.loadNewState(buildState());
    expect(g.state.player1.base.damage).toBe(23);
    expect(g.state.player2.base.damage).toBe(11);
  });

  it("produces the correct leader state", () => {
    const g = new GameTestAdapter(false);
    g.loadNewState(buildState());
    expect(g.state.player1.leader.cardId).toBe("SOR_014");
    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.state.player1.leader.epicActionUsed).toBe(false);
    expect(g.state.player2.leader.cardId).toBe("SHD_014");
    expect(g.state.player2.leader.epicActionUsed).toBe(true);
  });

  it("assigns sequential playIds starting from 1", () => {
    const g = new GameTestAdapter(false);
    g.loadNewState(buildState());
    // P1 ground units are the first two in-play cards to be hydrated
    expect(g.state.player1.groundArena[0].playId).toBe("1");
    expect(g.state.player1.groundArena[1].playId).toBe("2");
  });

  it("produces 8 ready resources for player 1", () => {
    const g = new GameTestAdapter(false);
    g.loadNewState(buildState());
    expect(g.state.player1.resources).toHaveLength(8);
    expect(g.state.player1.resources.every((r) => r.ready)).toBe(true);
  });

  it("produces the correct hand for player 1", () => {
    const g = new GameTestAdapter(false);
    g.loadNewState(buildState());
    const cardIds = g.state.player1.hand.map((c) => c.cardId);
    expect(cardIds).toEqual(["JTL_153", "SOR_168", "SOR_103", "SOR_141", "SOR_150"]);
  });

  it("produces 2 exhausted ground units for player 2", () => {
    const g = new GameTestAdapter(false);
    g.loadNewState(buildState());
    expect(g.state.player2.groundArena).toHaveLength(2);
    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(g.state.player2.groundArena[1].ready).toBe(false);
  });

  it("sets initiative and round correctly", () => {
    const g = new GameTestAdapter(false);
    g.loadNewState(buildState());
    expect(g.state.initiativeClaimed).toBe(true);
    expect(g.state.initiativePlayer).toBe(2);
    expect(g.state.currentRound).toBe(7);
  });
});
