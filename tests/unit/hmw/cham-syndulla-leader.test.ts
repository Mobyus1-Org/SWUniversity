import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_013 Cham Syndulla — Hammer of Ryloth (Leader, Aggression/Heroism, Twi'lek; 3/8 Ground unit)
//   Front:    "When non-combat damage is dealt to a friendly unit or base: You may exhaust this
//              leader. If you do, deal 1 damage to an enemy unit or base.
//              Epic Action: If you control 6 or more resources, deploy this leader."
//   Deployed: "When non-combat damage is dealt to a friendly unit or base: You may deal 1 damage to
//              an enemy unit or base."
//
// He reacts to the VICTIM's side, not to who dealt the damage — which makes him the mirror of the
// usual "when you deal damage" leaders, and puts the prompt in front of the player whose turn it
// ISN'T. Three lines of the text carry the whole implementation:
//   • "non-combat" — combat damage in an attack never counts, ability/event/indirect damage does.
//   • "is dealt" — a Shield that swallows the instance means nothing was dealt, so no trigger.
//   • "an enemy unit or base" — the answering damage may only go at the opponent.
// The leader side pays by exhausting (so an exhausted Cham can't react at all); deployed, it's free.

const CHAM = Cards.leaders.hmw.chamSyndulla;
const RAID = Cards.events.shd.daringRaid;           // 1-cost: deal 2 damage to a unit or base
const BOMBING = Cards.events.sor.bombingRun;        // 5-cost: 3 damage to each unit in one arena
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7 Ground — survives the events above
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3 Ground
const FIGHTER = Cards.units.jtl.phoenixSquadronAWing; // a Space body, out of Bombing Run's way

function setup(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(CHAM)
    .TheirBase(Cards.bases.common.red30HP)     // Aggression, so the opponent's events cost printed
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(2)                        // the opponent acts; Cham reacts
    .WithInitiativePlayerBeing(1)
    .FillResourcesForPlayer(1, MARINE, resources)
    .FillResourcesForPlayer(2, MARINE, 8);
}

type Res = { type?: string; fromPlayIds?: string[] };
const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as Res;

/** The opponent plays Daring Raid (always at hand index 0 here) into the given target. */
async function enemyRaid(g: GameTestAdapter, target: () => Promise<unknown>) {
  await g.playCardFromHandAsync(2, 0);
  await target();
}

describe("HMW_013 Cham Syndulla — front: exhaust to answer non-combat damage", () => {
  it("an enemy event on your unit offers the reaction; taking it exhausts him and deals 1 back", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithCardInHandForPlayer(2, RAID)
      .WithGroundUnitForPlayer(1, CSF)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    await enemyRaid(g, () => g.chooseGroundUnitAsync(1, 0));
    expect(g.state.player1.groundArena[0].damage).toBe(2);

    expect(res(g).type).toBe("Option"); // "You may exhaust this leader…"
    await g.chooseYesAsync(1);
    // "An ENEMY unit or base" — only the opponent's board, never his own damaged unit.
    expect([...(res(g).fromPlayIds ?? [])].sort())
      .toEqual([g.state.player2.groundArena[0].playId, "player2.base"].sort());
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false); // the exhaust is the cost
  });

  it("the answering damage may go at the enemy base instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(2, RAID).WithGroundUnitForPlayer(1, CSF).Build());

    await enemyRaid(g, () => g.chooseGroundUnitAsync(1, 0));
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("declining costs nothing — he stays ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithCardInHandForPlayer(2, RAID)
      .WithGroundUnitForPlayer(1, CSF)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    await enemyRaid(g, () => g.chooseGroundUnitAsync(1, 0));
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("damage to your BASE counts as well", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(2, RAID).Build());

    await enemyRaid(g, () => g.chooseBaseAsync(2, 1));
    expect(g.state.player1.base.damage).toBe(2);

    expect(res(g).type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("COMBAT damage doesn't — neither to a unit nor to the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(1, CSF)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);          // 3 combat damage onto his unit
    expect(g.state.player1.groundArena[0].damage).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();

    await g.dispatchAsync(1, "pass-action", {});
    // The first Marine traded itself into the 3/7, so the second one is now at index 0.
    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);                // 3 combat damage onto his base

    expect(g.state.player1.base.damage).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("damage dealt to the ENEMY side doesn't — it's the victim that matters, not the dealer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithActivePlayer(1)
      .WithCardInHandForPlayer(1, RAID)
      .WithGroundUnitForPlayer(2, CSF)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("a Shield that swallows the hit means no damage was dealt — no trigger", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithCardInHandForPlayer(2, RAID)
      .WithGroundUnitForPlayer(1, CSF)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        { cardId: Cards.upgrades.token.shield, playId: "@", owner: 1, controller: 1 },
      ])
      .Build());

    await enemyRaid(g, () => g.chooseGroundUnitAsync(1, 0));

    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0); // the Shield was spent
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("an already exhausted leader can't pay, so he isn't even offered", async () => {
    const g = new GameTestAdapter();
    const s = setup().WithCardInHandForPlayer(2, RAID).WithGroundUnitForPlayer(1, CSF).Build();
    s.player1.leader.ready = false;
    g.loadNewState(s);

    await enemyRaid(g, () => g.chooseGroundUnitAsync(1, 0));

    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("not while leaders lose their abilities (Brain Invaders)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithCardInHandForPlayer(2, RAID)
      .WithGroundUnitForPlayer(1, CSF)
      .WithGroundUnitForPlayer(2, Cards.units.twi.brainInvaders)
      .Build());

    await enemyRaid(g, () => g.chooseGroundUnitAsync(1, 0));

    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("one trigger per damaged unit — but only the first can pay the exhaust", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithCardInHandForPlayer(2, BOMBING)
      .WithGroundUnitForPlayer(1, CSF)
      .WithGroundUnitForPlayer(1, CSF)
      .WithSpaceUnitForPlayer(2, FIGHTER)   // out of the ground blast, and a target to answer with
      .Build());

    await g.playCardFromHandAsync(2, 0);
    await g.chooseYesAsync(2);              // Ground
    expect(g.state.player1.groundArena.map(u => u.damage)).toEqual([3, 3]);

    expect(res(g).type).toBe("Option");     // the first of two
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);
    expect(g.state.player2.spaceArena[0].damage).toBe(1);

    // The second trigger is still waiting, but Cham is exhausted now and lapses with it.
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.spaceArena[0].damage).toBe(1);
  });

  it("the regroup phase's empty-deck penalty is non-combat damage to your own base — it triggers him", async () => {
    const g = new GameTestAdapter();
    const s = setup()
      .WithActivePlayer(1)
      .WithCardInDeckForPlayer(2, MARINE)
      .WithCardInDeckForPlayer(2, MARINE)
      .Build();
    s.player1.deck = []; // 2 cards he can't draw: 6 damage to his own base
    g.loadNewState(s);

    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.player1.base.damage).toBe(6);
    expect(res(g).type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
    expect(g.state.gamePhase).toBe("RegroupResource");
  });

  it("deploys with 6 resources, not 5", async () => {
    const five = new GameTestAdapter();
    five.loadNewState(setup(5).WithActivePlayer(1).Build());
    await five.deployLeaderAsync(1);
    expect(five.state.player1.leader.deployed).toBe(false);

    const six = new GameTestAdapter();
    six.loadNewState(setup(6).WithActivePlayer(1).Build());
    await six.deployLeaderAsync(1);
    expect(six.state.player1.leader.deployed).toBe(true);
    expect(six.state.player1.groundArena.some(u => u.cardId === CHAM)).toBe(true);
  });
});

describe("HMW_013 Cham Syndulla — deployed: the same reaction, for free", () => {
  const deployed = () => setup().MyLeader(CHAM, true, true).WithGroundUnitForPlayer(1, CHAM);

  it("costs no exhaust: he answers and is still ready to attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed()
      .WithCardInHandForPlayer(2, RAID)
      .WithGroundUnitForPlayer(1, CSF)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    await enemyRaid(g, () => g.chooseGroundUnitAsync(1, 1));
    expect(res(g).type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player1.groundArena.find(u => u.cardId === CHAM)!.ready).toBe(true);
  });

  it("damage onto Cham himself triggers it — he's a friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().WithCardInHandForPlayer(2, RAID).Build());

    await enemyRaid(g, () => g.chooseGroundUnitAsync(1, 0));
    expect(g.state.player1.groundArena[0].damage).toBe(2);

    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("deployed, both hits of a two-unit blast are answered — nothing has to be paid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed()
      .WithCardInHandForPlayer(2, BOMBING)
      .WithGroundUnitForPlayer(1, CSF)
      .Build());

    await g.playCardFromHandAsync(2, 0);
    await g.chooseYesAsync(2); // Ground — hits Cham and the CSF

    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("with the leader deployed and Cham dead, the reaction is gone", async () => {
    const g = new GameTestAdapter();
    const s = deployed().WithCardInHandForPlayer(2, RAID).WithGroundUnitForPlayer(1, CSF).Build();
    s.player1.groundArena = s.player1.groundArena.filter(u => u.cardId !== CHAM); // he was defeated
    g.loadNewState(s);

    await enemyRaid(g, () => g.chooseGroundUnitAsync(1, 0));

    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
