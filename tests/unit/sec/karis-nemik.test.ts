import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";

// SEC_148 Karis Nemik (3/2 Ground, cost 2, Aggression/Heroism)
// "Hidden"
// "When Defeated: You may disclose AggressionHeroism (reveal cards from your hand with these
//  aspect icons among them). If you do, create a Spy token and ready it."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    // Nemik (3/2) attacks a Battlefield Marine (3/3) — both die.
    .WithGroundUnitForPlayer(1, Cards.units.sec.karisNemik)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine);
}

function spies(g: GameTestAdapter) {
  return g.state.player1.groundArena.filter(u => u.cardId === Cards.units.token.spy);
}

describe("SEC_148 Karis Nemik", () => {
  it("has Hidden", () => {
    const g = new GameTestAdapter();
    const s = baseSetup().Build();
    g.loadNewState(s);

    const nemik = g.state.player1.groundArena[0];
    expect(HasHidden(nemik.cardId, nemik.playId, 1)).toBe(true);
  });

  it("When Defeated: discloses one card carrying both icons → creates a ready Spy token", async () => {
    const g = new GameTestAdapter();
    // Karis Nemik itself carries Aggression + Heroism, so one card satisfies the disclose.
    const s = baseSetup().WithCardInHandForPlayer(1, Cards.units.sec.karisNemik).Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    const created = spies(g);
    expect(created).toHaveLength(1);
    expect(created[0].ready).toBe(true); // "and ready it"
  });

  it("discloses two cards when no single card carries both icons", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithCardInHandForPlayer(1, Cards.events.sor.aggression) // Aggression, Aggression
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // Command, Heroism
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0); // Aggression
    await g.chooseCardFromHandAsync(1, 1); // Heroism — disclose reveals, so the hand doesn't shift

    const created = spies(g);
    expect(created).toHaveLength(1);
    expect(created[0].ready).toBe(true);
  });

  it("rejects revealing the same card twice for the two icons", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithCardInHandForPlayer(1, Cards.events.sor.aggression) // Aggression, Aggression
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // Command, Heroism
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0); // Aggression
    const reused = await g.chooseCardFromHandAsync(1, 0); // same card again — not a Heroism source

    expect(reused.lastDispatchResponse?.invalidAction).toBe(true);
    expect(spies(g)).toHaveLength(0);
  });

  it("declining the disclose creates no Spy", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup().WithCardInHandForPlayer(1, Cards.units.sec.karisNemik).Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    const traded = await g.chooseGroundUnitAsync(2, 0);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(traded.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(spies(g)).toHaveLength(0);
    expect(g.state.player1.hand).toHaveLength(1); // disclose reveals, never discards
  });

  it("no prompt when the hand can't cover both icons", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft) // Vigilance only
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    const traded = await g.chooseGroundUnitAsync(2, 0);

    expect(traded.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(spies(g)).toHaveLength(0);
  });
});
