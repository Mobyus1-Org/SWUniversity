import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// IC27_084 Negotiator — Prepare the Troops (9/7 Space, cost 9, Command/Heroism)
//   "Sentinel. On Attack/When Defeated: Resource the top card of your deck. Then, you may return a
//    friendly resource to its owner's hand."

const NEGOTIATOR = Cards.units.ic27.negotiator;
const MARINE = Cards.units.sor.battlefieldMarine;
const SECURITY = Cards.units.sor.consularSecurityForce;
const RIVALS_FALL = Cards.events.shd.rivalsFall;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInDeckForPlayer(1, SECURITY); // the top card
}

const resourceIds = (g: GameTestAdapter) => g.state.player1.resources.map(r => r.cardId);

describe("IC27_084 Negotiator — On Attack", () => {
  it("resources the top card, then may return a friendly resource to its owner's hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, NEGOTIATOR).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(resourceIds(g)).toContain(SECURITY);
    expect(g.state.player1.deck).toHaveLength(0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    const marineResource = g.state.player1.resources.find(r => r.cardId === MARINE)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marineResource] });

    expect(g.state.player1.resources).toHaveLength(10); // +1 from the deck, −1 to hand
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player2.base.damage).toBe(9);
  });

  it("the resource that just arrived can be the one returned", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, NEGOTIATOR).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    const fresh = g.state.player1.resources.find(r => r.cardId === SECURITY)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [fresh] });

    expect(resourceIds(g)).not.toContain(SECURITY);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([SECURITY]);
  });

  it("declining the return keeps the new resource and returns nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, NEGOTIATOR).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.resources).toHaveLength(11);
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(9);
  });

  it("with an empty deck nothing is resourced, but the return is still offered", async () => {
    const g = new GameTestAdapter();
    const state = board().WithSpaceUnitForPlayer(1, NEGOTIATOR).Build();
    state.player1.deck = [];
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.resources).toHaveLength(10);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });
});

describe("IC27_084 Negotiator — When Defeated", () => {
  it("resources the top card and offers the return when he is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, NEGOTIATOR).WithCardInHandForPlayer(1, RIVALS_FALL).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(resourceIds(g)).toContain(SECURITY);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);
    expect(g.state.player1.resources).toHaveLength(11);
  });
});

describe("IC27_084 Negotiator — Sentinel", () => {
  it("has Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, NEGOTIATOR).Build());
    const n = g.state.player1.spaceArena[0];

    expect(HasSentinel(n.cardId, n.playId, 1)).toBe(true);
  });
});
