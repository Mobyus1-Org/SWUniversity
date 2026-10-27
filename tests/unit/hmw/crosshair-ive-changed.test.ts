import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_169 Crosshair — I've Changed (5/6 Ground, cost 5, Aggression/Heroism, Clone, unique)
//   "When this unit is dealt damage and survives: Each player draws a card.
//    When an opponent draws 1 or more cards during the action phase: Deal 2 damage to their base."
//
// The second ability is once per draw EVENT — an effect that draws 2 is one trigger for 2 damage,
// not two. It needs a card actually drawn (an empty-deck draw only costs the usual 3 per card), and
// the regroup draw is not "during the action phase". The two abilities chain: when Crosshair is
// damaged, the opponent's draw from the first ability triggers the second.
const CROSSHAIR = Cards.units.hmw.crosshairIveChanged;
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3 Ground, no abilities
const OPEN_FIRE = Cards.events.sor.openFire;           // "Deal 4 damage to a unit."
const BRIEFING = Cards.events.sor.missionBriefing;     // "Choose a player. They draw 2 cards."
const SEARCH = Cards.events.sor.searchYourFeelings;    // search your deck for a card and draw it

function base(deckSize = 3) {
  const b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.darthVader)
    .FillResourcesForPlayer(1, MARINE, 12)
    .FillResourcesForPlayer(2, MARINE, 12)
    .WithGroundUnitForPlayer(1, CROSSHAIR);
  for (let i = 0; i < deckSize; i++) b.WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(2, MARINE);
  return b;
}
const crosshair = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === CROSSHAIR);
const target = (g: GameTestAdapter, from: 1 | 2, playId: string) =>
  g.dispatchAsync(from, "choose-target", { targetPlayIds: [playId] });

describe("HMW_169 Crosshair — dealt damage and survives: each player draws a card", () => {
  it("both players draw; the opponent's draw then costs them 2 base damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(2, OPEN_FIRE).WithActivePlayer(2).Build());
    await g.playCardFromHandAsync(2, 0);
    await target(g, 2, crosshair(g)!.playId);

    expect(crosshair(g)!.damage).toBe(4);
    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player2.hand).toHaveLength(1); // Open Fire left, one card drawn
    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player1.base.damage).toBe(0); // Crosshair's controller drawing is not "an opponent"
  });

  it("surviving combat damage as the attacker triggers it too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, MARINE).WithActivePlayer(1).Build());
    await g.attackWithGroundUnitAsync(1, 0);
    await target(g, 1, g.state.player2.groundArena[0].playId);

    expect(crosshair(g)!.damage).toBe(3);
    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player2.hand).toHaveLength(1);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("damage that defeats Crosshair draws nothing", async () => {
    const g = new GameTestAdapter();
    const s = base().WithCardInHandForPlayer(2, OPEN_FIRE).WithActivePlayer(2).Build();
    s.player1.groundArena[0].damage = 2; // 4 HP left
    g.loadNewState(s);
    await g.playCardFromHandAsync(2, 0);
    await target(g, 2, crosshair(g)!.playId);

    expect(crosshair(g)).toBeUndefined();
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player2.hand).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("a Shield that absorbs the hit means no damage was dealt — no draws", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 1)])
        .WithCardInHandForPlayer(2, OPEN_FIRE)
        .WithActivePlayer(2)
        .Build(),
    );
    await g.playCardFromHandAsync(2, 0);
    await target(g, 2, crosshair(g)!.playId);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player2.hand).toHaveLength(0);
  });
});

describe("HMW_169 Crosshair — an opponent draws during the action phase: 2 to their base", () => {
  it("the opponent drawing 2 off one effect is ONE trigger — 2 damage, not 4", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(2, BRIEFING).WithActivePlayer(2).Build());
    await g.playCardFromHandAsync(2, 0);
    await g.chooseYesAsync(2); // "You draw 2"

    expect(g.state.player2.hand).toHaveLength(2);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("fires when Crosshair's own controller makes the opponent draw", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, BRIEFING).WithActivePlayer(1).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // "Opponent draws 2"

    expect(g.state.player2.hand).toHaveLength(2);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("Crosshair's controller drawing deals nothing (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, BRIEFING).WithActivePlayer(1).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // "You draw 2"

    expect(g.state.player1.hand).toHaveLength(2);
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("a deck search that draws is a draw — once", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(2, SEARCH).WithActivePlayer(2).Build());
    await g.playCardFromHandAsync(2, 0);
    const choices = (g.lastDispatchResponse?.resolutionNeeded as { choices?: { tempId: string }[] }).choices!;
    await g.chooseDeckSearchAsync(2, [choices[0].tempId]);

    expect(g.state.player2.hand).toHaveLength(1);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("an empty-deck draw draws nothing — only the usual 3 per card", async () => {
    const g = new GameTestAdapter();
    const s = base().WithCardInHandForPlayer(2, BRIEFING).WithActivePlayer(2).Build();
    s.player2.deck = [];
    g.loadNewState(s);
    await g.playCardFromHandAsync(2, 0);
    await g.chooseYesAsync(2);

    expect(g.state.player2.hand).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("the regroup-phase draw is not during the action phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithActivePlayer(1).Build());
    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.gamePhase).not.toBe("ActionPhase");
    expect(g.state.player2.hand).toHaveLength(2);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("a Crosshair that lost its abilities (Imprisoned) does not react", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(Cards.upgrades.shd.imprisoned, 2)])
        .WithCardInHandForPlayer(2, BRIEFING)
        .WithActivePlayer(2)
        .Build(),
    );
    await g.playCardFromHandAsync(2, 0);
    await g.chooseYesAsync(2);

    expect(g.state.player2.hand).toHaveLength(2);
    expect(g.state.player2.base.damage).toBe(0);
  });
});

// Routes that used to put the top card into hand by hand, skipping the draw bookkeeping — each is
// a real draw, so the opponent's base must pay for it.
describe("HMW_169 Crosshair — draw routes outside the generic draw helpers", () => {
  it("Heroic Sacrifice's draw is seen", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(2, Cards.events.sor.heroicSacrifice).WithActivePlayer(2).Build());
    await g.playCardFromHandAsync(2, 0); // no units to attack with — the draw is all it does

    expect(g.state.player2.hand).toHaveLength(1);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("Reinforcement Walker's 'draw that card' is seen", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(2, Cards.units.sor.reinforcementWalker).WithActivePlayer(2).Build());
    await g.playCardFromHandAsync(2, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(2); // draw it

    expect(g.state.player2.hand).toHaveLength(1);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("Kreia's Whispers draws 3 as one event — 2 damage, once", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(4).WithCardInHandForPlayer(2, Cards.events.sec.kreiasWhispers).WithActivePlayer(2).Build());
    await g.playCardFromHandAsync(2, 0);
    expect(g.state.player2.hand).toHaveLength(3);
    await g.chooseOptionAsync(2, "0"); // to the top
    await g.chooseOptionAsync(2, "0"); // to the bottom

    expect(g.state.player2.base.damage).toBe(2);
  });
});
