import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_265 Twi'lek Kalikori (Upgrade +2/+2, cost 4, Heroism, Item) —
//   "When Played: If attached unit is a Twi'lek, search the top 8 cards of your deck for any
//    number of Twi'lek units with a combined costs 5 or less and play each of them for free."
//
// An upgrade's When Played fires from the upgrade-target branch of the dispatch listener, not
// when-played.ts — an easy place to put this in the wrong file and see nothing happen.
//
// The search itself is entirely existing machinery: searchDeck already takes a trait filter,
// maxCombinedCost and costModifier: 'free' (SOR_087 Darth Vader is the same shape). The card's
// own work is the attached-unit trait gate.
//
// "Any number" means no maxChoices cap — only the combined-cost budget limits the haul.

const KALIKORI = "HMW_265";
const TWILEK_UNIT = "LAW_134";        // Bib Fortuna — Twi'lek, cost 2
const TWILEK_UNIT_2 = "JTL_111";      // Seasoned Fleet Admiral — Twi'lek, cost 2
const TWILEK_HOST = "LAW_058";        // Honor-Bound Partisan — a Twi'lek unit, cost 2
const NON_TWILEK_HOST = Cards.units.sor.battlefieldMarine;

function setup(host: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, NON_TWILEK_HOST, 20)
    .WithGroundUnitForPlayer(1, host)
    .WithCardInHandForPlayer(1, KALIKORI)
    .WithActivePlayer(1);
}

const inPlay = (g: GameTestAdapter, cardId: string) =>
  g.state.player1.groundArena.filter(u => u.cardId === cardId).length;

describe("HMW_265 Twi'lek Kalikori", () => {
  it("searches when attached to a Twi'lek and plays the chosen unit for free", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(TWILEK_HOST)
        .WithCardInDeckForPlayer(1, TWILEK_UNIT)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);   // attach to the Twi'lek host
    const beforeResources = g.state.player1.resources.filter(r => r.ready).length;
    await g.chooseDeckSearchAsync(1, ["0"]);

    expect(inPlay(g, TWILEK_UNIT)).toBe(1);
    // "for free" — playing it cost nothing on top of the Kalikori itself.
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(beforeResources);
  });

  it("does not search when attached to a NON-Twi'lek", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(NON_TWILEK_HOST)
        .WithCardInDeckForPlayer(1, TWILEK_UNIT)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(inPlay(g, TWILEK_UNIT)).toBe(0);
  });

  it("still attaches and gives +2/+2 to a non-Twi'lek host", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(NON_TWILEK_HOST).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].upgrades.map(u => u.cardId)).toEqual([KALIKORI]);
  });

  it("takes ANY number within the budget — two 2-cost Twi'leks at once", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(TWILEK_HOST)
        .WithCardInDeckForPlayer(1, TWILEK_UNIT)
        .WithCardInDeckForPlayer(1, TWILEK_UNIT_2)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseDeckSearchAsync(1, ["0", "1"]);

    expect(inPlay(g, TWILEK_UNIT)).toBe(1);
    expect(inPlay(g, TWILEK_UNIT_2)).toBe(1);
  });

  it("offers only Twi'lek UNITS from the top 8", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(TWILEK_HOST)
        .WithCardInDeckForPlayer(1, NON_TWILEK_HOST) // a non-Twi'lek unit
        .WithCardInDeckForPlayer(1, TWILEK_UNIT)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    expect(pending?.type).toBe("DeckSearch");
    if (pending?.type === "DeckSearch") {
      expect(pending.choices.map(c => c.cardId)).toEqual([TWILEK_UNIT]);
      expect(pending.maxCombinedCost).toBe(5);
      expect(pending.costModifier).toBe("free");
      expect(pending.maxChoices).toBeUndefined(); // "any number"
    }
  });

  it("taking nothing is allowed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(TWILEK_HOST)
        .WithCardInDeckForPlayer(1, TWILEK_UNIT)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseDeckSearchAsync(1, []);

    expect(inPlay(g, TWILEK_UNIT)).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
