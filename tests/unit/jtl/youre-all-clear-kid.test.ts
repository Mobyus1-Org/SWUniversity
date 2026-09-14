import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_055 You're All Clear, Kid (Event, cost 2, Vigilance/Heroism)
//   "Defeat an enemy space unit with 3 or less remaining HP. If you do and an opponent controls no
//    space units, you may give an Experience token to a unit."

const EVENT = Cards.events.jtl.youreAllClearKid;
const TIE = Cards.units.sor.tieLnFighter;              // 2/1 Space
const BIG = Cards.units.lof.hyperspaceWayfarer;        // 4/10 Space
const AMBUSH = Cards.units.jtl.tieAmbushSquadron;      // 2/3 Space, When Defeated: create a TIE Fighter
const MARINE = Cards.units.sor.battlefieldMarine;
const XP = Cards.upgrades.token.experience;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, EVENT)
    .WithGroundUnitForPlayer(1, MARINE);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds ?? [];
const xp = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

describe("JTL_055 You're All Clear, Kid", () => {
  it("defeats the last enemy space unit, then may give an Experience token to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, TIE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    expect(g.state.player2.spaceArena).toHaveLength(0);

    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    expect(xp(g.state.player1.groundArena[0])).toBe(1);
  });

  it("the Experience token is optional", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, TIE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(xp(g.state.player1.groundArena[0])).toBe(0);
  });

  it("offers only ENEMY SPACE units with 3 or less remaining HP — damage counts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(2, TIE)
        .WithSpaceUnitForPlayer(2, BIG)            // 10 HP — no
        .WithSpaceUnitForPlayer(2, BIG, true, 7)   // 3 remaining — yes
        .WithSpaceUnitForPlayer(1, TIE)            // friendly — no
        .WithGroundUnitForPlayer(2, MARINE)        // ground — no
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect([...offer(g)].sort()).toEqual([g.state.player2.spaceArena[0].playId, g.state.player2.spaceArena[2].playId].sort());
  });

  it("another enemy space unit left — no Experience offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, TIE).WithSpaceUnitForPlayer(2, BIG).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena.map(u => u.cardId)).toEqual([BIG]);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("a token made by the defeated unit's own When Defeated doesn't cost you the Experience", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, AMBUSH).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    expect(xp(g.state.player1.groundArena[0])).toBe(1);
  });

  it("no legal target — nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, BIG).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.spaceArena).toHaveLength(1);
  });
});
