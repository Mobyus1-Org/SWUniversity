import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CardInPlay } from "@/lib/engine/core-models";

// ASH_171 Pegasus Tri-Wing (Space, cost 3) —
// "When Played: You may defeat a friendly upgrade. If you do, ready this unit."
// (Units already enter play ready, so the "ready" clause is a no-op in isolation — it matters
// only in combination with other exhaust-on-entry effects. Tested here for wiring correctness.)

function upg(cardId: string): CardInPlay {
  return { cardId, playId: "@", owner: 1, controller: 1 };
}

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_171 Pegasus Tri-Wing — When Played", () => {
  it("may defeat a friendly upgrade, readying this unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.pegasusTriWing)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [upg(Cards.upgrades.token.experience)])
      .Build();
    g.loadNewState(state);

    const upgradePlayId = state.player1.spaceArena[0].upgrades[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgradePlayId] });

    const craft = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.systemPatrolCraft)!;
    expect(craft.upgrades).toHaveLength(0);
    const pegasus = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.pegasusTriWing)!;
    expect(pegasus.ready).toBe(true);
  });

  it("may decline — the upgrade stays", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.pegasusTriWing)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [upg(Cards.upgrades.token.experience)])
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    const craft = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.systemPatrolCraft)!;
    expect(craft.upgrades).toHaveLength(1);
  });

  it("does not offer the option with no friendly upgrades in play (control)", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.pegasusTriWing)
      .Build();
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
