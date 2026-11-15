import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";

// SOR_177 Bib Fortuna — Jabba's Majordomo (1/3 Ground, cost 2, Cunning/Villainy)
//   "Shielded"
//   "Action [Exhaust]: Play an event from your hand. It costs [1 resource] less."

const BIB = Cards.units.sor.bibFortuna;
const OPEN_FIRE = Cards.events.sor.openFire; // cost 3, Aggression — deal 4 damage to a unit
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.darthVader) // Aggression/Villainy — no penalty on Open Fire
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithGroundUnitForPlayer(1, BIB)
    .WithGroundUnitForPlayer(2, CSF)
    .WithActivePlayer(1);
}

describe("SOR_177 Bib Fortuna", () => {
  it("has Shielded", () => {
    expect(HasShielded(BIB)).toBe(true);
  });

  it("Action: plays an event from hand for 1 less, exhausting Bib", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, OPEN_FIRE).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: BIB, playId: g.state.player1.groundArena[0].playId });
    await g.chooseCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(4);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(3 - 1);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("refuses a unit card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, OPEN_FIRE).WithCardInHandForPlayer(1, MARINE).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: BIB, playId: g.state.player1.groundArena[0].playId });
    await g.chooseCardFromHandAsync(1, 1);

    expect(g.state.player1.hand.length).toBe(2);
  });
});
