import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { PlayerId } from "@/lib/engine/core-models";
import { Cards } from "../../card-helpers";

// SHD_101 Adelphi Patrol Wing (Unit 4/6 Space, cost 5, Command/Heroism)
//   "When Played: You may attack with a unit. If you have the initiative, it gets +2/+0 for this
//    attack."

const ADELPHI = Cards.units.shd.adelphiPatrolWing;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Ground

function setup(initiative: PlayerId) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism — no aspect penalty
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithInitiativePlayerBeing(initiative)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, ADELPHI)
    .WithGroundUnitForPlayer(1, MARINE);
}

describe("SHD_101 Adelphi Patrol Wing", () => {
  it("with the initiative, the chosen unit attacks with +2/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(1).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5); // 3 + 2
  });

  it("without the initiative, the attack happens with no bonus", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(2).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("the +2/+0 lasts only for that attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(1).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.currentEffects.some(e => e.duration === "ForAttack")).toBe(false);
  });

  it("offers only ready friendly units — Adelphi itself enters exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(1)
        .WithGroundUnitForPlayer(1, MARINE, false) // exhausted — can't attack
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toEqual([g.state.player1.groundArena[0].playId]);
  });

  it("declining makes no attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(1).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy(); // the Yes/No offer is live
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("no offer when there is no ready unit to attack with", async () => {
    const g = new GameTestAdapter();
    const state = setup(1).Build();
    state.player1.groundArena[0].ready = false;
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
