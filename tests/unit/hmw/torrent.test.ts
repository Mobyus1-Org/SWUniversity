import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_100 Torrent (Event, cost 2, Vigilance, Disaster) —
//   "Give a Weakness token to a unit. If you control a Naboo base, give 2 Weakness tokens to that
//    unit instead."
//
// "Instead" means two tokens total, not one plus two. "You control" is the caster's base — an
// opponent's Naboo base doesn't count. The tokens are −1/−1 each, so the give can be lethal.

const TORRENT = Cards.events.hmw.torrent;
const WEAKNESS = Cards.units.token.weakness;
const NABOO_BASE = Cards.bases.hmw.greatGrassPlains;
const TATOOINE_BASE = Cards.bases.hmw.duneSea;     // same aspect, different trait
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3 Ground
const CSF = Cards.units.sor.consularSecurityForce; // 3/7 Ground

function setup(myBase: string, theirBase: string = Cards.bases.common.green30HP) {
  return new GameStateBuilder()
    .MyBase(myBase)
    .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance
    .TheirBase(theirBase)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, TORRENT)
    .WithActivePlayer(1);
}

const weaknessCount = (cardIds: { cardId: string }[]) => cardIds.filter(u => u.cardId === WEAKNESS).length;

async function playOn(g: GameTestAdapter, playId: string) {
  await g.playCardFromHandAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [playId] });
}

describe("HMW_100 Torrent", () => {
  it("without a Naboo base, gives one Weakness token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(TATOOINE_BASE).WithGroundUnitForPlayer(2, CSF).Build());

    await playOn(g, g.state.player2.groundArena[0].playId);

    const unit = g.state.player2.groundArena[0];
    expect(weaknessCount(unit.upgrades)).toBe(1);
    expect(Unit.FromInterface(unit).CurrentPower()).toBe(2);
    expect(Unit.FromInterface(unit).TotalHP()).toBe(6);
  });

  it("with a Naboo base, gives two Weakness tokens instead (not three)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(NABOO_BASE).WithGroundUnitForPlayer(2, CSF).Build());

    await playOn(g, g.state.player2.groundArena[0].playId);

    const unit = g.state.player2.groundArena[0];
    expect(weaknessCount(unit.upgrades)).toBe(2);
    expect(Unit.FromInterface(unit).CurrentPower()).toBe(1);
    expect(Unit.FromInterface(unit).TotalHP()).toBe(5);
  });

  it("an opponent's Naboo base does not count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(TATOOINE_BASE, NABOO_BASE).WithGroundUnitForPlayer(2, CSF).Build());

    await playOn(g, g.state.player2.groundArena[0].playId);

    expect(weaknessCount(g.state.player2.groundArena[0].upgrades)).toBe(1);
  });

  it("can target a friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(TATOOINE_BASE).WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, CSF).Build());

    await playOn(g, g.state.player1.groundArena[0].playId);

    expect(weaknessCount(g.state.player1.groundArena[0].upgrades)).toBe(1);
    expect(weaknessCount(g.state.player2.groundArena[0].upgrades)).toBe(0);
  });

  it("one token on a damaged 3/3 is not lethal", async () => {
    const g = new GameTestAdapter();
    const state = setup(TATOOINE_BASE).WithGroundUnitForPlayer(2, MARINE).Build();
    state.player2.groundArena[0].damage = 1;
    g.loadNewState(state);

    await playOn(g, g.state.player2.groundArena[0].playId);

    expect(g.state.player2.groundArena.length).toBe(1);
  });

  it("two tokens on the same damaged 3/3 are lethal", async () => {
    const g = new GameTestAdapter();
    const state = setup(NABOO_BASE).WithGroundUnitForPlayer(2, MARINE).Build();
    state.player2.groundArena[0].damage = 1;
    g.loadNewState(state);

    await playOn(g, g.state.player2.groundArena[0].playId);

    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("with no units in play, fizzles cleanly", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(NABOO_BASE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(TORRENT);
  });
});
