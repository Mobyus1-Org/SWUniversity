import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_234 Incinerator Trooper (2/2 Ground, cost 2, Imperial/Trooper) —
//   "While attacking, this unit deals combat damage before the defender. (If the defender is
//    defeated, it deals no combat damage.)"
//
// First strike. The engine already models it for ASH_202 Carson Teva, so this is a registration —
// but the reminder text is the whole point of the card and needs proving: a defender that dies to
// the first strike deals NO counter-damage, where simultaneous damage would have killed the
// 2/2 Trooper right back.

const TROOPER = "SHD_234";
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3 — would kill a 2/2 on the counter
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7 — survives and counters
const THUG = "SOR_247";                             // Underworld Thug — vanilla 2/3, the no-first-strike control

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(1, TROOPER)
    .WithActivePlayer(1);
}

describe("SHD_234 Incinerator Trooper", () => {
  it("kills a 2-HP defender before it can counter", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE, true, 1).Build()); // 3/3 on 1 damage

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    // Simultaneous damage would have killed the 2/2 Trooper right back.
    expect(g.state.player1.groundArena.find(u => u.cardId === TROOPER)!.damage).toBe(0);
  });

  it("still takes the counter when the defender survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    // The 3/7 lived, so its 3 power kills the 2/2.
    expect(g.state.player1.groundArena.some(u => u.cardId === TROOPER)).toBe(false);
  });

  it("control: a vanilla unit with no first strike trades with the same defender", async () => {
    // Proves the survival above came from first strike, not the fixture. Underworld Thug is a
    // vanilla 2/3 with no ability: its 2 power still finishes the 2-HP defender, and the
    // defender's 3 power still kills it back.
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, THUG)
        .WithGroundUnitForPlayer(2, MARINE, true, 1)
        .Build(),
    );

    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === THUG);
    await g.attackWithGroundUnitAsync(1, idx);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);          // defender died
    expect(g.state.player1.groundArena.some(u => u.cardId === THUG)).toBe(false); // and so did it
  });
});
