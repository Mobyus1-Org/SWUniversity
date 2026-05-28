import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_189 Leia Organa", () => {
  it("When Played Yes: readies an exhausted resource", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo) // Cunning+Heroism covers both aspects of SOR_189
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5) // cost=4, have 5
      .WithCardInHandForPlayer(1, Cards.units.sor.leiaOrgana)
      .Build();
    g.loadNewState(state);

    // After playing Leia (cost=4), we'll have 1 ready resource left
    // That resource gets exhausted during play, leaving exhausted resources to ready
    await g.playCardFromHandAsync(1, 0);

    const exhaustedResource = g.state.player1.resources.find(r => !r.ready);
    expect(exhaustedResource).toBeDefined();
    const exhaustedPlayId = exhaustedResource!.playId;

    // Option: Yes = ready a resource
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [exhaustedPlayId] });

    expect(g.state.player1.resources.find(r => r.playId === exhaustedPlayId)?.ready).toBe(true);
  });

  it("When Played No: exhausts a chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.leiaOrgana)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // starts ready
      .Build();
    g.loadNewState(state);

    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });
});
