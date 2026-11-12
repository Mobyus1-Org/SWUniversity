import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_194 You're My Only Hope (Event, cost 3, Heroism, Gambit) — reprint of SOR_246.
//   "Look at the top card of your deck. You may play it. It costs 5 resources less. If your base
//    has 5 or less remaining HP, you may play it for free instead."

const CSF = Cards.units.sor.consularSecurityForce; // cost 6, Vigilance/Heroism

function board(baseDamage = 0) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, baseDamage)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
    .WithCardInHandForPlayer(1, Cards.events.ic27.youreMyOnlyHope)
    .WithCardInDeckForPlayer(1, CSF);
}

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("IC27_194 You're My Only Hope", () => {
  it("plays the top card at 5 resources less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    const before = readyResources(g);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(CSF);
    expect(before - readyResources(g)).toBe(4); // 3 for the event + (6 − 5)
  });

  it("plays it for free with 5 or less remaining base HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(25).Build());
    const before = readyResources(g);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(CSF);
    expect(before - readyResources(g)).toBe(3);
  });

  it("declining leaves the card on top of the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.deck.map(c => c.cardId)).toEqual([CSF]);
  });
});
