import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IBH_020 Luke Skywalker — Do You Read Me? (6/6 Ground, cost 7, Command/Heroism) and its IC27_082
// reprint — "Restore 2. When Played: You may deal 3 damage to a ground unit."

const MARINE = Cards.units.sor.battlefieldMarine;
const WAMPA = Cards.units.sor.wampa;                // 4/5 Ground
const PATROL = Cards.units.sor.systemPatrolCraft;   // space — never a legal target

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(2, WAMPA)
    .WithSpaceUnitForPlayer(2, PATROL);
}

for (const [label, LUKE] of [
  ["IBH_020", Cards.units.ibh.lukeSkywalker],
  ["IC27_082", Cards.units.ic27.lukeSkywalker],
] as const) {
  describe(`${label} Luke Skywalker — Do You Read Me?`, () => {
    it("When Played: may deal 3 damage to a ground unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithCardInHandForPlayer(1, LUKE).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      const res = g.lastDispatchResponse?.resolutionNeeded;
      const offered = res?.type === "Target" ? res.fromPlayIds : [];
      expect(offered).toContain(g.state.player2.groundArena[0].playId);
      expect(offered).not.toContain(g.state.player2.spaceArena[0].playId); // ground only
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

      expect(g.state.player2.groundArena[0].damage).toBe(3);
    });

    it("When Played: declining deals nothing", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithCardInHandForPlayer(1, LUKE).Build());

      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseNoAsync(1);

      expect(g.state.player2.groundArena[0].damage).toBe(0);
    });

    it("Restore 2: heals 2 from your base when he attacks", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithGroundUnitForPlayer(1, LUKE).Build());
      g.state.player1.base.damage = 5;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player1.base.damage).toBe(3);
    });
  });
}
