import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// ASH_083 Summa-verminoth (15/15 Space, cost 12) —
//   "Sentinel
//    On Attack: Defeat all other space units."
describe("ASH_083 Summa-verminoth", () => {
  it("has Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.summaVerminoth)
        .Build(),
    );
    const verminoth = g.state.player1.spaceArena[0];
    expect(HasSentinel(verminoth.cardId, verminoth.playId, 1)).toBe(true);
  });

  it("On Attack: defeats every other space unit on both sides, but leaves ground units alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.summaVerminoth)
        .WithSpaceUnitForPlayer(1, Cards.units.token.xWing) // friendly space unit — also defeated
        .WithSpaceUnitForPlayer(2, Cards.units.token.tieFighter) // enemy space unit — defeated
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // enemy ground unit — untouched
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // Summa-verminoth itself survives ("all OTHER space units").
    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.ash.summaVerminoth)).toBe(true);
    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.token.xWing)).toBe(false);
    expect(g.state.player2.spaceArena.some(u => u.cardId === Cards.units.token.tieFighter)).toBe(false);
    // Ground units are untouched.
    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
  });

  it("On Attack: defeats a space unit chosen as the attack's own target before combat happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.summaVerminoth)
        .WithSpaceUnitForPlayer(2, Cards.units.token.xWing)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0); // choose the X-Wing as the attack target

    // The X-Wing was defeated by the mass-defeat effect before combat damage could apply.
    expect(g.state.player2.spaceArena.some(u => u.cardId === Cards.units.token.xWing)).toBe(false);
  });
});
