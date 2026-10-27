import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { GameState } from "@/lib/engine/game";
import { PlayerId } from "@/lib/engine/core-models";

// HMW_141 Rex — Outserved His Purpose (5/6 Ground, cost 5, Command, Fringe Clone, unique)
// "Friendly units with no abilities get +1/+1."
//
// "No abilities" is read live: a vanilla card qualifies, a card printing any text (a keyword, a
// When Played) does not, and a unit that has LOST all its abilities qualifies again. Tokens on a
// unit are not abilities of the unit — Experience and Shield hosts still qualify. Rex prints text
// himself, so he never boosts himself.
const REX = Cards.units.hmw.rexOutservedHisPurpose;
const VANILLA = Cards.units.hmw.ewokBrigade;          // 2/4, no text
const SENTINEL_ONLY = Cards.units.sor.echoBaseDefender; // 4/3, Sentinel and nothing else
const WHEN_PLAYED = Cards.units.lof.purgeTrooper;     // 4/2, a When Played
const BEAST = Cards.units.token.beast;                // 3/3 token, no text

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
    .WithActivePlayer(1);
}

const unitOf = (g: GameTestAdapter, player: PlayerId, cardId: string) =>
  Unit.FromInterface((player === 1 ? g.state.player1 : g.state.player2).groundArena.find(u => u.cardId === cardId)!);
const stats = (g: GameTestAdapter, player: PlayerId, cardId: string) => {
  const u = unitOf(g, player, cardId);
  return [u.CurrentPower(), u.TotalHP()];
};
const loseAbilities = (state: GameState, playId: string) =>
  state.currentEffects.push({
    cardId: Cards.events.sor.forceLightning,
    duration: "Phase",
    affectedPlayer: 1,
    targetPlayId: playId,
  });

describe("HMW_141 Rex — Outserved His Purpose", () => {
  it("control: a vanilla friendly unit is unchanged without Rex", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, VANILLA).Build());
    expect(stats(g, 1, VANILLA)).toEqual([2, 4]);
  });

  it("gives a friendly unit with no abilities +1/+1", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, REX).WithGroundUnitForPlayer(1, VANILLA).Build());
    expect(stats(g, 1, VANILLA)).toEqual([3, 5]);
  });

  it("the bonus ends once Rex leaves play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, REX)
        .WithGroundUnitForPlayer(1, VANILLA)
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .Build(),
    );
    expect(stats(g, 1, VANILLA)).toEqual([3, 5]);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // Vanquish Rex
    expect(g.state.player1.groundArena.some(u => u.cardId === REX)).toBe(false);
    expect(stats(g, 1, VANILLA)).toEqual([2, 4]);
  });

  it("a unit with a printed keyword gets nothing", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, REX).WithGroundUnitForPlayer(1, SENTINEL_ONLY).Build());
    expect(stats(g, 1, SENTINEL_ONLY)).toEqual([4, 3]);
  });

  it("a unit with a printed When Played gets nothing", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, REX).WithGroundUnitForPlayer(1, WHEN_PLAYED).Build());
    expect(stats(g, 1, WHEN_PLAYED)).toEqual([4, 2]);
  });

  it("a unit that has lost all its abilities qualifies", () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(1, REX).WithGroundUnitForPlayer(1, SENTINEL_ONLY).Build();
    loseAbilities(state, state.player1.groundArena[1].playId);
    g.loadNewState(state);
    expect(stats(g, 1, SENTINEL_ONLY)).toEqual([5, 4]);
  });

  it("an Imprisoned unit (loses its abilities) qualifies", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, REX)
        .WithGroundUnitForPlayer(1, WHEN_PLAYED)
        .WithUpgradesOnGroundUnitForPlayer(1, 1, [GameStateBuilder.Upgrade(Cards.upgrades.shd.imprisoned, 2, 2)])
        .Build(),
    );
    expect(stats(g, 1, WHEN_PLAYED)).toEqual([5, 3]);
  });

  it("enemy units with no abilities get nothing", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, REX).WithGroundUnitForPlayer(2, VANILLA).Build());
    expect(stats(g, 2, VANILLA)).toEqual([2, 4]);
  });

  it("Rex has abilities, so he does not boost himself", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, REX).Build());
    expect(stats(g, 1, REX)).toEqual([5, 6]);
  });

  it("Experience and Shield tokens do not give their host abilities", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, REX)
        .WithGroundUnitForPlayer(1, VANILLA)
        .WithGroundUnitForPlayer(1, Cards.units.hmw.jaxxon)
        .WithUpgradesOnGroundUnitForPlayer(1, 1, [GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1)])
        .WithUpgradesOnGroundUnitForPlayer(1, 2, [GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 1)])
        .Build(),
    );
    expect(stats(g, 1, VANILLA)).toEqual([2 + 1 + 1, 4 + 1 + 1]); // Experience +1/+1, Rex +1/+1
    expect(stats(g, 1, Cards.units.hmw.jaxxon)).toEqual([4, 4]);
  });

  it("a stat-only upgrade (its own When Played is not the host's ability) still qualifies", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, REX)
        .WithGroundUnitForPlayer(1, VANILLA)
        .WithUpgradesOnGroundUnitForPlayer(1, 1, [GameStateBuilder.Upgrade(Cards.upgrades.ash.durasteelPlating, 1)])
        .Build(),
    );
    expect(stats(g, 1, VANILLA)).toEqual([2 + 1 + 1, 4 + 1 + 1]);
  });

  it("a granted keyword counts as an ability (Home One's Restore aura)", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, REX)
        .WithGroundUnitForPlayer(1, VANILLA)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.homeOne)
        .Build(),
    );
    expect(stats(g, 1, VANILLA)).toEqual([2, 4]);
  });

  it("a Beast token (no text) qualifies", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, REX).WithGroundUnitForPlayer(1, BEAST).Build());
    expect(stats(g, 1, BEAST)).toEqual([4, 4]);
  });

  it("the aura switches off while Rex has lost his abilities", () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(1, REX).WithGroundUnitForPlayer(1, VANILLA).Build();
    loseAbilities(state, state.player1.groundArena[0].playId);
    g.loadNewState(state);
    expect(stats(g, 1, VANILLA)).toEqual([2, 4]);
  });
});
