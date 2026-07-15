import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("Timely Intervention", () => {
  it("should give a unit Ambush for this phase", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.yellow30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.shd.timelyIntervention)
      .WithGroundUnitForPlayer(2, Cards.units.sor.craftySmuggler)
      .Build()
    ;
    g.loadNewState(s);
    // act
    await g.playCardFromHandAsync(1, 1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);
    // assert
    expect(g.state.player1.groundArena.length).toBe(1);
    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("Smuggle [2, Command]: can be played from a resource for its smuggle cost", async () => {
    // arrange — Timely Intervention sits in resource slot 0; a green base gives the Command
    // aspect so the Smuggle cost is 2 (no aspect penalty), paid from the filler resources.
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP) // Command aspect
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.events.shd.timelyIntervention, 1) // resource 0 = Timely
      .FillResourcesForPlayer(1, Cards.bases.common.green30HP, 3)        // resources to pay the 2
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)     // the unit Timely plays
      .Build();
    g.loadNewState(s);

    // act — smuggle Timely, then resolve its effect (play the Marine, decline the Ambush).
    await g.smuggleResourceAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    // assert — the Marine entered play (Timely's effect ran) and Timely left the resource row.
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    expect(g.state.player1.resources.some(r => r.cardId === Cards.events.shd.timelyIntervention)).toBe(false);
  });
});