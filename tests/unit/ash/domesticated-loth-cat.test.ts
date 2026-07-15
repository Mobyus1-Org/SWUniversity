import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";

// ASH_068 Domesticated Loth-Cat (1/3 Ground, cost 1)
// "Enemy units lose Ambush and Support."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("ASH_068 Domesticated Loth-Cat", () => {
  it("an enemy Support unit gets no Support prompt when it is played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.ash.domesticatedLothCat) // opponent's Loth-Cat
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)   // a unit that could have attacked
        .WithCardInHandForPlayer(1, Cards.units.ash.fangFighterSquadron)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined(); // Support was lost
    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!.ready).toBe(true);
  });

  it("an enemy Ambush unit gets no Ambush prompt when it is played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.ash.domesticatedLothCat)
        .WithCardInHandForPlayer(1, Cards.units.law.guildAmbushTeam)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined(); // Ambush was lost
  });

  it("does not take Support or Ambush from its controller's own units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.domesticatedLothCat) // OUR Loth-Cat
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.ash.fangFighterSquadron)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option"); // Support still offered
  });

  it("suppression is keyword-level, not just prompt-level", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.ash.domesticatedLothCat)
        .WithGroundUnitForPlayer(1, Cards.units.ash.blurrg) // has Support + Overwhelm
        .Build(),
    );

    const blurrg = g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.blurrg)!;

    expect(HasKeyword(Cards.units.ash.blurrg, "Support", blurrg.playId, 1)).toBe(false);
    expect(HasKeyword(Cards.units.ash.blurrg, "Overwhelm", blurrg.playId, 1)).toBe(true); // untouched
  });
});
