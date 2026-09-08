import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_196 Grogu — Irresistible (-/5 Ground, cost 2, Cunning/Heroism, Force, unique) —
//   "Action [exhaust]: Exhaust an enemy unit."
//
// He has NO power (a "-" on the card), so he cannot attack usefully — the Action is the whole
// card. Its cost is his own exhaust, which means it is once per readying and needs him ready.
//
// UI gate: a unit with an "Action [...]" needs its id in UNITS_WITH_ACTION_ABILITY or the button
// never renders, and no engine test catches that.

const GROGU = "SHD_196";
const MARINE = Cards.units.sor.battlefieldMarine;

function setup(ready = true) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(1, GROGU, ready)
    .WithActivePlayer(1);
}

const grogu = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === GROGU)!;
const useIt = (g: GameTestAdapter) =>
  g.dispatchAsync(1, "use-ability", { cardId: GROGU, playId: grogu(g).playId });

describe("SHD_196 Grogu — Irresistible", () => {
  it("exhausts the chosen enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await useIt(g);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });

  it("exhausts Grogu as the cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await useIt(g);
    await g.chooseGroundUnitAsync(2, 0);

    expect(grogu(g).ready).toBe(false);
  });

  it("does not offer a FRIENDLY unit — 'an enemy unit'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await useIt(g);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
    expect(offered).toEqual([g.state.player2.groundArena[0].playId]);
  });

  it("an exhausted Grogu cannot use it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(false).WithGroundUnitForPlayer(2, MARINE).Build());

    await useIt(g);

    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });

  it("reaches a SPACE unit too — the text says 'an enemy unit', not an arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, "SHD_063").Build());

    await useIt(g);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].ready).toBe(false);
  });
});
