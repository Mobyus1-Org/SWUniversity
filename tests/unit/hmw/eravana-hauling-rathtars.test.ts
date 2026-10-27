import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_047 Eravana — Hauling Rathtars (1/7 Space, cost 5, Command/Cunning, unique)
//   "On Attack: Create a Beast token and ready it."
//
// A Beast is a 3/3 Ground Creature token. Tokens enter exhausted; Eravana readies it, so it can
// attack on its controller's next action.
const ERAVANA = Cards.units.hmw.eravana;
const BEAST = Cards.units.token.beast;
const TIE = Cards.units.ibh.scoutingTieFighter; // 2/2 Space, no abilities

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}
const beasts = (g: GameTestAdapter) => g.state.player1.groundArena.filter(u => u.cardId === BEAST);

async function attackBase(g: GameTestAdapter) {
  await g.attackWithSpaceUnitAsync(1, 0);
  if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);
}

describe("HMW_047 Eravana — On Attack: create a Beast token and ready it", () => {
  it("creates a READY Beast in its controller's ground arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, ERAVANA).Build());
    await attackBase(g);

    expect(beasts(g)).toHaveLength(1);
    expect(beasts(g)[0].ready).toBe(true);
    expect(g.state.player2.groundArena.some(u => u.cardId === BEAST)).toBe(false);
    expect(g.state.player2.base.damage).toBe(1); // the attack itself still lands
  });

  it("the Beast can attack on the next action", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, ERAVANA).Build());
    await attackBase(g);
    await g.dispatchAsync(2, "pass-action", {});

    const beastIndex = g.state.player1.groundArena.findIndex(u => u.cardId === BEAST);
    await g.attackWithGroundUnitAsync(1, beastIndex);
    if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1 + 3);
  });

  it("a plain attacker creates nothing (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, TIE).Build());
    await attackBase(g);

    expect(beasts(g)).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(2);
  });
});
