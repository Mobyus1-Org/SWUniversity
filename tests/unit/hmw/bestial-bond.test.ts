import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_038 Bestial Bond (Upgrade, cost 3, +2/+2, Vigilance/Command, Innate)
//   "When Played: If attached unit is a Creature or a Force unit, create a Beast token."
//
// Hosts, all vanilla so nothing but the upgrade moves the assertions:
//   Dinosaur Turtle  (ASH_131) 7/7 Ground — Creature
//   Outer Rim Mystic (LOF_112) 2/6 Ground — Force, Fringe
//   Battlefield Marine (SOR_095) 3/3 Ground — Rebel, Trooper: neither
//   Beast token      (HMW_T03) 3/3 Ground — Creature, so a Beast begets a Beast
const BOND = Cards.upgrades.hmw.bestialBond;
const CREATURE = Cards.units.ash.dinosaurTurtle;
const FORCE = Cards.units.lof.outerRimMystic;
const NEITHER = Cards.units.sor.battlefieldMarine;
const BEAST = Cards.units.token.beast;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP) // Vigilance
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, NEITHER, 20);
}

function find(g: GameTestAdapter, p: 1 | 2, cardId: string) {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId)!;
}
const beastsFor = (g: GameTestAdapter, p: 1 | 2) =>
  (p === 1 ? g.state.player1 : g.state.player2).groundArena.filter(u => u.cardId === BEAST);

/** Plays Bestial Bond from hand index 0 onto the named host. */
async function attachTo(g: GameTestAdapter, host: string, hostPlayer: 1 | 2 = 1) {
  await g.playCardFromHandAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, hostPlayer, host).playId] });
}

describe("HMW_038 Bestial Bond", () => {
  it("creates a Beast token on a Creature host, and grants +2/+2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, CREATURE).WithCardInHandForPlayer(1, BOND).Build());

    await attachTo(g, CREATURE);

    expect(beastsFor(g, 1)).toHaveLength(1);
    const host = Unit.FromInterface(find(g, 1, CREATURE));
    expect({ power: host.CurrentPower(), hp: host.TotalHP() }).toEqual({ power: 9, hp: 9 }); // 7/7 +2/+2
  });

  it("creates a Beast token on a Force host", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, FORCE).WithCardInHandForPlayer(1, BOND).Build());

    await attachTo(g, FORCE);

    expect(beastsFor(g, 1)).toHaveLength(1);
    const host = Unit.FromInterface(find(g, 1, FORCE));
    expect({ power: host.CurrentPower(), hp: host.TotalHP() }).toEqual({ power: 4, hp: 8 }); // 2/6 +2/+2
  });

  it("creates NO Beast token on a host that is neither Creature nor Force", async () => {
    // The control case: the same upgrade, the same play, only the host's traits differ.
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, NEITHER).WithCardInHandForPlayer(1, BOND).Build());

    await attachTo(g, NEITHER);

    expect(beastsFor(g, 1)).toHaveLength(0);
    // The upgrade still attached and still grants its statline — only the token is conditional.
    const host = Unit.FromInterface(find(g, 1, NEITHER));
    expect(host.upgrades.some(u => u.cardId === BOND)).toBe(true);
    expect({ power: host.CurrentPower(), hp: host.TotalHP() }).toEqual({ power: 5, hp: 5 }); // 3/3 +2/+2
  });

  it("the Beast belongs to the player who played the upgrade, not the host's controller", async () => {
    // Bestial Bond prints no attach restriction, so an ENEMY Creature is a legal host. The token
    // follows the ability's controller: buffing their unit must not hand them a Beast as well.
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, CREATURE)
      .WithCardInHandForPlayer(1, BOND)
      .Build());

    await attachTo(g, CREATURE, 2);

    const host = find(g, 2, CREATURE);
    expect(host.upgrades.some(u => u.cardId === BOND)).toBe(true); // really attached to theirs
    expect(beastsFor(g, 1)).toHaveLength(1);
    expect(beastsFor(g, 2)).toHaveLength(0);
  });

  it("a Beast token is itself a Creature, so bonding one makes another", async () => {
    // The token's own trait line is what the condition reads — nothing special-cases cards.
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, BEAST).WithCardInHandForPlayer(1, BOND).Build());

    await attachTo(g, BEAST);

    expect(beastsFor(g, 1)).toHaveLength(2); // the host, plus the one it just made
  });

  it("the created Beast is a 3/3 ground unit that entered play exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, CREATURE).WithCardInHandForPlayer(1, BOND).Build());

    await attachTo(g, CREATURE);

    const beast = beastsFor(g, 1)[0];
    const asUnit = Unit.FromInterface(beast);
    expect({ power: asUnit.CurrentPower(), hp: asUnit.TotalHP() }).toEqual({ power: 3, hp: 3 });
    expect(beast.ready).toBe(false);
  });
});
