import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// HMW_010 Tarfful — Fighting from the Shadowlands (Leader; deployed 3/7 Ground, Rebel/Wookiee)
//   Leader:   "Action [2 resources, Exhaust, discard a card from your hand]: Create a Beast token."
//              "Epic Action: If you control 6 or more resources, deploy this leader."
//   Deployed: "Sentinel"
//             "On Attack: You may pay [1 resource]. If you do, create a Beast token."
//
// The leader Action has a THREE-part cost — resources, the exhaust, and a discard — and all three
// gate availability, so an empty hand makes it unusable however many resources you hold. The
// discard resolves as its own step before the token appears (the LAW_011 Darth Vader shape).
//
// Unlike Chewbacca and Hemlock, Tarfful's deployed side carries no Action, so there is no
// two-sides-one-cost conflict and the 2 resources can go through ActionAbilityCost normally.

const TARFFUL = Cards.leaders.hmw.tarfful;
const BEAST = Cards.units.token.beast;
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;

function setup(resources = 8, handCards = 2) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP) // Command
    .MyLeader(TARFFUL)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithActivePlayer(1);
  for (let i = 0; i < handCards; i++) b = b.WithCardInHandForPlayer(1, MARINE);
  return b;
}

const beasts = (g: GameTestAdapter) =>
  g.state.player1.groundArena.filter(u => u.cardId === BEAST);
const readyResources = (g: GameTestAdapter) =>
  g.state.player1.resources.filter(r => r.ready).length;

describe("HMW_010 Tarfful — Fighting from the Shadowlands", () => {
  describe("leader side — Action [2 resources, Exhaust, discard a card]", () => {
    it("creates a 3/3 Beast token, paying all three costs", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().Build());

      await g.useLeaderAbilityAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetIndices: [0] }); // the discard

      expect(beasts(g)).toHaveLength(1);
      const beast = Unit.FromInterface(beasts(g)[0]);
      expect(beast.CurrentPower()).toBe(3);
      expect(beast.TotalHP()).toBe(3);

      expect(readyResources(g)).toBe(6);                    // 8 - 2
      expect(g.state.player1.leader.ready).toBe(false);     // exhausted
      expect(g.state.player1.hand).toHaveLength(1);         // 2 - 1 discarded
      expect(g.state.player1.discard.map(c => c.cardId)).toEqual([MARINE]);
    });

    it("the Beast enters play exhausted, like every other token", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().Build());

      await g.useLeaderAbilityAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

      expect(beasts(g)[0].ready).toBe(false);
    });

    it("is unavailable with an EMPTY HAND — the discard is part of the cost", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(8, 0).Build());

      await g.useLeaderAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.leader.ready).toBe(true);
      expect(beasts(g)).toHaveLength(0);
    });

    it("is unavailable without 2 resources", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(1).Build());

      await g.useLeaderAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(beasts(g)).toHaveLength(0);
    });

    it("a Wartime Chancellor in play makes the Beast enter READY", async () => {
      // TWI_203: "Each token unit you create enters play ready." The Beast rides the same
      // spawnToken chokepoint as every other token, so this works with no Beast-specific code.
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, Cards.units.twi.wartimeChancellor).Build());

      await g.useLeaderAbilityAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

      expect(beasts(g)[0].ready).toBe(true);
    });
  });

  describe("deployed side", () => {
    async function deployed(builder: GameStateBuilder): Promise<GameTestAdapter> {
      const g = new GameTestAdapter();
      g.loadNewState(builder.Build());
      await g.deployLeaderAsync(1);
      await g.dispatchAsync(2, "pass-action", {});
      return g;
    }

    it("has Sentinel", async () => {
      const g = await deployed(setup());
      const tarfful = g.state.player1.groundArena.find(u => u.cardId === TARFFUL)!;

      expect(HasSentinel(tarfful.cardId, tarfful.playId, 1)).toBe(true);
    });

    it("On Attack: paying 1 creates a Beast", async () => {
      const g = await deployed(setup().WithGroundUnitForPlayer(2, CSF));
      const before = readyResources(g);
      const idx = g.state.player1.groundArena.findIndex(u => u.cardId === TARFFUL);

      await g.attackWithGroundUnitAsync(1, idx);
      await g.chooseBaseAsync(1, 2);
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseYesAsync(1);

      expect(beasts(g)).toHaveLength(1);
      expect(readyResources(g)).toBe(before - 1);
      expect(g.state.player2.base.damage).toBe(3); // the attack still landed
    });

    it("On Attack: declining costs nothing and creates nothing", async () => {
      const g = await deployed(setup().WithGroundUnitForPlayer(2, CSF));
      const before = readyResources(g);
      const idx = g.state.player1.groundArena.findIndex(u => u.cardId === TARFFUL);

      await g.attackWithGroundUnitAsync(1, idx);
      await g.chooseBaseAsync(1, 2);
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseNoAsync(1);

      expect(beasts(g)).toHaveLength(0);
      expect(readyResources(g)).toBe(before);
      expect(g.state.player2.base.damage).toBe(3);
    });

    it("On Attack: no prompt when the resource cannot be paid", async () => {
      // Deploying needs 6 resources, so they are spent down to 0 by resourcing them away is not
      // possible here — instead exhaust them all by attacking is not either. Use a fixture with
      // exactly the 6 needed to deploy, then drain them via the leader Action first.
      const g = await deployed(setup(6));
      // Spend every ready resource so the optional pay has nothing to draw on.
      for (const r of g.state.player1.resources) r.ready = false;
      const idx = g.state.player1.groundArena.findIndex(u => u.cardId === TARFFUL);

      await g.attackWithGroundUnitAsync(1, idx);
      await g.chooseBaseAsync(1, 2);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
      expect(beasts(g)).toHaveLength(0);
    });
  });

  it("Epic Action: deploys at 6 resources, spending none", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(6).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(readyResources(g)).toBe(6);
  });

  it("Epic Action: cannot deploy on 5 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(5).Build());

    await g.deployLeaderAsync(1);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.leader.deployed).toBe(false);
  });
});
