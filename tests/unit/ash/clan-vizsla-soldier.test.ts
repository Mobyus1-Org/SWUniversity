import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CardInPlay } from "@/lib/engine/core-models";

// ASH_165 Clan Vizsla Soldier (2/3 Ground, cost 2) — "When Defeated: You may defeat an upgrade."

function upg(cardId: string): CardInPlay {
  return { cardId, playId: "@", owner: 1, controller: 1 };
}

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(2);
}

describe("ASH_165 Clan Vizsla Soldier — When Defeated", () => {
  it("may defeat an upgrade", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.ash.clanVizslaSoldier) // 2/3 — will be defeated
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/2 attacker
      .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid)
      .WithUpgradesOnGroundUnitForPlayer(1, 1, [upg(Cards.upgrades.token.shield)])
      .Build();
    g.loadNewState(state);

    const upgradePlayId = state.player1.groundArena[1].upgrades[0].playId;

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0); // attack Clan Vizsla Soldier

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.ash.clanVizslaSoldier)).toBe(false);

    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [upgradePlayId] });

    const droid = g.state.player1.groundArena.find(u => u.cardId === Cards.units.token.battleDroid)!;
    expect(droid.upgrades).toHaveLength(0);
  });

  it("may decline — the upgrade stays", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.ash.clanVizslaSoldier)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid)
      .WithUpgradesOnGroundUnitForPlayer(1, 1, [upg(Cards.upgrades.token.shield)])
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseNoAsync(1);

    const droid = g.state.player1.groundArena.find(u => u.cardId === Cards.units.token.battleDroid)!;
    expect(droid.upgrades).toHaveLength(1);
  });
});
