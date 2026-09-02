import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";
import { POWER_MOD } from "@/lib/engine/core-models";

// HMW_036 Kelnacca — Solitary Master (4/5 Ground, cost 4, Command/Vigilance, Force/Jedi/Wookiee,
// unique) —
//   "Restore 2"
//   "When Played: You may pay any number of resources. For every 3 resources paid this way, deal
//    damage equal to this unit's power to an enemy unit."
//
// "Pay any number of resources" has no machinery in this engine — nothing else in the pool does it
// (Force Lightning prints it, but only its lose-abilities half is implemented). Since only
// multiples of 3 change the outcome, the offer is framed as how many HITS to buy rather than a free
// number: paying 4 instead of 3 is legal but strictly worse and produces an identical board.
//
// Each hit is its own target, so 6 resources can split across two different enemy units, and the
// damage is read off Kelnacca's CURRENT power — a buffed Kelnacca hits harder.

const KELNACCA = "HMW_036";
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7

function setup(resources = 14) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithCardInHandForPlayer(1, KELNACCA)
    .WithActivePlayer(1);
}

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("HMW_036 Kelnacca — Solitary Master", () => {
  it("has Restore 2", () => {
    expect(RestoreAmount(KELNACCA)).toBe(2);
  });

  it("pays 3 for a single hit of its power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "3");
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4); // Kelnacca is 4 power
  });

  it("pays 6 for two hits, which can land on different units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, CSF)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "6");
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(2, 1);

    expect(g.state.player2.groundArena[0].damage).toBe(4);
    expect(g.state.player2.groundArena[1].damage).toBe(4);
  });

  it("actually exhausts the resources paid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    const afterCast = readyResources(g); // Kelnacca's own cost is already paid
    await g.chooseOptionAsync(1, "6");
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(readyResources(g)).toBe(afterCast - 6);
  });

  it("paying nothing costs nothing and deals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    const afterCast = readyResources(g);
    await g.chooseOptionAsync(1, "0");

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(readyResources(g)).toBe(afterCast);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("reads the CURRENT power, so a buffed Kelnacca hits harder", async () => {
    // A hardcoded 4 would pass every other test in this file. The buff is applied after Kelnacca
    // lands but before the hit resolves, so the amount can only come from a live power read.
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    const kelnacca = g.state.player1.groundArena.find(u => u.cardId === KELNACCA)!;
    g.state.currentEffects.push({
      cardId: POWER_MOD,
      duration: "Phase",
      affectedPlayer: 1,
      targetPlayId: kelnacca.playId,
      value: 3,
    });

    await g.chooseOptionAsync(1, "3");
    await g.chooseGroundUnitAsync(2, 0);

    // 4 + 3 = 7 kills the 3/7 outright; an unbuffed 4 would leave it standing on 4 damage.
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("is not offered with fewer than 3 spendable resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(6).WithGroundUnitForPlayer(2, CSF).Build()); // 6 - 4 cast = 2 left

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("is not offered when the opponent has no units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("only ENEMY units are offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, CSF)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "3");

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    expect(pending?.type).toBe("Target");
    const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
    expect(offered).toEqual([g.state.player2.groundArena[0].playId]);
  });

  it("a hit that kills sweeps the body", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "3");
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0); // 4 damage onto a 3/3
  });
});
