import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { playCost } from "@/server/engine/card-playability";

// LAW_058 Honor-Bound Partisan (2/2 Ground, Rebel/Twi'lek, cost 2)
//   "When Played: Deal 1 damage to a base."
//   "When Defeated: The next unit you play this phase costs 1 resource less."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("LAW_058 Honor-Bound Partisan — When Played", () => {
  it("deals 1 damage to the chosen base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithCardInHandForPlayer(1, Cards.units.law.honorBoundPartisan).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("'a base' means either — your own is a legal choice", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithCardInHandForPlayer(1, Cards.units.law.honorBoundPartisan).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(0);
  });
});

describe("LAW_058 Honor-Bound Partisan — When Defeated", () => {
  async function defeatThePartisan(g: GameTestAdapter) {
    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
  }

  function setupDefeat() {
    return baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.law.honorBoundPartisan)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3 power kills a 2/2
      .WithActivePlayer(2);
  }

  it("makes the next unit you play this phase cost 1 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setupDefeat().Build());
    expect(playCost(g.state, 1, Cards.units.sor.battlefieldMarine)).toBe(2);

    await defeatThePartisan(g);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(playCost(g.state, 1, Cards.units.sor.battlefieldMarine)).toBe(1);
  });

  it("the discount is one-shot — it is gone after a unit is played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setupDefeat()
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await defeatThePartisan(g);
    await g.playCardFromHandAsync(1, 0);

    expect(playCost(g.state, 1, Cards.units.sor.battlefieldMarine)).toBe(2);
  });

  it("only the DEFEATED partisan's controller gets it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setupDefeat().Build());

    await defeatThePartisan(g);

    expect(playCost(g.state, 2, Cards.units.sor.battlefieldMarine)).toBe(2);
  });

  it("does not discount non-unit cards", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setupDefeat().Build());
    const before = playCost(g.state, 1, Cards.events.sor.powerFailure);

    await defeatThePartisan(g);

    expect(playCost(g.state, 1, Cards.events.sor.powerFailure)).toBe(before);
  });
});
