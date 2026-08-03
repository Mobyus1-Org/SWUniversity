import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_150 Koska Reeves - Loyal Nite Owl (4/5 Ground, cost 4) —
//   "On Attack: If this unit is upgraded, you may deal 2 damage to a ground unit."
describe("SHD_150 Koska Reeves - Loyal Nite Owl", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.sabineWren) // Aggression/Heroism — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithActivePlayer(1);
  }

  it("while upgraded: may deal 2 damage to a chosen ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.shd.koskaReeves)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.token.experience, playId: "@", owner: 1, controller: 1 },
        ])
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9 defender
        .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)            // 4/5 bystander, survives the ping
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack the Walker
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 1); // ping the bystander instead

    expect(g.state.player2.groundArena[1].damage).toBe(2);
  });

  it("while upgraded: declining deals no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.shd.koskaReeves)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.token.experience, playId: "@", owner: 1, controller: 1 },
        ])
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
        .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[1].damage).toBe(0);
    // Combat still resolved: Koska 4 power + 1 from Experience = 5 onto the 9-HP Walker.
    expect(g.state.player2.groundArena[0].damage).toBe(5);
  });

  it("control: unupgraded Koska gets no prompt and deals no ability damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.shd.koskaReeves) // no upgrades
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
        .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Attack resolved straight through — no ability prompt.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[1].damage).toBe(0);
    expect(g.state.player2.groundArena[0].damage).toBe(4); // combat only
  });

  it("can target a FRIENDLY ground unit ('a ground unit', not 'an enemy unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.shd.koskaReeves)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.token.experience, playId: "@", owner: 1, controller: 1 },
        ])
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 1); // my own Marine

    // Koska herself dies to the Walker's counter-damage, so find the Marine by cardId.
    const marine = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    expect(marine.damage).toBe(2);
  });

  it("cannot target a SPACE unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.shd.koskaReeves)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.token.experience, playId: "@", owner: 1, controller: 1 },
        ])
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });
});
