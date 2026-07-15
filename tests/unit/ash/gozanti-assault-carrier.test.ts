import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";

// ASH_099 Gozanti Assault Carrier (4/6 Space, cost 5)
// "Support (…)"
// "On Attack: This unit gains Sentinel for this phase."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("ASH_099 Gozanti Assault Carrier", () => {
  it("On Attack: gains Sentinel for the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithSpaceUnitForPlayer(1, Cards.units.ash.gozantiAssaultCarrier).Build());

    const gozanti = g.state.player1.spaceArena[0];
    expect(HasKeyword(Cards.units.ash.gozantiAssaultCarrier, "Sentinel", gozanti.playId, 1)).toBe(false);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(HasKeyword(Cards.units.ash.gozantiAssaultCarrier, "Sentinel", gozanti.playId, 1)).toBe(true);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("Support grants the On Attack — the supported attacker gains Sentinel instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.token.xWing)
        .WithCardInHandForPlayer(1, Cards.units.ash.gozantiAssaultCarrier)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(1, 0); // the X-Wing attacks
    await g.chooseBaseAsync(1, 2);

    const xwing = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.token.xWing)!;
    expect(HasKeyword(Cards.units.token.xWing, "Sentinel", xwing.playId, 1)).toBe(true);
  });
});
