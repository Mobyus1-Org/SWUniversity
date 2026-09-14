import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_099 Veteran Fleet Officer (Unit 2/1 Ground, cost 3, Command/Heroism)
//   "When Played: Create an X-Wing token."

describe("JTL_099 Veteran Fleet Officer", () => {
  it("creates exactly one X-Wing token when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
        .WithCardInHandForPlayer(1, Cards.units.jtl.veteranFleetOfficer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([Cards.units.token.xWing]);
    expect(g.state.player2.spaceArena).toHaveLength(0);
  });
});
