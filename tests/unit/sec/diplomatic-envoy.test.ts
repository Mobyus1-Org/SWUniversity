import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// SEC_109 Diplomatic Envoy (2/2 Space, cost 2, Command, Republic/Vehicle/Transport) —
//   "When Played: You may disclose Command (reveal a card from your hand with this aspect icon).
//    If you do, the next unit you play this phase gains Ambush for this phase."
describe("SEC_109 Diplomatic Envoy", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP) // Command — no aspect penalty
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16)
      .WithActivePlayer(1);
  }

  /** Play the Envoy (always hand slot 0) and disclose the Command card in slot 1. */
  async function playAndDisclose(g: GameTestAdapter) {
    await g.playCardFromHandAsync(1, 0);
    // Assert the prompt exists: dispatching a choice with no pending is a silent no-op, so
    // without this every "nothing happened" assertion below would pass on an unwired card.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0); // the Command card — hand shifted after the Envoy left
  }

  const marineInPlay = (g: GameTestAdapter) =>
    g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine);

  it("When Played: offers the disclose when a Command card is in hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.sec.diplomaticEnvoy)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // Command, Heroism
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("control: no Command card in hand — no prompt at all", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.sec.diplomaticEnvoy)
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish) // Vigilance only
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("rejects a revealed card that has no Command icon", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.sec.diplomaticEnvoy)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // makes the option legal
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish) // Vigilance — not a legal reveal
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const res = await g.chooseCardFromHandAsync(1, 1); // Vanquish

    expect(res.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("discloses rather than discards — the revealed card stays in hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.sec.diplomaticEnvoy)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await playAndDisclose(g);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([Cards.units.sor.battlefieldMarine]);
    expect(g.state.player1.discard).toHaveLength(0);
  });

  it("the next unit played this phase gains Ambush and attacks immediately", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.sec.diplomaticEnvoy)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.ibh.echoCoordinator) // 1/5 — survives to be measured
        .Build(),
    );

    await playAndDisclose(g);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0); // the Marine — the "next unit"
    await g.chooseYesAsync(1);           // take the granted Ambush
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3); // the Marine swung on arrival
  });

  it("declining the disclose grants nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.sec.diplomaticEnvoy)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option"); // the decline is real
    await g.chooseNoAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy(); // no Ambush prompt
    expect(marineInPlay(g)!.ready).toBe(false);
  });

  it("'the NEXT unit' — a second unit played afterwards gains nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.sec.diplomaticEnvoy)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // disclosed, then played first
        .WithCardInHandForPlayer(1, Cards.units.sor.echoBaseDefender)  // the second unit
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await playAndDisclose(g);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0); // Marine — consumes the grant
    await g.chooseNoAsync(1);            // decline the Ambush attack; the grant is still spent
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0); // Echo Base Defender

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("an event played in between does not consume the grant", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.sec.diplomaticEnvoy)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .WithGroundUnitForPlayer(2, Cards.units.ibh.echoCoordinator) // 1/5 — the attack target
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // the Vanquish target
        .Build(),
    );

    await playAndDisclose(g);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 1); // Vanquish — an event, not a unit
    await g.chooseGroundUnitAsync(2, 1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0); // the Marine still gets Ambush
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("the Envoy does not grant Ambush to itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.sec.diplomaticEnvoy)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    await playAndDisclose(g);

    // The grant is armed for the NEXT unit; the Envoy is already in play, exhausted.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    const envoy = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sec.diplomaticEnvoy)!;
    expect(envoy.ready).toBe(false);
  });
});
