import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_062 Silver Angel — Trace's Hope (Unit 2/3 Space, cost 2, Vigilance)
//   "When 1 or more damage is healed from this unit: You may deal 1 damage to a space unit."
//
// Every unit heal goes through one function, so this fires whatever healed it.

const ANGEL = Cards.units.jtl.silverAngel;
const WAYFARER = Cards.units.lof.hyperspaceWayfarer; // 4/10 Space
const MARINE = Cards.units.sor.battlefieldMarine;

function setup(angelDamage: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, Cards.events.ibh.recovery)
    .WithSpaceUnitForPlayer(1, ANGEL, true, angelDamage)
    .WithSpaceUnitForPlayer(2, WAYFARER)
    .WithGroundUnitForPlayer(2, MARINE);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];

describe("JTL_062 Silver Angel", () => {
  it("healed → may deal 1 damage to a space unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(2).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0); // Recovery heals the Angel
    expect(g.state.player1.spaceArena[0].damage).toBe(0);

    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);
    expect(g.state.player2.spaceArena[0].damage).toBe(1);
  });

  it("healing 2 still deals just 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(2).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(1);
  });

  it("offers only SPACE units — itself included", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(1).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseYesAsync(1);

    expect([...offer(g)].sort()).toEqual([g.state.player1.spaceArena[0].playId, g.state.player2.spaceArena[0].playId].sort());
  });

  it("declining deals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(1).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });

  it("healing an undamaged Silver Angel heals 0 — no trigger", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(0).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("fires from other heal sources too — Home One heals every friendly unit", async () => {
    const g = new GameTestAdapter();
    const state = setup(2).WithCardInHandForPlayer(1, Cards.units.ash.homeOne).Build();
    state.player1.hand = [{ cardId: Cards.units.ash.homeOne }];
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena.find(u => u.cardId === ANGEL)!.damage).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);
    expect(g.state.player2.spaceArena[0].damage).toBe(1);
  });

  it("control: healing a different unit doesn't trigger it", async () => {
    const g = new GameTestAdapter();
    const state = setup(2).WithGroundUnitForPlayer(1, MARINE, true, 2).Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
