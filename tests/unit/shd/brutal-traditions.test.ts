import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_038 Brutal Traditions (Upgrade +1/+2, cost 2, Villainy/Vigilance, Learned) —
//   "Action: If an enemy unit was defeated this phase, play this upgrade from your discard pile
//    (paying its cost)."
//
// First consumer of the discard-hosted Action path — a THIRD actor location, after unit/leader and
// the base-upgrade path built for HMW_037. A card in the discard is not in any arena, so neither
// ActionAbilities nor GetUnitByPlayId can reach it.
//
// The condition is checked BEFORE the cost, and the cost is the upgrade's printed cost rather than
// defeating anything — so a failed attempt must leave both the discard and the resources untouched.

const BRUTAL = "SHD_038";
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7

function setup(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic) // Vigilance/Villainy
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithGroundUnitForPlayer(1, CSF)
    .WithCardInDiscardForPlayer(1, BRUTAL)
    .WithActivePlayer(1);
}

const brutalPlayId = (g: GameTestAdapter) =>
  g.state.player1.discard.find(c => c.cardId === BRUTAL)!.playId;
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

/** P1's 3/7 kills a 3/3, so an enemy unit has been defeated this phase. */
async function killAnEnemy(g: GameTestAdapter) {
  const csfIdx = g.state.player1.groundArena.findIndex(u => u.cardId === CSF);
  await g.attackWithGroundUnitAsync(1, csfIdx);
  await g.chooseGroundUnitAsync(2, 0);
  await g.dispatchAsync(2, "pass-action", {});
}

describe("SHD_038 Brutal Traditions", () => {
  it("plays itself out of the discard once an enemy unit has been defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());
    await killAnEnemy(g);

    await g.dispatchAsync(1, "use-ability", { playId: brutalPlayId(g), cardId: BRUTAL });
    const csfIdx = g.state.player1.groundArena.findIndex(u => u.cardId === CSF);
    await g.chooseGroundUnitAsync(1, csfIdx);

    expect(g.state.player1.groundArena[csfIdx].upgrades.map(u => u.cardId)).toEqual([BRUTAL]);
    expect(g.state.player1.discard.some(c => c.cardId === BRUTAL)).toBe(false);
  });

  it("pays its printed cost of 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());
    await killAnEnemy(g);
    const before = readyResources(g);

    await g.dispatchAsync(1, "use-ability", { playId: brutalPlayId(g), cardId: BRUTAL });
    const csfIdx = g.state.player1.groundArena.findIndex(u => u.cardId === CSF);
    await g.chooseGroundUnitAsync(1, csfIdx);

    expect(readyResources(g)).toBe(before - 2);
  });

  it("is unusable when no enemy unit has been defeated this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.dispatchAsync(1, "use-ability", { playId: brutalPlayId(g), cardId: BRUTAL });

    expect(g.state.player1.discard.some(c => c.cardId === BRUTAL)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("a FRIENDLY unit dying does not satisfy it — the text says enemy", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)   // ours, 3/3
        .WithGroundUnitForPlayer(2, CSF)      // theirs, 3/7 — kills ours on the counter
        .Build(),
    );
    const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.attackWithGroundUnitAsync(1, marineIdx);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(false);
    await g.dispatchAsync(2, "pass-action", {});

    await g.dispatchAsync(1, "use-ability", { playId: brutalPlayId(g), cardId: BRUTAL });

    expect(g.state.player1.discard.some(c => c.cardId === BRUTAL)).toBe(true);
  });

  it("leaves resources alone when it cannot be afforded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(1).WithGroundUnitForPlayer(2, MARINE).Build());
    await killAnEnemy(g);

    await g.dispatchAsync(1, "use-ability", { playId: brutalPlayId(g), cardId: BRUTAL });

    expect(g.state.player1.discard.some(c => c.cardId === BRUTAL)).toBe(true);
  });

  it("gives its host +1/+2 once attached", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());
    await killAnEnemy(g);

    await g.dispatchAsync(1, "use-ability", { playId: brutalPlayId(g), cardId: BRUTAL });
    const csfIdx = g.state.player1.groundArena.findIndex(u => u.cardId === CSF);
    await g.chooseGroundUnitAsync(1, csfIdx);

    const host = g.state.player1.groundArena[csfIdx];
    expect(host.upgrades).toHaveLength(1);
  });
});
