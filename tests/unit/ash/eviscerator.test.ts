import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_149 Eviscerator (Space, cost 8) — "Advantage tokens on friendly units lose all abilities.
// (They aren't defeated after combat.)\nWhen Played/On Attack: Give 2 Advantage tokens to each
// other friendly unit."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_149 Eviscerator — When Played", () => {
  it("gives 2 Advantage tokens to each other friendly unit, but not itself", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.eviscerator)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // enemy — unaffected
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    const marine = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    const craft = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.systemPatrolCraft)!;
    const eviscerator = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.eviscerator)!;
    const enemyMarine = g.state.player2.groundArena[0];

    expect(marine.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(2);
    expect(craft.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(2);
    expect(eviscerator.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(0);
    expect(enemyMarine.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(0);
  });
});

describe("ASH_149 Eviscerator — Advantage tokens don't defeat after combat", () => {
  it("a friendly unit's Advantage tokens survive its attack ending, while Eviscerator is in play", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.eviscerator)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    const craftPlayId = state.player1.spaceArena[1].playId;
    g.state.player1.spaceArena[1].upgrades.push(
      { cardId: Cards.upgrades.token.advantage, playId: "adv1", owner: 1, controller: 1 },
    );

    await g.attackWithSpaceUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    const craft = g.state.player1.spaceArena.find(u => u.playId === craftPlayId)!;
    expect(craft.upgrades.some(u => u.cardId === Cards.upgrades.token.advantage)).toBe(true);
  });

  it("control: without Eviscerator, the Advantage token IS defeated after the attack ends", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    const craftPlayId = state.player1.spaceArena[0].playId;
    g.state.player1.spaceArena[0].upgrades.push(
      { cardId: Cards.upgrades.token.advantage, playId: "adv1", owner: 1, controller: 1 },
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const craft = g.state.player1.spaceArena.find(u => u.playId === craftPlayId)!;
    expect(craft.upgrades.some(u => u.cardId === Cards.upgrades.token.advantage)).toBe(false);
  });
});

describe("ASH_149 Eviscerator — On Attack", () => {
  it("also fires when Eviscerator attacks", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithSpaceUnitForPlayer(1, Cards.units.ash.eviscerator)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const marine = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    expect(marine.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(2);
  });
});
