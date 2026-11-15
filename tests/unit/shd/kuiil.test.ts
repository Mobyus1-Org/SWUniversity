import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// SHD_041 Kuiil — I Have Spoken (2/3 Ground, cost 2, Heroism/Vigilance)
//   "Restore 1"
//   "On Attack: Discard a card from your deck. If it shares an aspect with your base, return it to
//    your hand."

const KUIIL = Cards.units.shd.kuiil;
const CSF = Cards.units.sor.consularSecurityForce; // Vigilance/Heroism
const MARINE = Cards.units.sor.battlefieldMarine;  // Command/Heroism

function setup(topOfDeck: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP) // Vigilance
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, KUIIL)
    .WithCardInDeckForPlayer(1, topOfDeck)
    .WithActivePlayer(1)
    .Build();
}

async function attack(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.chooseBaseAsync(1, 2);
}

describe("SHD_041 Kuiil", () => {
  it("has Restore 1", () => {
    expect(RestoreAmount(KUIIL)).toBe(1);
  });

  it("a discarded card sharing the base's aspect comes back to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(CSF));

    await attack(g);

    expect(g.state.player1.deck.length).toBe(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([CSF]);
    expect(g.state.player1.discard.length).toBe(0);
  });

  it("a card with no shared aspect stays in the discard pile", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(MARINE));

    await attack(g);

    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([MARINE]);
  });
});
