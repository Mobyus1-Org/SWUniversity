import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_150 Migrate (Event, cost 3, Command, Innate) —
//   "For every 3 resources you control, create a Beast token."
//
// Rounded down: 8 resources make 2 Beasts. Exhausted resources still count — "control", not "ready".

const MIGRATE = Cards.events.hmw.migrate;
const BEAST = Cards.units.token.beast;
const MARINE = Cards.units.sor.battlefieldMarine;

const beasts = (g: GameTestAdapter) => g.state.player1.groundArena.filter(u => u.cardId === BEAST).length;

function setup(resources: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithCardInHandForPlayer(1, MIGRATE)
    .WithActivePlayer(1)
    .Build();
}

describe("HMW_150 Migrate", () => {
  it("creates a Beast per 3 resources, counting the exhausted ones (9 → 3)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(9));

    await g.playCardFromHandAsync(1, 0);

    expect(beasts(g)).toBe(3);
  });

  it("rounds down (8 → 2)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(8));

    await g.playCardFromHandAsync(1, 0);

    expect(beasts(g)).toBe(2);
  });
});
