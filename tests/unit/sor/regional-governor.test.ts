import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_062 Regional Governor
// — When Played: Name a card. While this unit is in play, opponents can't play the named card.

describe("SOR_062 Regional Governor", () => {
  it("When Played: prompts the active player to name a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)      // Vigilance — covers Regional Governor
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
        .WithCardInHandForPlayer(1, Cards.units.sor.regionalGovernor)
        .Build(),
    );

    await g.dispatchAsync(1, "play-card", { cardId: Cards.units.sor.regionalGovernor, fromZone: "Hand" });

    // Should be awaiting a name-card selection (NeedsTarget resolution)
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
  });

  it("When Played: choosing a card stores the named title on the governor", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
        .WithCardInHandForPlayer(1, Cards.units.sor.regionalGovernor)
        .Build(),
    );

    await g.dispatchAsync(1, "play-card", { cardId: Cards.units.sor.regionalGovernor, fromZone: "Hand" });
    // Name "Strike True" by sending its card ID as the choose-target payload.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [Cards.events.sor.strikeTrue] });

    const governor = g.state.player1.groundArena[0];
    expect((governor as any).namedCardTitle).toBe("Strike True");
  });

  it("opponent cannot play the named card while Regional Governor is in play", async () => {
    // Strike True (Command, cost 3) — grandMoffTarkin + green30HP covers the Command aspect.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.regionalGovernor)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithActivePlayer(2)
        .Build(),
    );

    // Pre-set the named card title on the governor.
    (g.state.player1.groundArena[0] as any).namedCardTitle = "Strike True";

    // Player 2 tries to play Strike True — should be blocked.
    await g.dispatchAsync(2, "play-card", { cardId: Cards.events.sor.strikeTrue, fromZone: "Hand" });
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("naming a card blocks all reprints with the same title", async () => {
    // Guardian of the Whills exists in SOR (SOR_061) and LOF (LOF_058).
    // Naming "Guardian of the Whills" should block both.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.blue30HP)   // Vigilance for Guardian of the Whills
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.regionalGovernor)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 2)
        .WithCardInHandForPlayer(2, "LOF_058")    // LOF printing of Guardian of the Whills
        .WithActivePlayer(2)
        .Build(),
    );

    (g.state.player1.groundArena[0] as any).namedCardTitle = "Guardian of the Whills";

    // LOF printing should also be blocked by the same title.
    await g.dispatchAsync(2, "play-card", { cardId: "LOF_058", fromZone: "Hand" });
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("the controller can still play the named card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.regionalGovernor)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
        .Build(),
    );

    (g.state.player1.groundArena[0] as any).namedCardTitle = "Strike True";

    // Player 1 (the governor's controller) can still play Strike True.
    await g.dispatchAsync(1, "play-card", { cardId: Cards.events.sor.strikeTrue, fromZone: "Hand" });
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
  });

  it("opponent can play the named card once the governor is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.regionalGovernor)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInHandForPlayer(2, Cards.events.sor.strikeTrue)
        .WithActivePlayer(2)
        .Build(),
    );

    (g.state.player1.groundArena[0] as any).namedCardTitle = "Strike True";

    // Remove the governor from play (simulating defeat).
    const [governor] = g.state.player1.groundArena.splice(0, 1);
    g.state.player1.discard.unshift({ ...governor, turnDiscarded: 1, discardEffect: "" });

    // Player 2 can now play Strike True — governor is gone.
    await g.dispatchAsync(2, "play-card", { cardId: Cards.events.sor.strikeTrue, fromZone: "Hand" });
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
  });
});
