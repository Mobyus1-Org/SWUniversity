import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// TWI_094 Shaak Ti — 3/4 Ground (Force, Jedi, Republic)
// "Each friendly token unit gets +1/+0.
//  On Attack: Create a Clone Trooper token."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren);
}

describe("TWI_094 Shaak Ti", () => {
  it("gives friendly token units +1/+0, leaving non-tokens unchanged", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.twi.shaakTi)                 // [0] non-token source
      .WithGroundUnitForPlayer(1, Cards.units.token.cloneTrooper)          // [1] token (2/2)
      .Build();
    g.loadNewState(state);

    const shaakTi = Unit.FromInterface(g.state.player1.groundArena[0]);
    const token = Unit.FromInterface(g.state.player1.groundArena[1]);

    expect(token.CurrentPower()).toBe(3);  // 2 + 1
    expect(token.CurrentHP()).toBe(2);     // HP unaffected (+1/+0)
    expect(shaakTi.CurrentPower()).toBe(3); // Shaak Ti is not a token — unchanged
  });

  it("does not buff token units when Shaak Ti is absent", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.token.cloneTrooper)
      .Build();
    g.loadNewState(state);

    const token = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(token.CurrentPower()).toBe(2);
  });

  it("creates a Clone Trooper token on attack", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.twi.shaakTi)
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const tokens = g.state.player1.groundArena.filter(u => u.cardId === Cards.units.token.cloneTrooper);
    expect(tokens).toHaveLength(1);
  });
});
