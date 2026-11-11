import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// IC27_083 Padmé Amidala — With Great Pleasure (5/7 Ground, cost 8, Command/Heroism)
//   "Sentinel. Other friendly Heroism units get +3/+3."

const PADME = Cards.units.ic27.padmeAmidala;
const MARINE = Cards.units.sor.battlefieldMarine;           // 3/3 Command/Heroism
const XWING = Cards.units.sor.allianceXWing;               // 2/3 Heroism, space
const STORMTROOPER = Cards.units.sor.deathStarStormtrooper; // 3/1 Aggression/Villainy

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

const stats = (u: Parameters<typeof Unit.FromInterface>[0]) => {
  const unit = Unit.FromInterface(u);
  return [unit.CurrentPower(), unit.TotalHP()];
};

describe("IC27_083 Padmé Amidala — With Great Pleasure", () => {
  it("other friendly Heroism units get +3/+3, in both arenas", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, PADME)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithSpaceUnitForPlayer(1, XWING)
      .Build());

    expect(stats(g.state.player1.groundArena[1])).toEqual([6, 6]);
    expect(stats(g.state.player1.spaceArena[0])).toEqual([5, 6]);
  });

  it("not herself, not non-Heroism friendlies, not enemy Heroism units", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, PADME)
      .WithGroundUnitForPlayer(1, STORMTROOPER)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    expect(stats(g.state.player1.groundArena[0])).toEqual([5, 7]);
    expect(stats(g.state.player1.groundArena[1])).toEqual([3, 1]);
    expect(stats(g.state.player2.groundArena[0])).toEqual([3, 3]);
  });

  it("two Padmés buff each other (each is another friendly Heroism unit)", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, PADME)
      .WithGroundUnitForPlayer(1, MARINE)
      .Build());
    // A second copy is illegal (unique) in a real game — this only checks the aura stacks per source.
    g.state.player1.groundArena.push({ ...g.state.player1.groundArena[0], playId: "999" });

    expect(stats(g.state.player1.groundArena[0])).toEqual([8, 10]);
    expect(stats(g.state.player1.groundArena[1])).toEqual([9, 9]);
  });

  it("a unit alive only through her +3/+3 survives the start of the regroup phase", async () => {
    const g = new GameTestAdapter();
    const b = board()
      .WithGroundUnitForPlayer(1, PADME)
      .WithGroundUnitForPlayer(1, MARINE, true, 5); // 3/3 base, 6/6 with her — 5 damage
    for (let i = 0; i < 4; i++) b.WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(2, MARINE);
    g.loadNewState(b.Build());

    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.gamePhase).toBe("RegroupResource");
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([PADME, MARINE]);
  });

  it("has Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, PADME).Build());
    const padme = g.state.player1.groundArena[0];

    expect(HasSentinel(padme.cardId, padme.playId, 1)).toBe(true);
  });

  it("an enemy ground attacker is offered only her — not the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithActivePlayer(2)
      .WithGroundUnitForPlayer(1, PADME)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    await g.attackWithGroundUnitAsync(2, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded;

    expect(res?.type).toBe("Target");
    expect(res?.type === "Target" ? res.fromZones : "x").toBeUndefined();
    expect(res?.type === "Target" ? res.fromPlayIds : []).toEqual([g.state.player1.groundArena[0].playId]);
  });
});
