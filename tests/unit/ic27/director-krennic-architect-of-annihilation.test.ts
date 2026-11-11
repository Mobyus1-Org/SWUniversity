import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { ActionAbilities } from "@/server/engine/actions/action-ability";

// IC27_057 Director Krennic — Architect of Annihilation (0/4 Ground, cost 2, Command/Villainy)
//   "Action [Exhaust]: Play a unit that costs 7 or more from your hand. It costs 2 resources less."

const KRENNIC = Cards.units.ic27.directorKrennic;
const VADER = Cards.units.sor.darthVader;      // SOR_087, cost 7, Command/Villainy
const SECURITY = Cards.units.sor.consularSecurityForce; // cost 4
const MARINE = Cards.units.sor.battlefieldMarine;

// Krennic leader (Vigilance/Villainy) + Command base: a Command/Villainy unit has no penalty.
function board(resources: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithGroundUnitForPlayer(1, KRENNIC);
}

const krennicId = (g: GameTestAdapter) => g.state.player1.groundArena[0].playId;
const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("IC27_057 Director Krennic — Architect of Annihilation", () => {
  it("plays a 7-cost unit from hand for 5", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(5).WithCardInHandForPlayer(1, VADER).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: KRENNIC, playId: krennicId(g) });
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(VADER);
    expect(ready(g)).toBe(0);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("only units costing 7 or more can be picked", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(10).WithCardInHandForPlayer(1, SECURITY).WithCardInHandForPlayer(1, VADER).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: KRENNIC, playId: krennicId(g) });
    await g.chooseCardFromHandAsync(1, 0); // the 4-cost unit is refused

    expect(g.state.player1.hand.map(c => c.cardId)).toContain(SECURITY);
    await g.chooseCardFromHandAsync(1, 1);
    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(VADER);
    expect(ready(g)).toBe(5);
  });

  it("is not offered when no 7+ unit is affordable even at 2 less", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(4).WithCardInHandForPlayer(1, VADER).WithCardInHandForPlayer(1, SECURITY).Build());

    expect(ActionAbilities(KRENNIC, 1, krennicId(g))).not.toContain(KRENNIC);
  });

  it("control: without his Action the same unit costs the full 7", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(5).WithCardInHandForPlayer(1, VADER).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([VADER]);
  });
});
