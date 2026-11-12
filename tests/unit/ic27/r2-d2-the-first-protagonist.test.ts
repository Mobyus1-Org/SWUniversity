import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_151 R2-D2 — The First Protagonist (1/3 Ground, cost 1, Cunning/Heroism)
//   "On Attack: Choose one: Ready a resource. / Deal 1 damage to a ground unit. /
//    Look at the top card of your deck. You may discard it."
// Only the modes that can do something are offered; a lone viable mode skips the menu.

const R2 = Cards.units.ic27.r2d2FirstProtagonist;
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;

function board(opts: { exhausted?: number; deck?: boolean } = {}) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 3)
    .WithGroundUnitForPlayer(1, R2)
    .WithGroundUnitForPlayer(2, CSF);
  if (opts.deck !== false) b = b.WithCardInDeckForPlayer(1, MARINE);
  const state = b.Build();
  for (let i = 0; i < (opts.exhausted ?? 2); i++) state.player1.resources[i].ready = false;
  return state;
}

const res = (g: GameTestAdapter) =>
  g.lastDispatchResponse?.resolutionNeeded as { type?: string; options?: string[]; fromPlayIds?: string[] } | undefined;

async function r2Attacks(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.chooseBaseAsync(1, 2);
}

describe("IC27_151 R2-D2", () => {
  it("offers all three modes", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board());

    await r2Attacks(g);

    expect(res(g)?.options).toHaveLength(3);
  });

  it("ready mode readies exactly one resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board());

    await r2Attacks(g);
    await g.chooseOptionAsync(1, "ready");

    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(2);
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("deal mode: 1 damage to a ground unit — any player's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board());

    await r2Attacks(g);
    await g.chooseOptionAsync(1, "deal");
    expect([...(res(g)?.fromPlayIds ?? [])].sort()).toEqual(
      [g.state.player1.groundArena[0].playId, g.state.player2.groundArena[0].playId].sort());
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("look mode: discarding the top card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board());

    await r2Attacks(g);
    await g.chooseOptionAsync(1, "look");
    await g.chooseYesAsync(1);

    expect(g.state.player1.deck).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("look mode: leaving it on top", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board());

    await r2Attacks(g);
    await g.chooseOptionAsync(1, "look");
    await g.chooseNoAsync(1);

    expect(g.state.player1.deck.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.discard).toHaveLength(0);
  });

  it("no exhausted resource and an empty deck: straight to the damage target", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board({ exhausted: 0, deck: false }));

    await r2Attacks(g);

    expect(res(g)?.type).toBe("Target");
  });
});
