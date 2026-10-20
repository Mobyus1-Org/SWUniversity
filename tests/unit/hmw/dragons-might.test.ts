import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_102 Dragon's Might (Event, cost 4, Vigilance, Innate)
//   "Defeat a non-leader unit with 4 or less power."
//
// "4 or less power" is read off the unit's CURRENT power, not its printed value: the event
// resolves when announced, so a buff can carry a unit out of range and a debuff can bring one in.
const MIGHT = Cards.events.hmw.dragonsMight;
const POWER_3 = Cards.units.sor.battlefieldMarine;   // 3/3
const POWER_4 = Cards.units.sor.swoopRacer;          // 4/3 — the boundary
const POWER_5 = Cards.units.ash.deathTrooperSquad;   // 5/4 — one over
const XP = Cards.upgrades.token.experience;          // +1/+1, to push a unit over the line

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP) // Vigilance
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, POWER_3, 20)
    .WithCardInHandForPlayer(1, MIGHT);
}

const offered = (g: GameTestAdapter) => {
  const r = g.lastDispatchResponse?.resolutionNeeded;
  return r?.type === "Target" ? (r.fromPlayIds ?? []) : undefined;
};
const enemyUnits = (g: GameTestAdapter) => g.state.player1.groundArena.concat(g.state.player2.groundArena);

describe("HMW_102 Dragon's Might", () => {
  it("defeats a unit with 4 power — the boundary is inclusive", async () => {
    const g = new GameTestAdapter();
    const s = setup().WithGroundUnitForPlayer(2, POWER_4).Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("does not offer a unit with 5 power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, POWER_5).Build());

    await g.playCardFromHandAsync(1, 0);

    // Nothing legal to defeat, so no target prompt at all.
    expect(offered(g)).toBeUndefined();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("reaches either player's units — the text says 'a unit', not 'an enemy unit'", async () => {
    const g = new GameTestAdapter();
    const s = setup()
      .WithGroundUnitForPlayer(1, POWER_3)
      .WithGroundUnitForPlayer(2, POWER_3)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    expect(offered(g)?.length).toBe(2);
  });

  it("never offers a leader unit", async () => {
    const g = new GameTestAdapter();
    // Sabine Wren deployed is 4/4 — inside the power limit, but a leader.
    const s = setup()
      .TheirLeader(Cards.leaders.sor.sabineWren, true, true)
      .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(2, POWER_3)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    const marine = g.state.player2.groundArena.find(u => u.cardId === POWER_3)!;
    expect(offered(g)).toEqual([marine.playId]);
  });

  it("reads CURRENT power: an Experience token carries a 4-power unit out of range", async () => {
    const g = new GameTestAdapter();
    const s = setup()
      .WithGroundUnitForPlayer(2, POWER_4)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        { cardId: XP, playId: "xp1", owner: 2, controller: 2 },
      ])
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    // 4 printed + 1 from the token = 5, so it is out of reach.
    expect(offered(g)).toBeUndefined();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("does nothing when no unit qualifies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build()); // empty board

    await g.playCardFromHandAsync(1, 0);

    expect(enemyUnits(g)).toHaveLength(0);
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(MIGHT); // the event still resolved
  });
});
