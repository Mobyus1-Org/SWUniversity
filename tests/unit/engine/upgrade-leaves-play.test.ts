import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Where an upgrade GOES when it leaves play.
//
// Units have one chokepoint for this (removeFromArena + pushToDiscard, with an explicit
// leader-zone branch). Upgrades had none, so every removal site invented its own destination —
// and none of them handled the discard or the leader zone. The visible symptom was a pilot leader
// vanishing from the game entirely, but a plain upgrade never reaching the discard is the same
// defect: discard-count abilities (Palpatine's Return, Doctor Aphra) silently under-count.
//
// The rules being asserted:
//   • a leader card can only be in the leader zone or in play — never hand, deck or discard.
//     Leaving play as an upgrade returns it to the leader zone EXHAUSTED.
//   • a token upgrade is set aside, not discarded (CR 7.6.1).
//   • anything else goes to its OWNER's discard.

const PILOT_LEADER = Cards.leaders.jtl.darthVader; // JTL_006 — deploys as a pilot, no immunity
const EXPERIENCE = Cards.upgrades.token.experience;

/** P1 has a pilot leader available; P2 holds `p2Card` and has the turn after P1 deploys. */
function board(p2Card?: string) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(PILOT_LEADER, true, false)
    .TheirBase(Cards.bases.common.red30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14)
    .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter);
  if (p2Card) b = b.WithCardInHandForPlayer(2, p2Card);
  return b;
}

/** Deploys P1's leader onto their TIE as a Pilot upgrade. Returns that upgrade's playId. */
async function deployAsPilot(g: GameTestAdapter): Promise<string> {
  await g.deployLeaderAsync(1);
  await g.chooseOptionAsync(1, "Deploy as Pilot");
  await g.choosePilotVehicleSpaceAsync(1, 0);
  return g.state.player1.spaceArena[0].upgrades[0].playId;
}

const handOf = (g: GameTestAdapter, p: 1 | 2) => g.state[`player${p}`].hand.map(c => c.cardId);
const discardOf = (g: GameTestAdapter, p: 1 | 2) => g.state[`player${p}`].discard.map(c => c.cardId);

describe("an upgrade leaving play — where the card goes", () => {
  it("a defeated plain upgrade goes to its OWNER's discard", async () => {
    const g = new GameTestAdapter();
    const s = board(Cards.units.sec.outerRimConstable).WithActivePlayer(2).Build();
    s.player1.spaceArena[0].upgrades.push({
      cardId: Cards.upgrades.sor.hardpointHeavyBlaster, playId: "99", owner: 1, controller: 1,
    });
    g.loadNewState(s);

    await g.playCardFromHandAsync(2, 0);
    await g.chooseYesAsync(2);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: ["99"] });

    expect(g.state.player1.spaceArena[0].upgrades.length).toBe(0);
    expect(discardOf(g, 1)).toContain(Cards.upgrades.sor.hardpointHeavyBlaster);
    expect(discardOf(g, 2)).not.toContain(Cards.upgrades.sor.hardpointHeavyBlaster);
  });

  // Shields and Experience are TOKENS: they are set aside when they leave play, never discarded.
  // Covered per-token rather than letting one stand in for the others, since IsTokenUpgrade gates
  // on CardType and the card API is documented as inconsistent about token fields.
  const TOKEN_UPGRADES: [string, string][] = [
    ["Experience", EXPERIENCE],
    ["Shield", "SOR_T02"],
    ["Advantage", "ASH_T02"],
  ];

  for (const [label, tokenId] of TOKEN_UPGRADES) {
    it(`a defeated ${label} token is set aside, not discarded`, async () => {
      const g = new GameTestAdapter();
      const s = board(Cards.units.sec.outerRimConstable).WithActivePlayer(2).Build();
      s.player1.spaceArena[0].upgrades.push({ cardId: tokenId, playId: "99", owner: 1, controller: 1 });
      g.loadNewState(s);

      await g.playCardFromHandAsync(2, 0);
      await g.chooseYesAsync(2);
      await g.dispatchAsync(2, "choose-target", { targetPlayIds: ["99"] });

      expect(g.state.player1.spaceArena[0].upgrades.length).toBe(0);
      expect(discardOf(g, 1)).not.toContain(tokenId);
      expect(discardOf(g, 2)).not.toContain(tokenId);
      expect(handOf(g, 1)).not.toContain(tokenId);
    });

    it(`a ${label} token on a defeated unit is set aside, not discarded`, async () => {
      const g = new GameTestAdapter();
      const s = board(Cards.events.shd.rivalsFall).WithActivePlayer(2).Build();
      s.player1.spaceArena[0].upgrades.push({ cardId: tokenId, playId: "99", owner: 1, controller: 1 });
      g.loadNewState(s);

      await g.playCardFromHandAsync(2, 0);
      await g.chooseSpaceUnitAsync(1, 0);

      // The ship discards; the token does not.
      expect(discardOf(g, 1)).toContain(Cards.units.sor.tieLnFighter);
      expect(discardOf(g, 1)).not.toContain(tokenId);
      expect(handOf(g, 1)).not.toContain(tokenId);
    });
  }

  it("a defeated pilot LEADER upgrade returns to the leader zone exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(Cards.units.sec.outerRimConstable).Build());

    const upgId = await deployAsPilot(g);
    await g.playCardFromHandAsync(2, g.state.player2.hand.findIndex(c => c.cardId === Cards.units.sec.outerRimConstable));
    await g.chooseYesAsync(2);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [upgId] });

    const leader = g.state.player1.leader;
    expect(leader.deployed).toBe(false);
    expect(leader.ready).toBe(false);          // returns EXHAUSTED
    expect(leader.deployedPlayId).toBeUndefined();
    expect(leader.cardId).toBe(PILOT_LEADER);
    // A leader card may never sit in hand or discard.
    expect(handOf(g, 1)).not.toContain(PILOT_LEADER);
    expect(discardOf(g, 1)).not.toContain(PILOT_LEADER);
  });

  it("the leader returns to the zone when the ship carrying him is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(Cards.events.shd.rivalsFall).Build());

    await deployAsPilot(g);
    await g.playCardFromHandAsync(2, g.state.player2.hand.findIndex(c => c.cardId === Cards.events.shd.rivalsFall));
    await g.chooseSpaceUnitAsync(1, 0);

    const leader = g.state.player1.leader;
    expect(leader.deployed).toBe(false);
    expect(leader.ready).toBe(false);
    expect(leader.deployedPlayId).toBeUndefined();
    expect(handOf(g, 1)).not.toContain(PILOT_LEADER);
    expect(discardOf(g, 1)).not.toContain(PILOT_LEADER);
    // The ship itself still discards normally.
    expect(discardOf(g, 1)).toContain(Cards.units.sor.tieLnFighter);
  });

  describe("Bamboozle (SOR_199) — 'return each upgrade on it to its owner's hand'", () => {
    it("bounces a plain upgrade to its owner's hand", async () => {
      const g = new GameTestAdapter();
      const s = board(Cards.events.sor.bamboozle).WithActivePlayer(2).Build();
      s.player1.spaceArena[0].upgrades.push({
        cardId: Cards.upgrades.sor.hardpointHeavyBlaster, playId: "99", owner: 1, controller: 1,
      });
      g.loadNewState(s);

      await g.playCardFromHandAsync(2, 0);
      await g.chooseSpaceUnitAsync(1, 0);

      expect(handOf(g, 1)).toContain(Cards.upgrades.sor.hardpointHeavyBlaster);
      expect(g.state.player1.spaceArena[0].ready).toBe(false); // and it exhausts the unit
    });

    it("cannot bounce a pilot LEADER to hand — it is defeated to the leader zone instead", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(Cards.events.sor.bamboozle).Build());

      await deployAsPilot(g);
      await g.playCardFromHandAsync(2, g.state.player2.hand.findIndex(c => c.cardId === Cards.events.sor.bamboozle));
      await g.chooseSpaceUnitAsync(1, 0);

      const leader = g.state.player1.leader;
      expect(handOf(g, 1)).not.toContain(PILOT_LEADER); // never lands in hand
      expect(leader.deployed).toBe(false);
      expect(leader.ready).toBe(false);
      expect(leader.deployedPlayId).toBeUndefined();
    });

    it("bypasses Luke JTL_012's can't-be-defeated immunity, since it is not a defeat effect", async () => {
      const g = new GameTestAdapter();
      const s = new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.jtl.lukeSkywalker, true, false) // JTL_012 — immune to enemy DEFEAT
        .TheirBase(Cards.bases.common.yellow30HP)
        .TheirLeader(Cards.leaders.sor.hanSolo)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .WithCardInHandForPlayer(2, Cards.events.sor.bamboozle)
        .Build();
      g.loadNewState(s);

      await g.deployLeaderAsync(1);
      await g.chooseOptionAsync(1, "Deploy as Pilot");
      await g.choosePilotVehicleSpaceAsync(1, 0);

      await g.playCardFromHandAsync(2, g.state.player2.hand.findIndex(c => c.cardId === Cards.events.sor.bamboozle));
      await g.chooseSpaceUnitAsync(1, 0);

      const leader = g.state.player1.leader;
      expect(g.state.player1.spaceArena[0].upgrades.length).toBe(0); // he does come off
      expect(handOf(g, 1)).not.toContain(Cards.leaders.jtl.lukeSkywalker);
      expect(leader.deployed).toBe(false);
      expect(leader.ready).toBe(false);
      expect(leader.deployedPlayId).toBeUndefined();
    });

    it("control: an enemy DEFEAT effect still cannot touch Luke JTL_012", async () => {
      const g = new GameTestAdapter();
      const s = new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.jtl.lukeSkywalker, true, false)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .WithCardInHandForPlayer(2, Cards.units.sec.outerRimConstable)
        .Build();
      g.loadNewState(s);

      await g.deployLeaderAsync(1);
      await g.chooseOptionAsync(1, "Deploy as Pilot");
      await g.choosePilotVehicleSpaceAsync(1, 0);

      await g.playCardFromHandAsync(2, g.state.player2.hand.findIndex(c => c.cardId === Cards.units.sec.outerRimConstable));

      // Luke is not even offered as a target, so the ability finds nothing to defeat.
      expect(g.state.player1.spaceArena[0].upgrades.some(u => u.cardId === Cards.leaders.jtl.lukeSkywalker)).toBe(true);
      expect(g.state.player1.leader.deployed).toBe(true);
    });
  });
});
