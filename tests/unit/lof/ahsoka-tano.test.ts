import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { Cards } from "../../card-helpers";

// LOF_003 Ahsoka Tano — Fighting For Peace (Leader)
// Front:  Action [Exhaust, use the Force (lose your Force token)]: Give a friendly unit Sentinel this phase.
//         Epic Action: If you control 6 or more resources, deploy this leader.
// Deployed: On Attack: You may give a friendly unit Sentinel for this phase.

describe("LOF_003 Ahsoka Tano — front side", () => {
  it("Action [Exhaust, use the Force]: gives a friendly unit Sentinel, spends the Force, exhausts the leader", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.ahsokaTano)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.leaders.lof.ahsokaTano });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(HasSentinel(Cards.units.sor.battlefieldMarine, marinePlayId, 1)).toBe(true);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.roundState.forceUsedThisPhase).toBe(1);
  });

  it("Action is unavailable without the Force", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.ahsokaTano)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state); // no Force token

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.leaders.lof.ahsokaTano });

    expect(g.state.player1.leader.ready).toBe(true); // ability not usable
    expect(HasSentinel(Cards.units.sor.battlefieldMarine, state.player1.groundArena[0].playId, 1)).toBe(false);
  });

  it("Epic Action: deploys when you control 6 resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.ahsokaTano)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
  });

  it("Epic Action: does not deploy with fewer than 6 resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.ahsokaTano)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(false);
  });
});

describe("LOF_003 Ahsoka Tano — deployed side", () => {
  async function deployAhsokaWithAlly(): Promise<{ g: GameTestAdapter; ahsokaPlayId: string; marinePlayId: string }> {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.ahsokaTano)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1; // deploying handed the turn to the opponent; drive P1's attack next
    const ahsoka = g.state.player1.groundArena.find(u => u.cardId === Cards.leaders.lof.ahsokaTano)!;
    const marine = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    return { g, ahsokaPlayId: ahsoka.playId, marinePlayId: marine.playId };
  }

  it("On Attack: may give a friendly unit Sentinel for this phase (accept)", async () => {
    const { g, ahsokaPlayId, marinePlayId } = await deployAhsokaWithAlly();

    await g.dispatchAsync(1, "initiate-attack", { playId: ahsokaPlayId });
    await g.chooseBaseAsync(1, 2); // attack the enemy base
    await g.chooseYesAsync(1); // On Attack: give Sentinel?
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(HasSentinel(Cards.units.sor.battlefieldMarine, marinePlayId, 1)).toBe(true);
  });

  it("On Attack: may decline (no Sentinel granted)", async () => {
    const { g, ahsokaPlayId, marinePlayId } = await deployAhsokaWithAlly();

    await g.dispatchAsync(1, "initiate-attack", { playId: ahsokaPlayId });
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1); // decline

    expect(HasSentinel(Cards.units.sor.battlefieldMarine, marinePlayId, 1)).toBe(false);
  });
});
