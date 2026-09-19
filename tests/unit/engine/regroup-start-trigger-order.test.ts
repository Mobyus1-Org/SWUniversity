import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Ordering "when the regroup phase starts" effects against each other.
//
//   HMW_004 The Death Star (deployed Grand Moff Tarkin): "When the regroup phase starts: You may defeat
//     a base with 10 or less remaining HP."
//   SOR_219 Sneak Attack: "Play a unit from your hand. It costs 3 less and enters play ready. At the
//     start of the regroup phase, defeat it."
//   SOR_134 Ruthless Raider: "When Played/When Defeated: Deal 2 damage to an enemy base and 2 damage
//     to an enemy unit."
//
// At the start of the regroup phase Sneak Attack's DELAYED defeat happens first, automatically, and
// kills the Raider. Its When Defeated and The Death Star's trigger are then both waiting, both P1's —
// so P1 orders them:
//   • Death Star first → the enemy base has 12 remaining, nothing to defeat; then the Raider takes it
//     to 20 damage — too late.
//   • Raider first → the base goes to 10 remaining; The Death Star then defeats it and P1 wins.

const TARKIN = Cards.leaders.hmw.grandMoffTarkin;
const RAIDER = Cards.units.sor.ruthlessRaider;
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  const b = new GameStateBuilder()
    .MyBase(Cards.bases.law.contestedCaverns)      // Aggression; Epic Action: play ignoring 1 penalty
    .MyLeader(TARKIN, true, true)
    .WithSpaceUnitForPlayer(1, TARKIN)              // deployed as The Death Star
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithInitiativePlayerBeing(1)
    .FillResourcesForPlayer(1, MARINE, 7)
    .WithCardInHandForPlayer(1, Cards.events.sor.sneakAttack)
    .WithCardInHandForPlayer(1, RAIDER);
  for (let i = 0; i < 6; i++) b.WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(2, MARINE);
  const s = b.Build();
  s.player2.base.damage = 16;
  return s;
}

type Res = { type?: string; options?: string[]; fromPlayIds?: string[] };
const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as Res;

/** Step 1: the base plays Sneak Attack (Cunning penalty ignored: 2), which plays the Raider for 3. */
async function sneakAttackTheRaider(g: GameTestAdapter) {
  await g.useBaseAbilityAsync(1);
  await g.chooseCardFromHandAsync(1, 0); // Sneak Attack
  await g.chooseCardFromHandAsync(1, 0); // the Raider — now the only card in hand
}

/** Step 2: both players pass; the regroup phase starts. */
async function toRegroup(g: GameTestAdapter) {
  await g.dispatchAsync(2, "pass-action", {});
  await g.dispatchAsync(1, "pass-action", {});
}

const optionLike = (g: GameTestAdapter, text: string) => res(g).options!.find(o => o.includes(text))!;

describe("regroup-start effects are ordered by their player: The Death Star vs a Sneak Attacked Ruthless Raider", () => {
  it("setup: Sneak Attack plays the Raider, whose When Played takes the enemy base to 18", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await sneakAttackTheRaider(g);

    expect(g.state.player2.base.damage).toBe(18);
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.spaceArena).toHaveLength(2);
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(2);
  });

  it("the Raider's When Defeated and The Death Star wait together — P1 chooses which resolves first", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await sneakAttackTheRaider(g);
    await toRegroup(g);

    // Sneak Attack's delayed defeat already happened: the Raider is gone, its When Defeated waiting.
    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([TARKIN]);
    expect(g.state.player2.base.damage).toBe(18);
    const r = res(g);
    expect(r.type).toBe("Option");
    expect(r.options).toHaveLength(2);
    expect(optionLike(g, "Ruthless Raider")).toBeDefined();
    expect(optionLike(g, "The Death Star")).toBeDefined();
  });

  it("Death Star first: no base is at 10 or less yet, so nothing happens; then the Raider makes it 20", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await sneakAttackTheRaider(g);
    await toRegroup(g);
    expect(res(g).options).toHaveLength(2); // the order prompt — nothing has resolved yet
    expect(g.state.player2.base.damage).toBe(18);
    await g.chooseOptionAsync(1, optionLike(g, "The Death Star"));

    expect(g.state.player2.base.damage).toBe(20);
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(RAIDER);
    expect(g.state.defeatedPlayers).toEqual([]);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.gamePhase).toBe("RegroupResource"); // the draw ran once everything resolved
  });

  it("Raider first: its When Defeated leaves the base on 10 — The Death Star defeats it, P1 wins", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await sneakAttackTheRaider(g);
    await toRegroup(g);
    expect(res(g).options).toHaveLength(2);
    await g.chooseOptionAsync(1, optionLike(g, "Ruthless Raider"));
    expect(g.state.player2.base.damage).toBe(20);

    expect(res(g).type).toBe("Option"); // The Death Star: "Defeat a base…?"
    await g.chooseYesAsync(1);
    expect(res(g).fromPlayIds).toEqual(["player2.base"]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });

    expect(g.state.defeatedPlayers).toEqual([2]);
  });
});
