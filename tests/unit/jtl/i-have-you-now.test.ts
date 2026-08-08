import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_193 I Have You Now (Event) — "Attack with a Vehicle unit. Prevent all damage that would
// be dealt to it during this attack."
//
// Two clauses: the attacker must be a VEHICLE (not just any unit), and the prevention is
// scoped to THIS attack — a later attack by the same unit takes damage normally.

const AWING = Cards.units.jtl.phoenixSquadronAWing;   // 3/2 Space Vehicle, no abilities
const HYPERSPACE = Cards.units.lof.hyperspaceWayfarer; // 4/10 Space, no abilities — hits back hard
const MARINE = Cards.units.sor.battlefieldMarine;      // Ground, NOT a Vehicle

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithSpaceUnitForPlayer(1, AWING)
    .WithSpaceUnitForPlayer(2, HYPERSPACE)
    .WithCardInHandForPlayer(1, Cards.events.jtl.iHaveYouNow);
}

describe("JTL_193 I Have You Now", () => {
  it("attacks with the chosen Vehicle and prevents all damage dealt to it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0); // the A-Wing attacks
    await g.chooseSpaceUnitAsync(2, 0); // ...into the 4-power Hyperspace Wayfarer

    // The A-Wing is 3/2 and would die to 4 counter-damage; all of it is prevented.
    expect(g.state.player1.spaceArena).toHaveLength(1);
    expect(g.state.player1.spaceArena[0].damage).toBe(0);
    expect(g.state.player2.spaceArena[0].damage).toBe(3); // it still deals its own damage
  });

  it("without the event, the same attack kills the attacker (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player1.spaceArena).toHaveLength(0); // 4 damage onto a 2-HP Vehicle
    expect(g.state.player2.spaceArena[0].damage).toBe(3);
  });

  it("does not offer a non-Vehicle unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();

    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine.playId] });
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);

    // The Vehicle is still a legal choice.
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    expect(g.state.player1.spaceArena[0].damage).toBe(0);
  });

  it("does nothing when no friendly Vehicle can attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, MARINE, 14)
        .WithGroundUnitForPlayer(1, MARINE) // no Vehicle at all
        .WithCardInHandForPlayer(1, Cards.events.jtl.iHaveYouNow)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });

  it("the prevention expires with the attack — a later attack takes damage normally", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, AWING) // a second A-Wing to attack afterwards
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const protectedId = g.state.player1.spaceArena[0].playId;
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    expect(g.state.player1.spaceArena.find(u => u.playId === protectedId)!.damage).toBe(0);

    // The shield is scoped to that attack and must not linger on the unit.
    expect(g.state.currentEffects.some(e => e.cardId === "JTL_193_prevent")).toBe(false);

    await g.dispatchAsync(2, "pass-action", {});

    // The OTHER A-Wing attacks with no event backing it and dies to the 4-power counter.
    const other = g.state.player1.spaceArena.find(u => u.playId !== protectedId)!;
    await g.dispatchAsync(1, "initiate-attack", { playId: other.playId });
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player1.spaceArena.some(u => u.playId === other.playId)).toBe(false);
  });
});
