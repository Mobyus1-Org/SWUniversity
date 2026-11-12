import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";

// IC27_144 Jango Fett — Straight Shooter (4/4 Ground, cost 4, Cunning/Villainy)
//   "Ambush. When Defeated: You may discard a card from your hand. If you do, return an event from
//    your discard pile to your hand."

const JANGO = Cards.units.ic27.jangoFett;
const OPEN_FIRE = Cards.events.sor.openFire;      // an event
const MARINE = Cards.units.sor.battlefieldMarine;
const SWOOP = Cards.units.sor.swoopRacer;
const CSF = Cards.units.sor.consularSecurityForce; // 3/7 — Jango (1 HP left) dies attacking it

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, JANGO, true, 3)
    .WithGroundUnitForPlayer(2, CSF);
}

const res = (g: GameTestAdapter) =>
  g.lastDispatchResponse?.resolutionNeeded as { type?: string; fromPlayIds?: string[] } | undefined;
const discardIds = (g: GameTestAdapter) => g.state.player1.discard.map(c => c.cardId);

async function jangoDies(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
}

describe("IC27_144 Jango Fett", () => {
  it("has Ambush", () => {
    expect(HasAmbush(JANGO)).toBe(true);
  });

  it("When Defeated: discard a card, then return the chosen event to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithCardInHandForPlayer(1, MARINE)
      .WithCardInDiscardForPlayer(1, OPEN_FIRE).WithCardInDiscardForPlayer(1, SWOOP).Build());

    await jangoDies(g);
    expect(res(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    const fire = g.state.player1.discard.find(c => c.cardId === OPEN_FIRE)!;
    expect(res(g)?.fromPlayIds).toEqual([fire.playId]); // events only — no units
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [fire.playId] });

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([OPEN_FIRE]);
    expect(discardIds(g)).toContain(MARINE);
    expect(discardIds(g)).not.toContain(OPEN_FIRE);
  });

  it("the event discarded as the cost can come straight back", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, OPEN_FIRE).Build());

    await jangoDies(g);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [res(g)!.fromPlayIds![0]] });

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([OPEN_FIRE]);
  });

  it("declining keeps the hand and the discard pile as they were", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, MARINE).WithCardInDiscardForPlayer(1, OPEN_FIRE).Build());

    await jangoDies(g);
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(discardIds(g)).toContain(OPEN_FIRE);
  });

  it("an empty hand: no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDiscardForPlayer(1, OPEN_FIRE).Build());

    await jangoDies(g);

    expect(res(g)).toBeFalsy();
  });

  it("no event anywhere: no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, MARINE).WithCardInDiscardForPlayer(1, SWOOP).Build());

    await jangoDies(g);

    expect(res(g)).toBeFalsy();
    expect(g.state.player1.hand).toHaveLength(1);
  });
});
