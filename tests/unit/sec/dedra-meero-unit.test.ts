import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

const SPY = "SEC_T01";

// SEC_087 Dedra Meero - With Verifiable Data (5/5 Ground, cost 6) —
//   "Ambush
//    On Attack: Create a Spy token."
describe("SEC_087 Dedra Meero - With Verifiable Data", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin) // Command/Villainy — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  const spies = (g: GameTestAdapter) =>
    g.state.player1.groundArena.filter(u => u.cardId === SPY).length;

  it("On Attack: creates a Spy token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sec.dedraMeeroUnit)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(spies(g)).toBe(1);
    expect(g.state.player2.base.damage).toBe(5); // the attack still resolved
  });

  it("creates another Spy on each subsequent attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sec.dedraMeeroUnit)
        .WithGroundUnitForPlayer(1, Cards.units.sec.dedraMeeroUnit)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    expect(spies(g)).toBe(2);
  });

  it("control: a plain unit attacking creates no Spy", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(spies(g)).toBe(0);
  });

  it("Ambush: she may attack immediately when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.sec.dedraMeeroUnit)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);          // use Ambush
    await g.chooseGroundUnitAsync(2, 0); // attack the Marine

    // The Ambush attack fires her On Attack too.
    expect(spies(g)).toBe(1);
    expect(g.state.player2.groundArena.length).toBe(0); // 5 power vs a 3/3
  });

  it("does not fire while she has lost her abilities", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sec.dedraMeeroUnit)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.shd.imprisoned, playId: "@", owner: 2, controller: 2 },
        ])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(spies(g)).toBe(0);
  });
});
