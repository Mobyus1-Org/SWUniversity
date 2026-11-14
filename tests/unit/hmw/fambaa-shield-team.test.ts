import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_080 Fambaa Shield Team (4/7 Ground, cost 7, Vigilance/Heroism) —
//   "When Played: Give a Shield token to each friendly ground unit without a Shield token on it."
//
// Itself included (it is a friendly ground unit with no Shield). Space units, enemy units, and
// friendly units that already hold a Shield are all left alone.

const FAMBAA = Cards.units.hmw.fambaaShieldTeam;
const MARINE = Cards.units.sor.battlefieldMarine;
const XWING = Cards.units.token.xWing;
const SHIELD = Cards.upgrades.token.shield;

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });
const shields = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === SHIELD).length;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance/Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, FAMBAA)
    .WithActivePlayer(1);
}

describe("HMW_080 Fambaa Shield Team", () => {
  it("shields each friendly ground unit without one, itself included", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    const ground = g.state.player1.groundArena;
    expect(ground.map(u => u.cardId)).toEqual([MARINE, FAMBAA]);
    expect(ground.map(shields)).toEqual([1, 1]);
  });

  it("skips a friendly unit that already has a Shield (no second Shield)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(SHIELD, 1)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(shields(g.state.player1.groundArena[0])).toBe(1);
  });

  it("leaves friendly SPACE units and ENEMY units alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, XWING)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(shields(g.state.player1.spaceArena[0])).toBe(0);
    expect(shields(g.state.player2.groundArena[0])).toBe(0);
  });
});
