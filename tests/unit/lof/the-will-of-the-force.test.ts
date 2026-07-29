import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_227 The Will of the Force — cost 4 Cunning event.
// "Return a non-leader unit to its owner's hand. You may use the Force (lose your Force token).
//  If you do, that player discards a random card from their hand."

function baseState(withForce: boolean) {
  const state = new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.lof.theWillOfTheForce)
    .Build();
  state.player1.supplemental.forceToken = withForce;
  return state;
}

describe("LOF_227 The Will of the Force", () => {
  it("returns the chosen enemy non-leader unit to its owner's hand", async () => {
    const g = new GameTestAdapter();
    const state = baseState(false);
    state.player2.groundArena.push({
      cardId: Cards.units.sor.gamorreanGuards, playId: "900", owner: 2, controller: 2,
      ready: true, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false,
    });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.hand.map(c => c.cardId)).toContain(Cards.units.sor.gamorreanGuards);
  });

  it("can return a friendly unit ('a non-leader unit', either side)", async () => {
    const g = new GameTestAdapter();
    const state = baseState(false);
    state.player1.groundArena.push({
      cardId: Cards.units.sor.battlefieldMarine, playId: "900", owner: 1, controller: 1,
      ready: true, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false,
    });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
  });

  it("cannot target a leader unit", async () => {
    const g = new GameTestAdapter();
    const state = baseState(false);
    state.player2.groundArena.push({
      cardId: Cards.leaders.sor.sabineWren, playId: "900", owner: 2, controller: 2,
      ready: true, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false,
    });
    state.player2.groundArena.push({
      cardId: Cards.units.sor.gamorreanGuards, playId: "901", owner: 2, controller: 2,
      ready: true, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false,
    });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["900"] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena).toHaveLength(2);
  });

  it("after the bounce, offers the Force prompt; Yes discards a random card from that player's hand", async () => {
    const g = new GameTestAdapter();
    const state = baseState(true);
    state.player2.groundArena.push({
      cardId: Cards.units.sor.gamorreanGuards, playId: "900", owner: 2, controller: 2,
      ready: true, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false,
    });
    state.player2.hand.push({ cardId: Cards.units.sor.battlefieldMarine });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    await g.chooseYesAsync(1);

    expect(g.state.player1.supplemental.forceToken).toBe(false);
    // Hand had 1 card, then the bounced unit was added (2), then 1 was discarded at random.
    expect(g.state.player2.hand).toHaveLength(1);
    expect(g.state.player2.discard).toHaveLength(1);
  });

  it("declining the Force keeps the token and discards nothing", async () => {
    const g = new GameTestAdapter();
    const state = baseState(true);
    state.player2.groundArena.push({
      cardId: Cards.units.sor.gamorreanGuards, playId: "900", owner: 2, controller: 2,
      ready: true, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false,
    });
    state.player2.hand.push({ cardId: Cards.units.sor.battlefieldMarine });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.supplemental.forceToken).toBe(true);
    expect(g.state.player2.hand).toHaveLength(2); // original card + the bounced unit
    expect(g.state.player2.discard).toHaveLength(0);
  });

  it("no Force token: the bounce still happens, with no prompt", async () => {
    const g = new GameTestAdapter();
    const state = baseState(false);
    state.player2.groundArena.push({
      cardId: Cards.units.sor.gamorreanGuards, playId: "900", owner: 2, controller: 2,
      ready: true, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false,
    });
    state.player2.hand.push({ cardId: Cards.units.sor.battlefieldMarine });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.hand).toHaveLength(2);
    expect(g.state.player2.discard).toHaveLength(0);
  });

  it("'that player' is the returned unit's owner — bouncing your own unit discards from YOUR hand", async () => {
    const g = new GameTestAdapter();
    const state = baseState(true);
    state.player1.groundArena.push({
      cardId: Cards.units.sor.battlefieldMarine, playId: "900", owner: 1, controller: 1,
      ready: true, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false,
    });
    state.player2.hand.push({ cardId: Cards.units.sor.gamorreanGuards });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player2.hand).toHaveLength(1); // opponent untouched
    expect(g.state.player1.hand).toHaveLength(0); // the bounced Marine was the only card, discarded
    expect(g.state.player1.discard.some(d => d.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
  });

  it("upgrades on the returned unit are defeated with it", async () => {
    const g = new GameTestAdapter();
    const state = baseState(false);
    state.player2.groundArena.push({
      cardId: Cards.units.sor.gamorreanGuards, playId: "900", owner: 2, controller: 2,
      ready: true, damage: 0,
      upgrades: [{ cardId: "SOR_T01", playId: "901", owner: 2, controller: 2 }],
      captives: [], numUses: 0, isClone: false,
    });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([Cards.units.sor.gamorreanGuards]);
  });

  it("cannot return a unit piloted by Chewbacca (JTL_103) — immune to enemy bounce", async () => {
    const g = new GameTestAdapter();
    const state = baseState(false);
    state.player2.spaceArena.push({
      cardId: Cards.units.jtl.phoenixSquadronAWing, playId: "900", owner: 2, controller: 2,
      ready: true, damage: 0,
      upgrades: [{ cardId: Cards.units.jtl.chewbacca, playId: "901", owner: 2, controller: 2 }],
      captives: [], numUses: 0, isClone: false,
    });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["900"] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.spaceArena).toHaveLength(1);
  });
});
