import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";

// The "play a card from your hand" leader Actions, all of which used to pay their cost and do
// nothing.
//
// SOR_003 Chewbacca      — Play a unit costing 3 or less (paying its cost). It gains Sentinel this phase.
// SHD_016 Fennec Shand   — Play a unit costing 4 or less (paying its cost). Give it Ambush this phase.
// SHD_013 Han Solo       — Play a unit. It costs 1 less. Deal 2 damage to it.
// SEC_007 Dryden Vos     — [discard a 6+ card] Play a unit costing 5 or less. It gains Ambush this phase.
// LAW_003 Agent Kallus   — Play a card from your hand, ignoring its aspect penalties.
// LOF_013 Barriss Offee  — [use the Force] Play an event. It costs 1 less.
// LOF_018 Anakin         — [use the Force] Play a Villainy non-unit card, ignoring aspect penalties.

function setup(leader: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

const readyCount = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("SOR_003 Chewbacca", () => {
  it("plays a unit costing 3 or less and grants it Sentinel for the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.chewbacca)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
        .Build(),
    );

    const before = readyCount(g);
    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    const unit = g.state.player1.groundArena[0];
    expect(unit.cardId).toBe(Cards.units.sor.battlefieldMarine);
    expect(readyCount(g)).toBe(before - 2); // paid its own cost
    expect(HasSentinel(unit.cardId, unit.playId, 1)).toBe(true);
  });

  it("rejects a unit costing more than 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.chewbacca)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2 — keeps it available
        .WithCardInHandForPlayer(1, Cards.units.sor.consularSecurityForce) // cost 5
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 1);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.groundArena).toHaveLength(0);
  });

  it("soft-passes when no cheap unit is in hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.chewbacca)
        .WithCardInHandForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(false); // cost still paid
  });
});

describe("SHD_016 Fennec Shand", () => {
  it("plays a unit costing 4 or less and grants it Ambush for the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.fennecShand)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    const unit = g.state.player1.groundArena[0];
    expect(HasAmbush(unit.cardId, unit.playId, "Hand", 1)).toBe(true);
  });
});

describe("SHD_013 Han Solo", () => {
  it("plays a unit for 1 resource less and deals 2 damage to it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.hanSolo)
        .WithCardInHandForPlayer(1, Cards.units.sor.consularSecurityForce) // cost 4, 7 HP
        .Build(),
    );

    const before = readyCount(g);
    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    // 4 printed + 2 aspect penalty (Han is Heroism/Aggression, the unit Vigilance) − 1 = 5.
    expect(readyCount(g)).toBe(before - 5);
    expect(g.state.player1.groundArena[0].damage).toBe(2);
  });
});

describe("SEC_007 Dryden Vos", () => {
  it("discards a 6+ card as the cost, then plays a unit costing 5 or less with Ambush", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sec.drydenVos)
        .WithCardInHandForPlayer(1, Cards.units.sor.gladiatorStarDestroyer) // cost 6 — the discard
        .WithCardInHandForPlayer(1, Cards.units.sor.consularSecurityForce) // cost 5 — the play
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0); // pay the discard cost
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(Cards.units.sor.gladiatorStarDestroyer);

    await g.chooseCardFromHandAsync(1, 0); // now play the remaining unit
    const unit = g.state.player1.groundArena[0];
    expect(unit.cardId).toBe(Cards.units.sor.consularSecurityForce);
    expect(HasAmbush(unit.cardId, unit.playId, "Hand", 1)).toBe(true);
  });
});

describe("LAW_003 Agent Kallus", () => {
  it("plays a card ignoring its aspect penalty", async () => {
    const g = new GameTestAdapter();
    // Kallus is Villainy/Aggression; a Heroism card would normally cost +2 in aspect penalty.
    g.loadNewState(
      setup(Cards.leaders.law.agentKallus)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2, Heroism
        .Build(),
    );

    const before = readyCount(g);
    await g.useLeaderAbilityAsync(1); // costs 1 resource
    await g.chooseCardFromHandAsync(1, 0);

    // 1 (ability) + 2 (printed cost, no aspect penalty) = 3.
    expect(readyCount(g)).toBe(before - 3);
    expect(g.state.player1.groundArena).toHaveLength(1);
  });
});

describe("LOF_013 Barriss Offee", () => {
  it("uses the Force and plays an event for 1 resource less", async () => {
    const g = new GameTestAdapter();
    const state = setup(Cards.leaders.lof.barrissOffee)
      .WithCardInHandForPlayer(1, Cards.events.shd.daringRaid) // cost 1
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build();
    state.player1.supplemental = { ...state.player1.supplemental, forceToken: true };
    g.loadNewState(state);

    const before = readyCount(g);
    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // Daring Raid's own target

    expect(g.state.player1.supplemental.forceToken).toBe(false); // Force spent as the cost
    // 1 printed + 2 aspect penalty (Barriss is Cunning/Villainy, Daring Raid Aggression) − 1 = 2.
    expect(readyCount(g)).toBe(before - 2);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("is a no-op without a Force token — the cost cannot be paid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.lof.barrissOffee)
        .WithCardInHandForPlayer(1, Cards.events.shd.daringRaid)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.hand).toHaveLength(1); // event not played
  });

  it("rejects a non-event card", async () => {
    const g = new GameTestAdapter();
    const state = setup(Cards.leaders.lof.barrissOffee)
      .WithCardInHandForPlayer(1, Cards.events.shd.daringRaid)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    state.player1.supplemental = { ...state.player1.supplemental, forceToken: true };
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 1); // the unit

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });
});

describe("LOF_018 Anakin Skywalker", () => {
  it("rejects a Unit — the card must be a Villainy NON-unit", async () => {
    const g = new GameTestAdapter();
    const state = setup(Cards.leaders.lof.anakinSkywalker)
      .WithCardInHandForPlayer(1, Cards.events.sor.powerOfTheDarkSide) // Villainy event
      .WithCardInHandForPlayer(1, Cards.units.shd.hylobonEnforcer) // Villainy UNIT
      .Build();
    state.player1.supplemental = { ...state.player1.supplemental, forceToken: true };
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 1);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("soft-passes when no Villainy non-unit card is in hand, without spending the Force", async () => {
    const g = new GameTestAdapter();
    const state = setup(Cards.leaders.lof.anakinSkywalker)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    state.player1.supplemental = { ...state.player1.supplemental, forceToken: true };
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.supplemental.forceToken).toBe(true); // Force NOT wasted
  });
});
