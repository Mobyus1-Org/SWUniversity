import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// HMW_048 Vernestra Rwoh — We Should Handle This Ourselves (5/5 Ground, cost 6, Command/Cunning)
//   Sentinel
//   As an additional cost to play this unit, put up to 2 units that each cost 5 or less from your
//   discard pile on the bottom of your deck. This unit gains those units' "When Played" abilities
//   for this phase.
//
// The additional cost is chosen before she enters; each chosen unit's When Played then resolves as
// hers ("this unit" = Vernestra). Green base (Command) + Han Solo (Cunning) = no aspect penalty.
const VERNESTRA = Cards.units.hmw.vernestraRwoh;
const V_WING = Cards.units.sor.patrollingVWing;      // cost 2 — When Played: draw a card
const ESCORT = Cards.units.twi.battleDroidEscort;    // cost 3 — When Played: create a Battle Droid
const AT_ST = Cards.units.hmw.hijackedAtSt;          // cost 5 — When Played: THIS unit doesn't ready next regroup
const COMMANDOS = Cards.units.hmw.imperialCommandos; // cost 6 — one over
const EVENT = Cards.events.sor.strikeTrue;           // cost 3 event
const UPGRADE = Cards.upgrades.sor.entrenched;       // cost 2 upgrade
const RESOURCE = Cards.units.sor.battlefieldMarine;
const DECK_TOP = Cards.units.sor.battlefieldMarine;
const BATTLE_DROID = Cards.units.token.battleDroid;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.hanSolo)
    .TheirBase(Cards.bases.common.blue30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, RESOURCE, 10)
    .WithCardInDeckForPlayer(1, DECK_TOP)
    .WithCardInHandForPlayer(1, VERNESTRA)
    .WithActivePlayer(1);
}

const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const offered = (g: GameTestAdapter) => {
  const r = needs(g);
  return r?.type === "Target" ? (r.fromPlayIds ?? []) : undefined;
};
const vernestra = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === VERNESTRA);
const discardId = (g: GameTestAdapter, cardId: string) => g.state.player1.discard.find(c => c.cardId === cardId)!.playId;
const readyCount = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const choose = (g: GameTestAdapter, ids: string[]) => g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

describe("HMW_048 Vernestra Rwoh — We Should Handle This Ourselves", () => {
  it("has Sentinel", () => {
    expect(HasSentinel(VERNESTRA)).toBe(true);
  });

  it("offers only units costing 5 or less from YOUR discard pile, up to 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithCardInDiscardForPlayer(1, V_WING)
        .WithCardInDiscardForPlayer(1, AT_ST)
        .WithCardInDiscardForPlayer(1, COMMANDOS)
        .WithCardInDiscardForPlayer(1, EVENT)
        .WithCardInDiscardForPlayer(1, UPGRADE)
        .WithCardInDiscardForPlayer(2, ESCORT)
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);

    const r = needs(g);
    expect(r?.type).toBe("Target");
    expect(r?.type === "Target" && r.maxTargets).toBe(2);
    expect(offered(g)).toEqual(expect.arrayContaining([discardId(g, V_WING), discardId(g, AT_ST)]));
    expect(offered(g)).toHaveLength(2);
    expect(vernestra(g)).toBeUndefined(); // the cost comes first
  });

  it("choosing 2: both go to the bottom of the deck in order and both When Played abilities fire", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInDiscardForPlayer(1, V_WING).WithCardInDiscardForPlayer(1, ESCORT).Build());
    const handBefore = g.state.player1.hand.length;
    await g.playCardFromHandAsync(1, 0);
    await choose(g, [discardId(g, V_WING), discardId(g, ESCORT)]);

    // One at a time onto the bottom: the V-Wing first, then the Escort beneath it.
    expect(g.state.player1.deck.map(c => c.cardId)).toEqual([ESCORT, V_WING, DECK_TOP]);
    expect(g.state.player1.discard).toHaveLength(0);
    expect(vernestra(g)).toBeDefined();
    expect(readyCount(g)).toBe(4); // paid 6

    // Two When Played abilities wait together — the player orders them.
    const order = needs(g);
    expect(order?.type).toBe("Option");
    expect(order?.type === "Option" && order.options).toHaveLength(2);
    await g.chooseOptionAsync(1, order?.type === "Option" ? order.options[0] : "");

    expect(g.state.player1.hand.length).toBe(handBefore - 1 + 1); // Vernestra out, 1 drawn
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(DECK_TOP); // drew the top, not a recycled card
    expect(g.state.player1.groundArena.filter(u => u.cardId === BATTLE_DROID)).toHaveLength(1);
    expect(needs(g)).toBeFalsy();
  });

  it("choosing 1: a cost-5 unit qualifies, and its 'this unit' When Played applies to Vernestra", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInDiscardForPlayer(1, AT_ST).WithCardInDiscardForPlayer(1, V_WING).Build());
    const handBefore = g.state.player1.hand.length;
    await g.playCardFromHandAsync(1, 0);
    await choose(g, [discardId(g, AT_ST)]);

    const v = vernestra(g)!;
    expect(v).toBeDefined();
    expect(g.state.player1.deck[0].cardId).toBe(AT_ST);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([V_WING]);
    expect(g.state.currentEffects.some(e => e.cardId === `${AT_ST}_no_ready` && e.targetPlayId === v.playId)).toBe(true);
    expect(g.state.player1.hand.length).toBe(handBefore - 1); // the unchosen V-Wing's draw did not fire
    expect(needs(g)).toBeFalsy();
  });

  it("choosing none: the prompt appeared, nothing moves and no When Played fires", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInDiscardForPlayer(1, V_WING).WithCardInDiscardForPlayer(1, ESCORT).Build());
    const handBefore = g.state.player1.hand.length;
    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Target");
    await choose(g, []);

    expect(vernestra(g)).toBeDefined();
    expect(readyCount(g)).toBe(4);
    expect(g.state.player1.discard).toHaveLength(2);
    expect(g.state.player1.deck.map(c => c.cardId)).toEqual([DECK_TOP]);
    expect(g.state.player1.hand.length).toBe(handBefore - 1);
    expect(g.state.player1.groundArena.filter(u => u.cardId === BATTLE_DROID)).toHaveLength(0);
    expect(needs(g)).toBeFalsy();
  });

  it("a duplicate-unique prompt interrupts first; the gained When Played still fires after it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, VERNESTRA).WithCardInDiscardForPlayer(1, V_WING).Build());
    const handBefore = g.state.player1.hand.length;
    const oldCopy = g.state.player1.groundArena[0].playId;
    await g.playCardFromHandAsync(1, 0);
    await choose(g, [discardId(g, V_WING)]);

    expect(needs(g)?.type).toBe("Target"); // uniqueness: defeat a copy
    expect(g.state.player1.hand.length).toBe(handBefore - 1); // nothing drawn yet
    await choose(g, [oldCopy]);

    expect(g.state.player1.groundArena.filter(u => u.cardId === VERNESTRA)).toHaveLength(1);
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(DECK_TOP);
  });

  it("a 6-cost unit, an event or an upgrade named by the client is refused", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithCardInDiscardForPlayer(1, V_WING)
        .WithCardInDiscardForPlayer(1, COMMANDOS)
        .WithCardInDiscardForPlayer(1, EVENT)
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    await choose(g, [discardId(g, COMMANDOS)]);
    expect(vernestra(g)).toBeUndefined();
    await choose(g, [discardId(g, EVENT)]);
    expect(vernestra(g)).toBeUndefined();
    expect(g.state.player1.discard).toHaveLength(3);
  });

  it("with no eligible unit in the discard pile there is no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithCardInDiscardForPlayer(1, COMMANDOS)
        .WithCardInDiscardForPlayer(1, EVENT)
        .WithCardInDiscardForPlayer(1, UPGRADE)
        .WithCardInDiscardForPlayer(2, V_WING)
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);

    expect(vernestra(g)).toBeDefined();
    expect(readyCount(g)).toBe(4);
    expect(g.state.player1.discard).toHaveLength(3);
    expect(needs(g)).toBeFalsy();
  });

  it("can't be played without the resources for her cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.hanSolo)
        .TheirBase(Cards.bases.common.blue30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, RESOURCE, 5)
        .WithCardInHandForPlayer(1, VERNESTRA)
        .WithCardInDiscardForPlayer(1, V_WING)
        .WithActivePlayer(1)
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)).toBeFalsy();
    expect(vernestra(g)).toBeUndefined();
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([VERNESTRA]);
    expect(g.state.player1.discard).toHaveLength(1);
  });
});
