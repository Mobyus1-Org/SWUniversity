import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { SmuggleCost, SmuggleAspects } from "@/server/engine/card-db/keyword-dictionaries.ts/smuggle";

// SHD_213 DJ - Blatant Thief (3/5 Ground, cost 3) —
//   "Smuggle [7 resources Cunning Cunning]
//    When played using Smuggle: Take control of an enemy resource. When this unit leaves play,
//    that resource's owner takes control of it."
//
// Readiness is asymmetric here, and deliberately so:
//   • On the STEAL the resource keeps its state — the victim gets no chance to prepare, since the
//     thief picks and takes it immediately. A ready resource arrives ready.
//   • On the RETURN the thief has controlled it for some span of time and could have exhausted
//     THAT resource preferentially whenever paying costs. So it goes back exhausted, and the
//     thief's own ready count is preserved — unless they have nothing exhausted to trade.

const readyCount = (rs: { ready: boolean }[]) => rs.filter(r => r.ready).length;
const STOLEN_CARD = Cards.units.sor.echoBaseDefender;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP) // Cunning — no aspect penalty on DJ
    .MyLeader(Cards.leaders.sor.hanSolo)   // Cunning
    .TheirBase(Cards.bases.common.blue30HP)
    .TheirLeader(Cards.leaders.sor.lukeSkywalker)
    .WithActivePlayer(1);
}

/**
 * P1 has 12 resources; the first is DJ (so he can be smuggled for 7). P2 has 4 resources, the
 * first of which is a distinguishable card whose ready state the caller sets.
 */
function stealState(opts: { p2StolenReady?: boolean; p1Exhausted?: number } = {}) {
  const state = base()
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
    .Build();
  state.player1.resources[0].cardId = Cards.units.shd.djBlatantThief;
  state.player2.resources[0].cardId = STOLEN_CARD;
  state.player2.resources[0].ready = opts.p2StolenReady ?? true;
  // Leave `p1Exhausted` of P1's resources exhausted, counting from the end.
  const exhaust = opts.p1Exhausted ?? 0;
  for (let i = 0; i < exhaust; i++) {
    state.player1.resources[state.player1.resources.length - 1 - i].ready = false;
  }
  return state;
}

/** Smuggles DJ out of P1's resource row and picks P2's distinguishable resource to steal. */
async function smuggleDjAndSteal(g: GameTestAdapter) {
  await g.smuggleResourceAsync(1, 0);
  const target = g.state.player2.resources.find(r => r.cardId === STOLEN_CARD)!;
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [target.playId] });
}

describe("SHD_213 DJ - Blatant Thief", () => {
  it("has Smuggle 7 [Cunning Cunning]", () => {
    expect(SmuggleCost(Cards.units.shd.djBlatantThief)).toBe(7);
    expect(SmuggleAspects(Cards.units.shd.djBlatantThief)).toEqual(["Cunning", "Cunning"]);
  });

  it("when played using Smuggle: takes control of a chosen enemy resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(stealState());

    await smuggleDjAndSteal(g);

    expect(g.state.player1.resources.some(r => r.cardId === STOLEN_CARD)).toBe(true);
    expect(g.state.player2.resources.some(r => r.cardId === STOLEN_CARD)).toBe(false);

    const stolen = g.state.player1.resources.find(r => r.cardId === STOLEN_CARD)!;
    expect(stolen.owner).toBe(2);       // ownership never changes
    expect(stolen.controller).toBe(1);
    expect(stolen.stolen).toBe(true);
  });

  it("a stolen READY resource arrives ready — the victim had no chance to rearrange", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(stealState({ p2StolenReady: true }));

    await smuggleDjAndSteal(g);

    expect(g.state.player1.resources.find(r => r.cardId === STOLEN_CARD)!.ready).toBe(true);
  });

  // ── The QA scenario ─────────────────────────────────────────────────────────
  it("QA scenario: steal a ready resource, DJ is Vanquished, it returns EXHAUSTED", async () => {
    const g = new GameTestAdapter();
    const state = stealState({ p2StolenReady: true, p1Exhausted: 3 });
    state.player2.hand.push({ cardId: Cards.events.sor.vanquish });
    g.loadNewState(state);

    await smuggleDjAndSteal(g);

    const p1ReadyBefore = readyCount(g.state.player1.resources);

    // P2 Vanquishes DJ.
    const djIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.shd.djBlatantThief);
    await g.playCardFromHandAsync(2, g.state.player2.hand.findIndex(c => c.cardId === Cards.events.sor.vanquish));
    await g.chooseGroundUnitAsync(1, djIdx);

    // The resource is back with its owner...
    expect(g.state.player1.resources.some(r => r.cardId === STOLEN_CARD)).toBe(false);
    const returned = g.state.player2.resources.find(r => r.cardId === STOLEN_CARD)!;
    expect(returned).toBeTruthy();
    expect(returned.controller).toBe(2);
    expect(returned.stolen).toBe(false);

    // ...it comes back EXHAUSTED, and P1 keeps the available resource they had.
    expect(returned.ready).toBe(false);
    expect(readyCount(g.state.player1.resources)).toBe(p1ReadyBefore);
  });

  it("control: played normally from hand, nothing is stolen", async () => {
    const g = new GameTestAdapter();
    const state = stealState();
    state.player1.resources[0].cardId = Cards.units.sor.battlefieldMarine; // DJ not in resources
    state.player1.hand.push({ cardId: Cards.units.shd.djBlatantThief });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, g.state.player1.hand.findIndex(c => c.cardId === Cards.units.shd.djBlatantThief));

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.shd.djBlatantThief)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.resources.length).toBe(8);
    expect(g.state.player1.resources.some(r => r.stolen)).toBe(false);
  });

  it("fizzles when the opponent controls no resources", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    state.player1.resources[0].cardId = Cards.units.shd.djBlatantThief;
    g.loadNewState(state);

    await g.smuggleResourceAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.shd.djBlatantThief)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("returns the resource on a NON-defeat exit too (bounce)", async () => {
    const g = new GameTestAdapter();
    const state = stealState({ p2StolenReady: true, p1Exhausted: 3 });
    state.player2.hand.push({ cardId: Cards.events.sor.waylay });
    g.loadNewState(state);

    await smuggleDjAndSteal(g);

    const djIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.shd.djBlatantThief);
    await g.playCardFromHandAsync(2, g.state.player2.hand.findIndex(c => c.cardId === Cards.events.sor.waylay));
    await g.chooseGroundUnitAsync(1, djIdx);

    expect(g.state.player2.resources.some(r => r.cardId === STOLEN_CARD)).toBe(true);
    expect(g.state.player1.resources.some(r => r.cardId === STOLEN_CARD)).toBe(false);
  });

  it("with nothing exhausted to trade, the return costs the thief a ready resource", async () => {
    const g = new GameTestAdapter();
    const state = stealState({ p2StolenReady: true, p1Exhausted: 0 });
    state.player2.hand.push({ cardId: Cards.events.sor.vanquish });
    g.loadNewState(state);

    await smuggleDjAndSteal(g);
    // Smuggling DJ cost 7, so make every remaining P1 resource ready to remove the trade option.
    g.state.player1.resources.forEach(r => { r.ready = true; });
    const p1ReadyBefore = readyCount(g.state.player1.resources);

    const djIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.shd.djBlatantThief);
    await g.playCardFromHandAsync(2, g.state.player2.hand.findIndex(c => c.cardId === Cards.events.sor.vanquish));
    await g.chooseGroundUnitAsync(1, djIdx);

    const returned = g.state.player2.resources.find(r => r.cardId === STOLEN_CARD)!;
    expect(returned.ready).toBe(true); // nothing to swap with, so the ready card itself goes back
    expect(readyCount(g.state.player1.resources)).toBe(p1ReadyBefore - 1);
  });

  it("survives the stolen resource already being gone when DJ leaves play", async () => {
    const g = new GameTestAdapter();
    const state = stealState({ p2StolenReady: true, p1Exhausted: 3 });
    state.player2.hand.push({ cardId: Cards.events.sor.vanquish });
    g.loadNewState(state);

    await smuggleDjAndSteal(g);
    // Something else removed it in the meantime.
    const idx = g.state.player1.resources.findIndex(r => r.cardId === STOLEN_CARD);
    g.state.player1.resources.splice(idx, 1);

    const djIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.shd.djBlatantThief);
    await g.playCardFromHandAsync(2, g.state.player2.hand.findIndex(c => c.cardId === Cards.events.sor.vanquish));
    await g.chooseGroundUnitAsync(1, djIdx);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.shd.djBlatantThief)).toBe(false);
    // Nothing conjured into either row.
    expect(g.state.player2.resources.some(r => r.cardId === STOLEN_CARD)).toBe(false);
  });
});
