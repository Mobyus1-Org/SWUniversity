import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_155 DRK-1 Probe Droid (2/3 Ground, cost 2, Aggression, Droid) and its IC27_129 reprint
//   "When Played: You may defeat a non-unique upgrade."
// Either side's upgrades; tokens are non-unique upgrades too.

const MARINE = Cards.units.sor.battlefieldMarine;
const NON_UNIQUE = Cards.upgrades.sor.academyTraining;
const UNIQUE = Cards.upgrades.sor.lukesLightsaber;

function board(droid: string, upgrades: string[]) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, droid)
    .WithGroundUnitForPlayer(2, MARINE)
    .WithUpgradesOnGroundUnitForPlayer(2, 0, upgrades.map(u => GameStateBuilder.Upgrade(u, 2)));
}

const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? res.fromPlayIds : undefined;
};
const upgradeOf = (g: GameTestAdapter, cardId: string) =>
  g.state.player2.groundArena[0].upgrades.find(u => u.cardId === cardId);

for (const [label, DROID] of [
  ["LOF_155", Cards.units.lof.drk1ProbeDroid],
  ["IC27_129", Cards.units.ic27.drk1ProbeDroid],
] as const) {
  describe(`${label} DRK-1 Probe Droid — When Played`, () => {
    it("may defeat a non-unique upgrade", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(DROID, [NON_UNIQUE]).Build());
      const upgradePlayId = upgradeOf(g, NON_UNIQUE)!.playId;

      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgradePlayId] });

      expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
    });

    it("does not offer a unique upgrade", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(DROID, [UNIQUE, NON_UNIQUE]).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);

      expect(offered(g)).toEqual([upgradeOf(g, NON_UNIQUE)!.playId]);
    });

    it("declining leaves the upgrade attached", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(DROID, [NON_UNIQUE]).Build());

      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseNoAsync(1);

      expect(upgradeOf(g, NON_UNIQUE)).toBeDefined();
    });

    it("control: no prompt when only a unique upgrade is in play", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(DROID, [UNIQUE]).Build());

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
      expect(upgradeOf(g, UNIQUE)).toBeDefined();
    });
  });
}
