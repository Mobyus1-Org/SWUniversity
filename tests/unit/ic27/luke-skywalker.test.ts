import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";

// IC27_006 Luke Skywalker — I Have to Face Him (Leader, Aggression/Heroism; unit side 4/6 Ground)
//   Front: "Draw 2 more cards in your starting hand." — setup only; puzzles start mid-game and the
//          engine has no setup phase, so (like JTL_021 Colossus / JTL_028 Nabat Village) it is not
//          modelled.
//   Unit:  "Overwhelm. On Attack: You may discard a card from your hand. If you do, this unit gets
//          +2/+0 for this attack."

const LUKE = Cards.leaders.ic27.lukeSkywalker;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Ground
const STRIKE_TRUE = Cards.events.sor.strikeTrue;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(LUKE)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

async function deploy(g: GameTestAdapter) {
  await g.deployLeaderAsync(1);
  g.state.activePlayer = 1;
  return g.state.player1.groundArena.findIndex(u => u.cardId === LUKE);
}

describe("IC27_006 Luke Skywalker — deployed", () => {
  it("has Overwhelm on the unit side", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    const lukeIdx = await deploy(g);
    const luke = g.state.player1.groundArena[lukeIdx];

    expect(HasOverwhelm(LUKE, luke.playId, 1)).toBe(true);
  });

  it("On Attack: discarding a card gives +2/+0 for this attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, STRIKE_TRUE).Build());

    const lukeIdx = await deploy(g);
    await g.attackWithGroundUnitAsync(1, lukeIdx);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.discard.map(d => d.cardId)).toEqual([STRIKE_TRUE]);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("On Attack: declining keeps the card and attacks for base power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, STRIKE_TRUE).Build());

    const lukeIdx = await deploy(g);
    await g.attackWithGroundUnitAsync(1, lukeIdx);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("On Attack: no offer with an empty hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    const lukeIdx = await deploy(g);
    await g.attackWithGroundUnitAsync(1, lukeIdx);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("the +2 carries through Overwhelm: 6 power into a 3/3 spills 3 to the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, STRIKE_TRUE).WithGroundUnitForPlayer(2, MARINE).Build());

    const lukeIdx = await deploy(g);
    await g.attackWithGroundUnitAsync(1, lukeIdx);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("the +2 lasts for this attack only", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, STRIKE_TRUE).Build());

    const lukeIdx = await deploy(g);
    await g.attackWithGroundUnitAsync(1, lukeIdx);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    g.state.player1.groundArena[lukeIdx].ready = true;
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, lukeIdx);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(10); // 6, then 4
  });
});
