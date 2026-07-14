import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_193 Grand Admiral Thrawn — Grand Schemer (8/7 Ground, cost 7)
// "When Played: An opponent may choose a non-leader unit they control. If they do, this unit
//  captures that unit. If they don't, ready this unit."
// "When Defeated: A friendly unit captures an enemy non-leader unit in the same arena."

function thrawn(g: GameTestAdapter) {
  return g.state.player1.groundArena.find(u => u.cardId === Cards.units.sec.grandAdmiralThrawn);
}

function playSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.units.sec.grandAdmiralThrawn);
}

describe("SEC_193 Grand Admiral Thrawn — When Played", () => {
  it("captures the unit the opponent chooses", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(playSetup().WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build());

    await g.playCardFromHandAsync(1, 0);
    // The OPPONENT decides, and chooses one of their own units.
    await g.chooseYesAsync(2);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0); // captured, out of play
    expect(thrawn(g)!.captives).toHaveLength(1);
    expect(thrawn(g)!.captives[0].cardId).toBe(Cards.units.sor.battlefieldMarine);
    expect(thrawn(g)!.ready).toBe(false); // no capture-decline, so no ready
  });

  it("readies Thrawn when the opponent declines", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(playSetup().WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build());

    const played = await g.playCardFromHandAsync(1, 0);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(2);

    expect(g.state.player2.groundArena).toHaveLength(1); // nothing captured
    expect(thrawn(g)!.captives).toHaveLength(0);
    expect(thrawn(g)!.ready).toBe(true); // "If they don't, ready this unit."
  });

  it("readies Thrawn when the opponent controls no non-leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(playSetup().Build()); // opponent has no units at all

    await g.playCardFromHandAsync(1, 0);

    expect(thrawn(g)!.ready).toBe(true);
    expect(thrawn(g)!.captives).toHaveLength(0);
  });
});

describe("SEC_193 Grand Admiral Thrawn — When Defeated", () => {
  it("a friendly unit captures an enemy non-leader unit in the same arena", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // Thrawn (8/7) pre-damaged to 5, attacking a 3/3 Marine finishes him off.
      .WithGroundUnitForPlayer(1, Cards.units.sec.grandAdmiralThrawn, true, 5)
      .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler) // the surviving captor
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // trades with Thrawn
      .WithGroundUnitForPlayer(2, Cards.units.law.scavengingSandcrawler) // the capture victim
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // both Thrawn and the Marine die

    // When Defeated: pick the friendly captor, then the enemy unit it captures.
    await g.chooseGroundUnitAsync(1, 0); // friendly Sandcrawler
    await g.chooseGroundUnitAsync(2, 0); // enemy Sandcrawler (the Marine is gone)

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].captives).toHaveLength(1);
  });

  it("does not prompt when there is no enemy non-leader unit to capture", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sec.grandAdmiralThrawn, true, 5)
      .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // the only enemy — it dies in the trade
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    const traded = await g.chooseGroundUnitAsync(2, 0);

    expect(traded.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.groundArena[0].captives).toHaveLength(0);
  });
});
