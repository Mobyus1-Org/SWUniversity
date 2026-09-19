import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_232 Jump to Lightspeed (Event, cost 2, Cunning)
//   "Return a friendly space unit and any number of non-leader upgrades on it to their owners'
//    hands. The next time you play a copy of that unit this phase, you may play it for free."
//
// A "copy" shares title AND subtitle, so a reprint counts and a different Millennium Falcon doesn't.
// The upgrades not chosen are defeated with the unit as it leaves play.

const JUMP = Cards.events.jtl.jumpToLightspeed;
const YWING = Cards.units.ibh.rebellionYWing;          // cost 3, Cunning/Heroism — no penalty here
const YWING_REPRINT = Cards.units.ibh.rebellionYWingB; // same title, no subtitle, different id
const AWING = Cards.units.jtl.phoenixSquadronAWing;    // cost 2, Command/Heroism — 4 with the penalty
const FALCON = Cards.units.jtl.millenniumFalcon;       // Get Out And Push
const OTHER_FALCON = Cards.units.law.millenniumFalconDodgingPatrols;
const MARINE = Cards.units.sor.battlefieldMarine;
const ENTRENCHED = Cards.upgrades.sor.entrenched;
const BLASTER = Cards.upgrades.sor.hardpointHeavyBlaster;
const SHIELD = Cards.upgrades.token.shield;
const XP = Cards.upgrades.token.experience;
const up = GameStateBuilder.Upgrade;

function base(resources = 10) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)          // Cunning
    .MyLeader(Cards.leaders.sor.sabineWren)          // Aggression/Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithInitiativePlayerBeing(1)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithCardInHandForPlayer(1, JUMP);
}

type TargetRes = { type?: string; fromPlayIds?: string[]; needsMultiple?: boolean; maxTargets?: number };
const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as TargetRes;
const readyResources = (g: GameTestAdapter, p: 1 | 2 = 1) =>
  (p === 1 ? g.state.player1 : g.state.player2).resources.filter(r => r.ready).length;
/** Player 1's discard, minus the Jump to Lightspeed that was just played. */
const discardIds = (g: GameTestAdapter) => g.state.player1.discard.map(d => d.cardId).filter(id => id !== JUMP);
const handIds = (g: GameTestAdapter, p: 1 | 2 = 1) => (p === 1 ? g.state.player1 : g.state.player2).hand.map(c => c.cardId);

describe("JTL_232 Jump to Lightspeed — the return", () => {
  it("returns a friendly space unit to its owner's hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, YWING).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(handIds(g)).toEqual([YWING]);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy(); // no upgrades → no second step
  });

  it("only friendly space units are offered — not ground units, not enemy units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, YWING)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithSpaceUnitForPlayer(2, AWING)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(res(g).fromPlayIds).toEqual([g.state.player1.spaceArena[0].playId]);
  });

  it("with no friendly space unit, nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(2, AWING).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player2.spaceArena).toHaveLength(1);
  });

  it("offers the unit's non-leader, non-token upgrades as one multi-select; the chosen go to hand, the rest are defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, YWING)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(ENTRENCHED, 1), up(BLASTER, 1), up(SHIELD, 1), up(XP, 1)])
      .Build());
    const [entrenched, blaster] = g.state.player1.spaceArena[0].upgrades.map(u => u.playId);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    const r = res(g);
    expect(r.type).toBe("Target");
    expect(r.needsMultiple).toBe(true);
    expect([...(r.fromPlayIds ?? [])].sort()).toEqual([entrenched, blaster].sort());

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [entrenched] });

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect([...handIds(g)].sort()).toEqual([ENTRENCHED, YWING].sort());
    expect(discardIds(g)).toEqual([BLASTER]); // tokens just leave the game
  });

  it("choosing no upgrades returns only the unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, YWING)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(ENTRENCHED, 1)])
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    const after = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(after.lastDispatchResponse?.invalidAction).toBeFalsy();
    expect(handIds(g)).toEqual([YWING]);
    expect(discardIds(g)).toEqual([ENTRENCHED]);
  });

  it("an upgrade the opponent owns goes to the opponent's hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, YWING)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(ENTRENCHED, 1, 2)]) // on my unit, owned by P2
      .Build());
    const entrenched = g.state.player1.spaceArena[0].upgrades[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [entrenched] });

    expect(handIds(g)).toEqual([YWING]);
    expect(handIds(g, 2)).toEqual([ENTRENCHED]);
  });

  it("a Vehicle with a leader Pilot can be returned; the leader goes back to its zone, exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, AWING)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(Cards.leaders.jtl.lukeSkywalker, 1)])
      .Build());
    // Luke is our leader for this test: seat him as the pilot of the A-Wing.
    g.state.player1.leader.cardId = Cards.leaders.jtl.lukeSkywalker;
    g.state.player1.leader.deployed = true;
    g.state.player1.leader.deployedPlayId = g.state.player1.spaceArena[0].upgrades[0].playId;

    await g.playCardFromHandAsync(1, 0);
    expect(res(g).fromPlayIds).toEqual([g.state.player1.spaceArena[0].playId]);
    await g.chooseSpaceUnitAsync(1, 0); // the leader isn't offered, so there's no upgrade step

    expect(handIds(g)).toEqual([AWING]);
    expect(g.state.player1.leader.deployed).toBe(false);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("a token host is set aside, and a chosen upgrade on it still returns to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, Cards.units.token.xWing)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(ENTRENCHED, 1)])
      .Build());
    const entrenched = g.state.player1.spaceArena[0].upgrades[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [entrenched] });

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(handIds(g)).toEqual([ENTRENCHED]);
  });

  it("the returned unit left play this phase (it's in the left-play ledger as returned to hand)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, YWING).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.roundState.cardsLeftPlayThisPhase).toEqual([
      expect.objectContaining({ fromPlayer: 1, cardId: YWING, reason: "returned-to-hand" }),
    ]);
  });
});

describe("JTL_232 Jump to Lightspeed — the free copy", () => {
  async function bounce(g: GameTestAdapter, unit: string, extraHand: string[] = [], resources = 10) {
    const b = base(resources).WithSpaceUnitForPlayer(1, unit);
    for (const c of extraHand) b.WithCardInHandForPlayer(1, c);
    g.loadNewState(b.Build());
    await g.playCardFromHandAsync(1, 0); // Jump is hand[0]
    await g.chooseSpaceUnitAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const handIndexOf = (g: GameTestAdapter, cardId: string) => g.state.player1.hand.findIndex(c => c.cardId === cardId);

  it("the next copy costs nothing — aspect penalty included", async () => {
    const g = new GameTestAdapter();
    await bounce(g, AWING);
    expect(readyResources(g)).toBe(8); // 10 − Jump's 2

    await g.playCardFromHandAsync(1, handIndexOf(g, AWING)); // normally 2 + 2 penalty = 4

    expect(g.state.player1.spaceArena.some(u => u.cardId === AWING)).toBe(true);
    expect(readyResources(g)).toBe(8);
  });

  it("it's free even when you couldn't otherwise afford it", async () => {
    const g = new GameTestAdapter();
    await bounce(g, YWING, [], 2); // 0 left after Jump

    await g.playCardFromHandAsync(1, handIndexOf(g, YWING));

    expect(g.state.player1.spaceArena.some(u => u.cardId === YWING)).toBe(true);
  });

  it("a reprint of the same card (same title and subtitle) is a copy", async () => {
    const g = new GameTestAdapter();
    await bounce(g, YWING, [YWING_REPRINT]);

    await g.playCardFromHandAsync(1, handIndexOf(g, YWING_REPRINT));

    expect(g.state.player1.spaceArena.some(u => u.cardId === YWING_REPRINT)).toBe(true);
    expect(readyResources(g)).toBe(8);
  });

  it("only once: the second copy costs full price", async () => {
    const g = new GameTestAdapter();
    await bounce(g, YWING, [YWING_REPRINT]);

    await g.playCardFromHandAsync(1, handIndexOf(g, YWING));        // free
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, handIndexOf(g, YWING_REPRINT)); // 3

    expect(readyResources(g)).toBe(5);
  });

  it("a different card with the same title isn't a copy", async () => {
    const g = new GameTestAdapter();
    await bounce(g, FALCON, [OTHER_FALCON]);

    await g.playCardFromHandAsync(1, handIndexOf(g, OTHER_FALCON)); // 3 + Command penalty 2

    expect(g.state.player1.spaceArena.some(u => u.cardId === OTHER_FALCON)).toBe(true);
    expect(readyResources(g)).toBe(3);
  });

  it("the opponent's copy isn't free", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithSpaceUnitForPlayer(1, YWING)
      .WithCardInHandForPlayer(2, YWING)
      .FillResourcesForPlayer(2, MARINE, 10)
      .Build();
    s.player2.base.cardId = Cards.bases.common.yellow30HP; // Cunning, so P2 pays the printed 3
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.playCardFromHandAsync(2, 0);

    expect(g.state.player2.spaceArena.some(u => u.cardId === YWING)).toBe(true);
    expect(readyResources(g, 2)).toBe(7);
  });

  it("only this phase: in the next action phase the copy costs full price", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithSpaceUnitForPlayer(1, YWING)
      .WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, MARINE)
      .WithCardInDeckForPlayer(2, MARINE).WithCardInDeckForPlayer(2, MARINE)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});
    await g.passResourceAsync(1);
    await g.passResourceAsync(2);
    expect(g.state.gamePhase).toBe("ActionPhase");
    expect(readyResources(g)).toBe(10);

    await g.playCardFromHandAsync(1, handIndexOf(g, YWING));

    expect(readyResources(g)).toBe(7);
  });
});
