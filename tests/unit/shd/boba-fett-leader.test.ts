import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { NeedsOption } from "@/lib/engine/message-types";

describe("SHD_008 Boba Fett — Leader Trigger", () => {
  it("test 1: happy path — play keyword unit, choose Yes, pick unit → leader exhausted, Phase effect applied", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // leader-reaction fires as ability-option
    const res1 = g.lastDispatchResponse!.resolutionNeeded as NeedsOption;
    expect(res1.type).toBe("Option");
    expect(res1.helperText).toContain("Boba Fett");

    await g.chooseYesAsync(1);

    // ability-target: pick the unit we just played (System Patrol Craft is a Space unit)
    const unitPlayId = g.state.player1.spaceArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [unitPlayId] });

    expect(g.state.player1.leader.ready).toBe(false);
    const effect = g.state.currentEffects.find(e => e.cardId === "SHD_008" && e.targetPlayId === unitPlayId);
    expect(effect).toBeDefined();
    expect(effect?.duration).toBe("Phase");
  });

  it("test 2: choose No — leader stays ready, no Phase effect", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.state.currentEffects.find(e => e.cardId === "SHD_008")).toBeUndefined();
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("test 3: non-keyword unit played — no trigger fires", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("test 4: leader already exhausted — no trigger fires", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.bobaFett, false) // ready=false → pre-exhausted
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
  });

  it("test 5: leader deployed — no trigger fires", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.bobaFett, true, true) // ready=true, deployed=true
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
  });

  it("test 7: buffed unit deals +1 damage when attacking", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithInitiativePlayerBeing(2)
      .WithInitiativeClaimed() // P2 auto-passes so P1 retains priority after playing SPC
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3, ready
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0); // System Patrol Craft triggers Boba
    await g.chooseYesAsync(1);

    // buff the pre-placed Battlefield Marine (+1/+0 → 4 power)
    const bfmPlayId = g.state.player1.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [bfmPlayId] });

    // BFM attacks P2 base (no P2 units) — should deal 4 damage (3 base + 1 buff)
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4);
    expect(g.state.player1.leader.ready).toBe(false); // leader exhausted by the trigger
  });

  it("test 6: Ambush unit played — trigger-order prompt (leader-reaction + ambush both queue)", async () => {
    // SOR_213 (Syndicate Lackeys) has native Ambush, which is itself a keyword.
    // Playing it queues both an "ambush" trigger and a "leader-reaction" trigger → trigger-order.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.syndicateLackeys)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    const res6 = g.lastDispatchResponse!.resolutionNeeded as NeedsOption;
    expect(res6.type).toBe("Option");
    expect(res6.helperText).toContain("Choose which trigger");
  });
});
