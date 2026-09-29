import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";

// HMW_016 Maul — Old Master (Leader, cost 7, 5/6 Ground, Cunning/Villainy, Force/Fringe)
// Front:  Action [Exhaust]: Play a unit from your hand. It costs 1 resource less. Then, defeat it.
//         (When Played abilities resolve after the unit is defeated.)
//         Epic Action: If you control 7 or more resources, deploy this leader.
// Deployed: Shielded
//           When Deployed: You may play a unit that was defeated this phase from your discard
//           pile. It costs 5 resources less.

// Aspect bookkeeping for every fixture below: a Vigilance base plus Maul's own Cunning and
// Villainy cover {Vigilance, Cunning, Villainy}, so each of these prices at its printed cost and
// the –1 is the only thing moving it.
//   Peridea Bandit      (ASH_190) cost 2, Cunning+Villainy, no text
//   Death Trooper Squad (ASH_242) cost 4, Villainy, no text
//   The Legacy Run      (LOF_213) cost 5, Cunning — When Defeated: 6 damage divided among enemies
//   Anakin (Mortis)     (LOF_070) cost 6, Vigilance — TWO When Played abilities, each –3/–3
//   Summa-verminoth     (ASH_083) cost 12, 15/15 Space — the debuff punching bag
const HEROISM_CARD = Cards.units.sor.battlefieldMarine;
const VILLAINY_CARD = Cards.units.sor.admiralMotti;

/** Maul on the front side, P1, with `resources` resources and `hand` in hand. */
function frontSetup(hand: string[], resources = 6, discard: string[] = []) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP) // Capital City — Vigilance
    .MyLeader(Cards.leaders.hmw.maulOldMaster)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, resources);
  for (const c of hand) b = b.WithCardInHandForPlayer(1, c);
  for (const c of discard) b = b.WithCardInDiscardForPlayer(1, c);
  return b;
}

function readyResources(g: GameTestAdapter): number {
  return g.state.player1.resources.filter(r => r.ready).length;
}

function promptOptions(g: GameTestAdapter): string[] | undefined {
  const r = g.lastDispatchResponse?.resolutionNeeded;
  return r && "options" in r ? (r.options as string[]) : undefined;
}

/** The playIds a Target-style prompt is currently offering. */
function offeredPlayIds(g: GameTestAdapter): string[] | undefined {
  return (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] } | undefined)?.fromPlayIds;
}

describe("HMW_016 Maul — front Action", () => {
  it("plays a unit from hand for 1 less, then defeats it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontSetup([Cards.units.ash.deathTrooperSquad]).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    // Cost 4 - 1 = 3 paid; the unit never sticks around.
    expect(readyResources(g)).toBe(3);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(Cards.units.ash.deathTrooperSquad);
    expect(g.state.player1.leader.ready).toBe(false); // Exhaust is the cost
  });

  it("the discount is 1 at a second cost point", async () => {
    // One cost point pins a discount only loosely; a 2-cost unit paying 1 rules out every
    // constant but 1 when read with the 4 -> 3 case above.
    const g = new GameTestAdapter();
    g.loadNewState(frontSetup([Cards.units.ash.perideaBandit]).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(readyResources(g)).toBe(5); // 2 - 1 = 1 paid
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(Cards.units.ash.perideaBandit);
  });

  it("soft-passes with nothing playable — the leader still exhausts", async () => {
    // The Exhaust is the cost, so the Action is legal with an empty hand; it simply does nothing.
    const g = new GameTestAdapter();
    g.loadNewState(frontSetup([]).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("does not offer a unit that is unaffordable even at 1 less", async () => {
    // Summa-verminoth costs 12; at 11 it is still out of reach on 6 resources.
    const g = new GameTestAdapter();
    g.loadNewState(frontSetup([Cards.units.ash.summaVerminoth]).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.hand).toHaveLength(1); // still there
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("offers a unit affordable ONLY because of the discount", async () => {
    // Coastal Catamarans costs 7 against 6 resources — out of reach at full price, exactly
    // affordable at 1 less. The offer has to be priced with the discount applied, or this unit
    // is filtered out and the ability soft-passes instead.
    const g = new GameTestAdapter();
    g.loadNewState(frontSetup([Cards.units.hmw.coastalCatamarans]).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(readyResources(g)).toBe(0); // all 6 spent on 7 - 1
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(Cards.units.hmw.coastalCatamarans);
  });

  it("does not offer a non-unit card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontSetup([Cards.events.shd.daringRaid]).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("The Legacy Run for 4: its When Defeated spreads 6 damage among enemy units", async () => {
    const g = new GameTestAdapter();
    const state = frontSetup([Cards.units.lof.theLegacyRun])
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const enemy0 = state.player2.groundArena[0].playId;
    const enemy1 = state.player2.groundArena[1].playId;

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    // Cunning is covered by Maul himself, so 5 - 1 = 4.
    expect(readyResources(g)).toBe(2);
    // Playing it defeated it, so the When Defeated is waiting with 6 damage to divide.
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: enemy0, damage: 3 },
        { playId: enemy1, damage: 3 },
      ],
    });

    expect(g.state.player2.groundArena).toHaveLength(0); // two 3/3 Marines, 3 damage each
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(Cards.units.lof.theLegacyRun);
  });

  it("Anakin (Mortis) double trigger: both When Played abilities resolve after the defeat", async () => {
    const g = new GameTestAdapter();
    const state = frontSetup(
      [Cards.units.lof.anakinSkywalkerChampionOfMortis],
      6,
      [HEROISM_CARD, VILLAINY_CARD],
    )
      .WithSpaceUnitForPlayer(2, Cards.units.ash.summaVerminoth)
      .Build();
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    const played = await g.chooseCardFromHandAsync(1, 0);

    // Anakin is already in the discard — the defeat happened first, exactly as the card's
    // parenthetical says, and his two When Played abilities resolve from there.
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(Cards.units.lof.anakinSkywalkerChampionOfMortis);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(promptOptions(played)).toEqual(["heroism", "villainy"]);

    await g.chooseOptionAsync(1, "heroism");
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    const summa = Unit.FromInterface(g.state.player2.spaceArena[0]);
    expect(summa.CurrentPower()).toBe(9); // 15 - 3 - 3
    expect(summa.TotalHP()).toBe(9);
  });

  it("control: only a Heroism card in the discard gives a single –3/–3", async () => {
    // Proves the pair above is the two printed clauses, not one clause applied twice.
    const g = new GameTestAdapter();
    const state = frontSetup([Cards.units.lof.anakinSkywalkerChampionOfMortis], 6, [HEROISM_CARD])
      .WithSpaceUnitForPlayer(2, Cards.units.ash.summaVerminoth)
      .Build();
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    const played = await g.chooseCardFromHandAsync(1, 0);

    expect(promptOptions(played)).toEqual(["Yes", "No"]); // no ordering choice — one ability
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    const summa = Unit.FromInterface(g.state.player2.spaceArena[0]);
    expect(summa.CurrentPower()).toBe(12); // 15 - 3 only
    expect(summa.TotalHP()).toBe(12);
  });

  it("duplicate unique: uniqueness resolves first, and the played copy is still defeated", async () => {
    // Playing a second copy of a unique interrupts entry with the uniqueness prompt. That
    // interruption must not swallow "Then, defeat it" — keeping the copy the player chose to
    // spare would hand Maul a free unit he is never supposed to leave on the board.
    const g = new GameTestAdapter();
    const state = frontSetup([Cards.units.hmw.jaxxon])
      .WithGroundUnitForPlayer(1, Cards.units.hmw.jaxxon)
      .Build();
    g.loadNewState(state);
    const oldJaxxon = state.player1.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    // Uniqueness interrupts: choose to defeat the copy already in play.
    expect(offeredPlayIds(g)?.length).toBe(2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [oldJaxxon] });

    // Both copies are gone: one to uniqueness, the newly played one to Maul.
    expect(g.state.player1.groundArena.filter(u => u.cardId === Cards.units.hmw.jaxxon)).toHaveLength(0);
    expect(g.state.player1.discard.filter(d => d.cardId === Cards.units.hmw.jaxxon)).toHaveLength(2);
  });

  it("duplicate unique: defeating the played copy for uniqueness spares the one in play", async () => {
    // The mirror choice. Maul's defeat has nothing left to defeat, so it must not reach past the
    // unit he played and take the survivor with it.
    const g = new GameTestAdapter();
    const state = frontSetup([Cards.units.hmw.jaxxon])
      .WithGroundUnitForPlayer(1, Cards.units.hmw.jaxxon)
      .Build();
    g.loadNewState(state);
    const oldJaxxon = state.player1.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    const played = offeredPlayIds(g)!.find(id => id !== oldJaxxon)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [played] });

    const survivors = g.state.player1.groundArena.filter(u => u.cardId === Cards.units.hmw.jaxxon);
    expect(survivors).toHaveLength(1);
    expect(survivors[0].playId).toBe(oldJaxxon);
  });

  it("Epic Action: deploys at 7 resources, refused at 6", async () => {
    const gYes = new GameTestAdapter();
    gYes.loadNewState(frontSetup([], 7).Build());
    await gYes.deployLeaderAsync(1);
    expect(gYes.state.player1.leader.deployed).toBe(true);

    const gNo = new GameTestAdapter();
    gNo.loadNewState(frontSetup([], 6).Build());
    await gNo.deployLeaderAsync(1);
    expect(gNo.state.player1.leader.deployed).toBe(false);
  });
});

describe("HMW_016 Maul — deployed side", () => {
  it("has Shielded", () => {
    expect(HasShielded(Cards.leaders.hmw.maulOldMaster)).toBe(true);
  });

  it("When Deployed plays a unit defeated this phase from the discard for 5 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontSetup([Cards.units.lof.anakinSkywalkerChampionOfMortis], 7).Build());

    // Defeat Anakin this phase using the front Action (6 - 1 = 5 paid), with an empty discard so
    // neither of his When Played abilities is live and nothing else is in flight.
    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    expect(readyResources(g)).toBe(2);

    await g.dispatchAsync(2, "pass-action", {}); // P1 cannot act twice in a row
    await g.deployLeaderAsync(1);
    // The When Deployed offers exactly the unit defeated this phase, straight from the discard.
    const anakinId = g.state.player1.discard.find(d => d.cardId === Cards.units.lof.anakinSkywalkerChampionOfMortis)!.playId;
    expect(offeredPlayIds(g)).toEqual([anakinId]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [anakinId] });

    // 6 - 5 = 1 paid, so one of the two remaining resources is left ready.
    expect(readyResources(g)).toBe(1);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.lof.anakinSkywalkerChampionOfMortis)).toBe(true);
  });

  it("does not offer a unit that is merely sitting in the discard", async () => {
    // The filter is the left-play ledger, not the discard pile. A unit in the discard that the
    // ledger has no defeat for — discarded from hand, or defeated in an earlier phase, since the
    // ledger is per-phase — is not a legal choice.
    const g = new GameTestAdapter();
    g.loadNewState(frontSetup([], 7, [Cards.units.ash.deathTrooperSquad]).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.ash.deathTrooperSquad)).toBe(false);
    expect(offeredPlayIds(g)).toBeUndefined(); // no offer at all, rather than an empty one
  });

  it("declining leaves the unit in the discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontSetup([Cards.units.ash.perideaBandit], 7).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await g.deployLeaderAsync(1);

    // The offer must really be open, or "declining" it would be a silent no-op and this test
    // would pass without Maul's ability existing at all.
    const banditId = g.state.player1.discard.find(d => d.cardId === Cards.units.ash.perideaBandit)!.playId;
    expect(offeredPlayIds(g)).toEqual([banditId]);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] }); // decline

    expect(g.state.player1.discard.map(d => d.cardId)).toContain(Cards.units.ash.perideaBandit);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.ash.perideaBandit)).toBe(false);
  });
});

describe("HMW_016 Maul — the double-Anakin combo on 7 resources", () => {
  it("stacks four –3/–3 on Summa-verminoth, taking 15/15 to 3/3", async () => {
    const g = new GameTestAdapter();
    const state = frontSetup(
      [Cards.units.lof.anakinSkywalkerChampionOfMortis],
      7,
      [HEROISM_CARD, VILLAINY_CARD],
    )
      .WithSpaceUnitForPlayer(2, Cards.units.ash.summaVerminoth)
      .Build();
    g.loadNewState(state);
    const summaPlayId = state.player2.spaceArena[0].playId;

    // --- 1. Maul's front Action: play Anakin for 5 (6 - 1), defeat him, double trigger.
    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "heroism");
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    let summa = Unit.FromInterface(g.state.player2.spaceArena[0]);
    expect(summa.CurrentPower()).toBe(9); // 15 - 6
    expect(readyResources(g)).toBe(2);

    // --- 2. Deploy Maul (7 resources controlled, exhausted ones included).
    await g.dispatchAsync(2, "pass-action", {});
    await g.deployLeaderAsync(1);
    expect(g.state.player1.leader.deployed).toBe(true);

    // --- 3. When Deployed: replay that same Anakin from the discard for 1 (6 - 5).
    const anakinId = g.state.player1.discard.find(d => d.cardId === Cards.units.lof.anakinSkywalkerChampionOfMortis)!.playId;
    expect(offeredPlayIds(g)).toEqual([anakinId]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [anakinId] });
    await g.chooseOptionAsync(1, "heroism");
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    // --- 4. Four separate –3/–3 have stacked on the same unit.
    summa = Unit.FromInterface(g.state.player2.spaceArena[0]);
    expect(g.state.player2.spaceArena[0].playId).toBe(summaPlayId); // never left play
    expect(summa.CurrentPower()).toBe(3); // 15 - 12
    expect(summa.TotalHP()).toBe(3);

    // Anakin survives this time, Maul is in play with his Shield, and 5 + 1 of 7 was spent.
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.lof.anakinSkywalkerChampionOfMortis)).toBe(true);
    const maul = g.state.player1.groundArena.find(u => u.cardId === Cards.leaders.hmw.maulOldMaster)!;
    expect(maul.upgrades.some(u => u.cardId === Cards.upgrades.token.shield)).toBe(true);
    expect(readyResources(g)).toBe(1);
  });
});
