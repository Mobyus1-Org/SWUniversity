import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { CardIsPlayable, JUMP_TO_LIGHTSPEED_FREE } from "@/server/engine/card-playability";

// HMW_049 Greater Sarlacc (9/8 Ground, cost 9, Command/Cunning, Creature)
//   Overwhelm
//   While playing this unit, you may defeat any number of ready resources you control. For each
//   resource defeated this way, this unit costs 3 resources less to play.
//
// Each defeated ready resource is one fewer resource to pay with but 3 off the cost, so a play is
// affordable at k defeats when ready - k >= 9 - 3k. The player picks how many (the legal range),
// then picks each resource. Green base (Command) + Han Solo (Cunning) = no aspect penalty.
const SARLACC = Cards.units.hmw.greaterSarlacc;
const RESOURCE = Cards.units.sor.battlefieldMarine;
const ENEMY = Cards.units.sor.battlefieldMarine; // 3/3

function setup(ready: number, exhausted = 0) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.hanSolo)
    .TheirBase(Cards.bases.common.blue30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, RESOURCE, ready)
    .FillResourcesForPlayer(1, RESOURCE, exhausted, false)
    .WithCardInHandForPlayer(1, SARLACC)
    .WithActivePlayer(1);
}

const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const options = (g: GameTestAdapter) => {
  const r = needs(g);
  return r?.type === "Option" ? r.options : undefined;
};
const offered = (g: GameTestAdapter) => {
  const r = needs(g);
  return r?.type === "Target" ? (r.fromPlayIds ?? []) : undefined;
};
const sarlacc = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === SARLACC);
const readyCount = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const pickResource = (g: GameTestAdapter, i = 0) =>
  g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.resources.filter(r => r.ready)[i].playId] });

describe("HMW_049 Greater Sarlacc", () => {
  it("has Overwhelm", () => {
    expect(HasOverwhelm(SARLACC)).toBe(true);
  });

  it("Overwhelm: excess damage on an enemy unit spills to the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(0).WithGroundUnitForPlayer(1, SARLACC).WithGroundUnitForPlayer(2, ENEMY).Build());
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(6); // 9 power into a 3/3
  });

  describe("playability", () => {
    it("is playable with too few resources only because resources can be defeated", () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(5).Build());
      expect(CardIsPlayable(g.state, 1, SARLACC)).toBe(true); // 5 - 2 >= 9 - 6
      g.loadNewState(setup(3).Build());
      expect(CardIsPlayable(g.state, 1, SARLACC)).toBe(true); // 3 - 3 >= 9 - 9
    });

    it("is not playable when no number of defeats covers the cost", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(2, 10).Build()); // exhausted resources can't be defeated for it
      expect(CardIsPlayable(g.state, 1, SARLACC)).toBe(false);
      await g.playCardFromHandAsync(1, 0);
      expect(sarlacc(g)).toBeUndefined();
      expect(g.state.player1.hand.map(c => c.cardId)).toContain(SARLACC);
      expect(g.state.player1.resources).toHaveLength(12);
    });
  });

  describe("playing it", () => {
    it("asks how many to defeat, 0 up to the most that still lowers the cost", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(12).Build());
      await g.playCardFromHandAsync(1, 0);
      expect(options(g)).toEqual(["0", "1", "2", "3"]);
      expect(sarlacc(g)).toBeUndefined();
    });

    it("choosing 0 pays the full cost and defeats nothing", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(12).Build());
      await g.playCardFromHandAsync(1, 0);
      expect(needs(g)?.type).toBe("Option");
      await g.chooseOptionAsync(1, "0");

      expect(sarlacc(g)).toBeDefined();
      expect(g.state.player1.resources).toHaveLength(12);
      expect(readyCount(g)).toBe(3);
      expect(g.state.player1.discard).toHaveLength(0);
      expect(needs(g)).toBeFalsy();
    });

    it("choosing 2 has the player pick each of 2 ready resources, then pays 9 - 6", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(10, 2).Build());
      const exhaustedIds = g.state.player1.resources.filter(r => !r.ready).map(r => r.playId);
      await g.playCardFromHandAsync(1, 0);
      await g.chooseOptionAsync(1, "2");

      // First pick: only READY resources are offered.
      expect(offered(g)).toHaveLength(10);
      for (const id of exhaustedIds) expect(offered(g)).not.toContain(id);
      const first = g.state.player1.resources.filter(r => r.ready)[0].playId;
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [first] });
      expect(sarlacc(g)).toBeUndefined(); // still picking
      expect(offered(g)).toHaveLength(9);
      expect(offered(g)).not.toContain(first);
      await pickResource(g);

      expect(sarlacc(g)).toBeDefined();
      expect(g.state.player1.resources).toHaveLength(10);
      expect(g.state.player1.discard.filter(c => c.cardId === RESOURCE)).toHaveLength(2);
      expect(readyCount(g)).toBe(8 - 3); // 8 ready left after defeats, 3 paid
      expect(needs(g)).toBeFalsy();
    });

    it("an exhausted resource named by the client is refused", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(10, 1).Build());
      await g.playCardFromHandAsync(1, 0);
      await g.chooseOptionAsync(1, "1");
      const exhausted = g.state.player1.resources.find(r => !r.ready)!.playId;
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [exhausted] });
      expect(g.state.player1.resources).toHaveLength(11);
      expect(sarlacc(g)).toBeUndefined();
      // Still waiting for a legal pick: a ready one completes the play.
      await pickResource(g);
      expect(sarlacc(g)).toBeDefined();
      expect(g.state.player1.resources).toHaveLength(10);
      expect(g.state.player1.resources.find(r => r.playId === exhausted)).toBeDefined();
    });

    it("when it can't be afforded without defeating, 0 is not offered", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(5).Build());
      await g.playCardFromHandAsync(1, 0);
      expect(options(g)).toEqual(["2", "3"]);
      await g.chooseOptionAsync(1, "2");
      await pickResource(g);
      await pickResource(g);

      expect(sarlacc(g)).toBeDefined();
      expect(g.state.player1.resources).toHaveLength(3);
      expect(readyCount(g)).toBe(0); // 9 - 6 = 3 paid from the 3 left
    });

    it("defeating 3 makes it free", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(5).Build());
      await g.playCardFromHandAsync(1, 0);
      await g.chooseOptionAsync(1, "3");
      await pickResource(g);
      await pickResource(g);
      await pickResource(g);

      expect(sarlacc(g)).toBeDefined();
      expect(g.state.player1.resources).toHaveLength(2);
      expect(readyCount(g)).toBe(2);
    });

    it("with exactly one legal number there is no count prompt — straight to the picks", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(3).Build());
      await g.playCardFromHandAsync(1, 0);
      expect(needs(g)?.type).toBe("Target");
      await pickResource(g);
      await pickResource(g);
      await pickResource(g);

      expect(sarlacc(g)).toBeDefined();
      expect(g.state.player1.resources).toHaveLength(0);
    });

    it("Credits count toward the remainder", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(3).WithCreditsForPlayer(1, 2).Build());
      await g.playCardFromHandAsync(1, 0);
      expect(options(g)).toEqual(["2", "3"]); // 3 ready + 2 Credits: 5 - 2 >= 9 - 6
      await g.chooseOptionAsync(1, "2");
      await pickResource(g);
      await pickResource(g);

      expect(sarlacc(g)).toBeDefined();
      expect(g.state.player1.resources).toHaveLength(1);
      expect(readyCount(g)).toBe(0);
      expect(g.state.player1.supplemental.creditTokens ?? 0).toBe(0);
    });

    it("no prompt when its cost is already 0 another way", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup(4)
          .WithCurrentEffect({ cardId: `${JUMP_TO_LIGHTSPEED_FREE}${SARLACC}`, duration: "Phase", affectedPlayer: 1 })
          .Build(),
      );
      await g.playCardFromHandAsync(1, 0);

      expect(sarlacc(g)).toBeDefined();
      expect(needs(g)).toBeFalsy();
      expect(g.state.player1.resources).toHaveLength(4);
      expect(readyCount(g)).toBe(4);
    });
  });
});
