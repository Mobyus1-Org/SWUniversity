import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { playCost } from "@/server/engine/card-playability";
import { CardWasPlayedThisPhase, FriendlyUnitsEnteredPlayThisPhase } from "@/server/engine/core-functions";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";
import type { GameState } from "@/lib/engine/game";

// SEC_018 DJ — Need a Lift? (Leader, Cunning/Cunning; unit side 4/6 Ground)
//   Front: "Action [Exhaust]: Choose a friendly unit. If you do, play a unit from your hand. It costs
//           1 resource less. The chosen unit captures it. (When Played abilities resolve after the
//           unit is captured.) Epic Action: If you control 6 or more resources, deploy this leader."
//   Unit:  "Saboteur. Friendly units that are rescued enter play ready."
// A rescue is the unit entering play, so anything that makes a unit enter play ready (its own
// text, Ritual Dragon) applies too.

const DJ = Cards.leaders.sec.dj;
const SWOOP = Cards.units.sor.swoopRacer;           // 4/3, the captor
const BOUNCER = Cards.units.sor.cantinaBouncer;     // cost 5 Cunning×2 — WP: return a non-leader unit to hand
const VETERAN = Cards.units.shd.discerningVeteran;  // WP: THIS unit captures an enemy ground unit
const IG11 = Cards.units.shd.ig11;                  // can't be captured: defeated, 3 to each enemy ground unit
const JARJAR = Cards.units.twi.jarJarBinks;         // cost 2 Cunning×2, unique
const MARINE = Cards.units.sor.battlefieldMarine;
const WAMPA = Cards.units.sor.wampa;                // 4/5
const FALCON = Cards.units.sor.millenniumFalconSor; // "This unit enters play ready."

function board(resources = 14) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(DJ)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const exhaustedResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => !r.ready).length;
const swoop = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === SWOOP)!;

async function djPlays(g: GameTestAdapter, handIndex = 0) {
  await g.useLeaderAbilityAsync(1);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [swoop(g).playId] });
  await g.chooseCardFromHandAsync(1, handIndex);
}

function captive(state: GameState, holder: { captives: unknown[] }, cardId: string, owner: 1 | 2, playId: string) {
  void state;
  holder.captives.push({ cardId, playId, owner, controller: owner, ready: false, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false });
}

describe("SEC_018 DJ — aspects", () => {
  it("his two Cunning icons cover a Cunning×2 card", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    expect(playCost(g.state, 1, JARJAR)).toBe(2);
  });
});

describe("SEC_018 DJ — leader Action", () => {
  it("plays a unit for 1 less; the chosen friendly unit captures it, THEN its When Played resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, SWOOP).WithGroundUnitForPlayer(2, WAMPA).WithCardInHandForPlayer(1, BOUNCER).Build());

    await djPlays(g);

    expect(swoop(g).captives.map(c => c.cardId)).toEqual([BOUNCER]);
    expect(g.state.player1.groundArena.map(u => u.cardId)).not.toContain(BOUNCER);
    expect(exhaustedResources(g)).toBe(4);
    expect(g.state.player1.leader.ready).toBe(false);
    // Cantina Bouncer's When Played ("you may return…") still resolves after the capture.
    expect(res(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([WAMPA]);
  });

  it("a When Played about the played unit itself fizzles — it is out of play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, SWOOP).WithGroundUnitForPlayer(2, WAMPA).WithCardInHandForPlayer(1, VETERAN).Build());

    await djPlays(g);

    expect(swoop(g).captives.map(c => c.cardId)).toEqual([VETERAN]);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([WAMPA]);
    expect(res(g)).toBeFalsy();
  });

  it("plays a 2-cost for 1 with one ready resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(1).WithGroundUnitForPlayer(1, SWOOP).WithCardInHandForPlayer(1, JARJAR).Build());

    await djPlays(g);

    expect(swoop(g).captives.map(c => c.cardId)).toEqual([JARJAR]);
    expect(exhaustedResources(g)).toBe(1);
  });

  it("uniqueness first: defeating the new copy means nothing is captured", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, SWOOP).WithGroundUnitForPlayer(1, JARJAR).WithCardInHandForPlayer(1, JARJAR).Build());
    const oldCopy = g.state.player1.groundArena.find(u => u.cardId === JARJAR)!.playId;

    await djPlays(g);
    expect(res(g)?.type).toBe("Target"); // which copy to defeat
    const newCopy = g.state.player1.groundArena.find(u => u.cardId === JARJAR && u.playId !== oldCopy)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [newCopy] });

    expect(swoop(g).captives).toHaveLength(0);
    expect(g.state.player1.groundArena.find(u => u.cardId === JARJAR)!.playId).toBe(oldCopy);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(JARJAR);
  });

  it("uniqueness first: defeating the old copy, the new one is then captured", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, SWOOP).WithGroundUnitForPlayer(1, JARJAR).WithCardInHandForPlayer(1, JARJAR).Build());
    const oldCopy = g.state.player1.groundArena.find(u => u.cardId === JARJAR)!.playId;

    await djPlays(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [oldCopy] });

    expect(swoop(g).captives.map(c => c.cardId)).toEqual([JARJAR]);
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([SWOOP]);
  });

  it("IG-11 can't be captured: he is defeated and deals 3 to each enemy ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, SWOOP).WithGroundUnitForPlayer(2, WAMPA).WithCardInHandForPlayer(1, IG11).Build());

    await djPlays(g);

    expect(swoop(g).captives).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(IG11);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(exhaustedResources(g)).toBe(6); // 5 + 2 Aggression penalty – 1
  });

  it("the captured unit was still played, and entered play, this phase (CR 33.1)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, SWOOP).WithCardInHandForPlayer(1, JARJAR).Build());
    expect(CardWasPlayedThisPhase(1, undefined, "Unit")).toBe(false);

    await djPlays(g);

    expect(swoop(g).captives.map(c => c.cardId)).toEqual([JARJAR]);
    expect(CardWasPlayedThisPhase(1, undefined, "Unit")).toBe(true);
    expect(FriendlyUnitsEnteredPlayThisPhase(1)).toHaveLength(1);
  });

  it("…but once rescued it is a unit that wasn't played, so Hidden doesn't protect it (CR 33.3)", async () => {
    const g = new GameTestAdapter();
    const AURRA = Cards.units.lof.aurraSingPatientAndDeadly; // Hidden
    g.loadNewState(board().WithGroundUnitForPlayer(1, SWOOP).WithCardInHandForPlayer(1, AURRA)
      .WithGroundUnitForPlayer(2, Cards.units.ash.dinosaurTurtle).WithGroundUnitForPlayer(2, WAMPA).Build());

    await djPlays(g);
    // P2 defeats the captor: Aurra Sing is rescued.
    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [swoop(g).playId] });
    const aurra = g.state.player1.groundArena.find(u => u.cardId === AURRA)!;
    expect(aurra).toBeDefined();
    await g.dispatchAsync(1, "pass-action", {});

    await g.attackWithGroundUnitAsync(2, 1);
    const r = res(g);
    expect(r?.type === "Target" ? r.fromPlayIds : []).toContain(aurra.playId);
  });

  it("soft passes: no friendly unit, no unit in hand, or nothing affordable at 1 less", async () => {
    for (const state of [
      board().WithCardInHandForPlayer(1, BOUNCER).Build(),
      board().WithGroundUnitForPlayer(1, SWOOP).WithCardInHandForPlayer(1, Cards.events.shd.pillage).Build(),
      board(3).WithGroundUnitForPlayer(1, SWOOP).WithCardInHandForPlayer(1, BOUNCER).Build(),
    ]) {
      const g = new GameTestAdapter();
      g.loadNewState(state);
      await g.useLeaderAbilityAsync(1);
      expect(res(g)).toBeFalsy();
      expect(g.state.player1.leader.ready).toBe(false);
      expect(g.state.player1.hand).toHaveLength(1);
    }
  });
});

describe("SEC_018 DJ — deployed", () => {
  function deployedBoard() {
    return board().MyLeader(DJ, true, true, true).WithGroundUnitForPlayer(1, DJ);
  }

  it("has Saboteur, and deploys at 6 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6).Build());
    await g.deployLeaderAsync(1);
    const dj = g.state.player1.groundArena.find(u => u.cardId === DJ)!;
    expect(HasSaboteur(DJ, dj.playId, 1)).toBe(true);

    const five = new GameTestAdapter();
    five.loadNewState(board(5).Build());
    await five.deployLeaderAsync(1);
    expect(five.state.player1.leader.deployed).toBeFalsy();
  });

  it("a friendly unit rescued from an ENEMY captor (the captor leaves play) enters ready", async () => {
    const g = new GameTestAdapter();
    const state = deployedBoard().WithGroundUnitForPlayer(1, Cards.units.ash.dinosaurTurtle).WithGroundUnitForPlayer(2, WAMPA).Build();
    captive(state, state.player2.groundArena[0], MARINE, 1, "cap1");
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.ash.dinosaurTurtle));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    const rescued = g.state.player1.groundArena.find(u => u.playId === "cap1")!;
    expect(rescued).toBeDefined();
    expect(rescued.ready).toBe(true);
  });

  it("a friendly unit rescued by L3-37 from a FRIENDLY captor enters ready", async () => {
    const g = new GameTestAdapter();
    const state = deployedBoard().WithGroundUnitForPlayer(1, SWOOP).WithCardInHandForPlayer(1, Cards.units.shd.l337).Build();
    captive(state, state.player1.groundArena.find(u => u.cardId === SWOOP)!, MARINE, 1, "cap1");
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.groundArena.find(u => u.playId === "cap1")!.ready).toBe(true);
  });

  it("a friendly unit rescued from a BASE captor enters ready", async () => {
    const g = new GameTestAdapter();
    const state = deployedBoard().WithCardInHandForPlayer(1, Cards.units.shd.l337).Build();
    state.player2.base.captives = [];
    captive(state, state.player2.base as unknown as { captives: unknown[] }, MARINE, 1, "cap1");
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.groundArena.find(u => u.playId === "cap1")!.ready).toBe(true);
  });

  it("an ENEMY unit rescued from a friendly captor is not readied", async () => {
    const g = new GameTestAdapter();
    const state = deployedBoard().WithGroundUnitForPlayer(1, SWOOP).WithGroundUnitForPlayer(2, Cards.units.ash.dinosaurTurtle).WithActivePlayer(2).Build();
    captive(state, state.player1.groundArena.find(u => u.cardId === SWOOP)!, MARINE, 2, "cap2");
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [swoop(g).playId] });

    expect(g.state.player2.groundArena.find(u => u.playId === "cap2")!.ready).toBe(false);
  });

  it("control: without DJ deployed, a rescued unit enters exhausted — unless it enters play ready itself", async () => {
    const g = new GameTestAdapter();
    const state = board().WithGroundUnitForPlayer(1, Cards.units.ash.dinosaurTurtle).WithGroundUnitForPlayer(2, WAMPA).Build();
    captive(state, state.player2.groundArena[0], MARINE, 1, "cap1");
    captive(state, state.player2.groundArena[0], FALCON, 1, "cap2");
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena.find(u => u.playId === "cap1")!.ready).toBe(false);
    expect(g.state.player1.spaceArena.find(u => u.playId === "cap2")!.ready).toBe(true);
  });
});
