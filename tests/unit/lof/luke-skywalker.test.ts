import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_249 Luke Skywalker — A Hero's Beginning (3/5 Ground, Force/Fringe, Heroism, unique)
// "When you play another unique unit: You may use the Force (lose your Force token).
//  If you do, give an Experience token and a Shield token to this unit."

const EXPERIENCE = "SOR_T01";
const SHIELD = "SOR_T02";

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithGroundUnitForPlayer(1, Cards.units.lof.lukeSkywalker);
}

function luke(g: GameTestAdapter) {
  return g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.lukeSkywalker)!;
}

describe("LOF_249 Luke Skywalker — A Hero's Beginning", () => {
  it("when you play another unique unit and use the Force: Luke gains an Experience and a Shield token", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.units.lof.gungi) // a unique unit
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    const l = luke(g);
    expect(l.upgrades.filter(u => u.cardId === EXPERIENCE)).toHaveLength(1);
    expect(l.upgrades.filter(u => u.cardId === SHIELD)).toHaveLength(1);
    expect(g.state.player1.supplemental.forceToken).toBe(false); // Force was used
  });

  it("declining does not use the Force and gives no tokens", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.units.lof.gungi)
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    const l = luke(g);
    expect(l.upgrades.filter(u => u.cardId === EXPERIENCE)).toHaveLength(0);
    expect(l.upgrades.filter(u => u.cardId === SHIELD)).toHaveLength(0);
    expect(g.state.player1.supplemental.forceToken).toBe(true); // Force retained
  });

  it("does nothing (no prompt) when you have no Force token", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.units.lof.gungi)
      .Build();
    state.player1.supplemental.forceToken = false; // no token → "may use the Force" is unpayable
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded).toBeFalsy();

    const l = luke(g);
    expect(l.upgrades.filter(u => u.cardId === EXPERIENCE)).toHaveLength(0);
    expect(l.upgrades.filter(u => u.cardId === SHIELD)).toHaveLength(0);
  });

  it("does not trigger when you play a NON-unique unit", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // non-unique
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded).toBeFalsy();

    const l = luke(g);
    expect(l.upgrades.filter(u => u.cardId === EXPERIENCE)).toHaveLength(0);
    expect(l.upgrades.filter(u => u.cardId === SHIELD)).toHaveLength(0);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("does not trigger on Luke's own entry (only 'another' unique unit)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.units.lof.lukeSkywalker) // Luke himself, played from hand
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded).toBeFalsy();

    const l = luke(g);
    expect(l.upgrades.filter(u => u.cardId === EXPERIENCE)).toHaveLength(0);
    expect(l.upgrades.filter(u => u.cardId === SHIELD)).toHaveLength(0);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });
});
