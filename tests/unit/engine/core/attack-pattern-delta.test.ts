import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

describe("SOR_106 Attack Pattern Delta", () => {
  it("test 1: happy path — 3 units available, pick all 3 in sequence", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.events.sor.attackPatternDelta)
      .Build();
    g.loadNewState(state);

    const [a, b, c] = g.state.player1.groundArena.map(u => u.playId);

    await g.playCardFromHandAsync(1, 0);
    // Step 1: pick unit A (+3/+3)
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [a] });
    // Step 2: pick unit B (+2/+2)
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [b] });
    // Step 3: pick unit C (+1/+1)
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [c] });

    expect(g.state.currentEffects.find(e => e.cardId === "SOR_106_3" && e.targetPlayId === a)).toBeDefined();
    expect(g.state.currentEffects.find(e => e.cardId === "SOR_106_2" && e.targetPlayId === b)).toBeDefined();
    expect(g.state.currentEffects.find(e => e.cardId === "SOR_106_1" && e.targetPlayId === c)).toBeDefined();
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("test 2: already-picked units excluded from subsequent steps", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.events.sor.attackPatternDelta)
      .Build();
    g.loadNewState(state);

    const [a, b, c] = g.state.player1.groundArena.map(u => u.playId);

    await g.playCardFromHandAsync(1, 0);
    // After picking A, the step-2 prompt should NOT offer A as a valid target
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [a] });

    // Trying to re-pick A in step 2 should be rejected
    const badPick = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [a] });
    expect(badPick.lastDispatchResponse?.invalidAction).toBe(true);

    // Pick B instead
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [b] });
    // Pick C
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [c] });

    expect(g.state.currentEffects.find(e => e.cardId === "SOR_106_3" && e.targetPlayId === a)).toBeDefined();
    expect(g.state.currentEffects.find(e => e.cardId === "SOR_106_2" && e.targetPlayId === b)).toBeDefined();
    expect(g.state.currentEffects.find(e => e.cardId === "SOR_106_1" && e.targetPlayId === c)).toBeDefined();
  });

  it("test 3: exactly 2 units — steps 1 and 2 fire, step 3 fizzles", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.events.sor.attackPatternDelta)
      .Build();
    g.loadNewState(state);

    const [a, b] = g.state.player1.groundArena.map(u => u.playId);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [a] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [b] });

    expect(g.state.currentEffects.find(e => e.cardId === "SOR_106_3" && e.targetPlayId === a)).toBeDefined();
    expect(g.state.currentEffects.find(e => e.cardId === "SOR_106_2" && e.targetPlayId === b)).toBeDefined();
    expect(g.state.currentEffects.find(e => e.cardId === "SOR_106_1")).toBeUndefined();
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("test 4: exactly 1 unit — only step 1 fires", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.events.sor.attackPatternDelta)
      .Build();
    g.loadNewState(state);

    const [a] = g.state.player1.groundArena.map(u => u.playId);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [a] });

    expect(g.state.currentEffects.find(e => e.cardId === "SOR_106_3" && e.targetPlayId === a)).toBeDefined();
    expect(g.state.currentEffects.find(e => e.cardId === "SOR_106_2")).toBeUndefined();
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("test 5: 0 friendly units — event resolves immediately with no pending", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.events.sor.attackPatternDelta)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
    expect(g.state.currentEffects.find(e => e.cardId === "SOR_106_3")).toBeUndefined();
  });

  it("test 6: Phase effects for all three buff levels are scoped by targetPlayId", async () => {
    // Each effect has the correct cardId and duration
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.events.sor.attackPatternDelta)
      .Build();
    g.loadNewState(state);

    const [a, b, c] = g.state.player1.groundArena.map(u => u.playId);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [a] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [b] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [c] });

    const eff3 = g.state.currentEffects.find(e => e.cardId === "SOR_106_3");
    const eff2 = g.state.currentEffects.find(e => e.cardId === "SOR_106_2");
    const eff1 = g.state.currentEffects.find(e => e.cardId === "SOR_106_1");

    expect(eff3?.duration).toBe("Phase");
    expect(eff3?.targetPlayId).toBe(a);
    expect(eff2?.duration).toBe("Phase");
    expect(eff2?.targetPlayId).toBe(b);
    expect(eff1?.duration).toBe("Phase");
    expect(eff1?.targetPlayId).toBe(c);
  });
});
