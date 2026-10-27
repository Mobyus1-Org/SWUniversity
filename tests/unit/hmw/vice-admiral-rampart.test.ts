import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_060 Vice Admiral Rampart — A New Era of Safety (Unit, cost 2, 1/5 Ground, unique,
// Vigilance/Villainy, Imperial Official) —
//   "If an upgrade on your base would be defeated, you may defeat this unit instead."
//
// An optional replacement effect, owned by Rampart's controller and limited to THEIR base. Taking
// it defeats Rampart normally and leaves the upgrade exactly where it was. A defeat paid as a COST
// ("Action [defeat this upgrade]", Vane's "[defeat a friendly upgrade]") is never offered.
//
// CR 9.2: when a replacement swaps out the text before "If you do", that text still counts as
// resolved — so Trap Field's 3 damage still lands when Rampart dies in its place, and Alliance
// Shield Generator's prevention and draw are unaffected.

const RAMPART = Cards.units.hmw.viceAdmiralRampart;
const MEMORIAL = Cards.upgrades.hmw.sinisterWarMemorial;
const FORTRESS = Cards.upgrades.hmw.verdantFortress;
const TRAP = Cards.upgrades.hmw.trapField;
const SHIELD_GEN = Cards.upgrades.hmw.allianceShieldGenerator;
const BACTA = Cards.upgrades.hmw.bactaTank;
const DOCTRINE = Cards.upgrades.hmw.tarkinDoctrine;
const CONFISCATE = Cards.events.sor.confiscate;
const XP = Cards.upgrades.token.experience;
const IMPRISONED = Cards.upgrades.shd.imprisoned;
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce; // 3/7 Ground — survives Trap Field's 3
const BIG = Cards.units.twi.tranquility;           // 7 power Space
const TURTLE = Cards.units.ash.dinosaurTurtle;     // non-Vehicle unit for Bacta Tank's recursion
const VANE = Cards.leaders.ash.vane;

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

/** P1 controls Rampart; P2 is about to act. */
function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14)
    .WithGroundUnitForPlayer(1, RAMPART)
    .WithActivePlayer(2);
}

const rampartInPlay = (g: GameTestAdapter) => g.state.player1.groundArena.some(u => u.cardId === RAMPART);
const rampartInDiscard = (g: GameTestAdapter) => g.state.player1.discard.some(c => c.cardId === RAMPART);
const baseUpgrade = (g: GameTestAdapter, player: 1 | 2, cardId: string) =>
  (player === 1 ? g.state.player1 : g.state.player2).base.upgrades?.find(u => u.cardId === cardId);
const prompt = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as
  { type?: string; helperText?: string; fromPlayIds?: string[] } | undefined;
const isRampartOffer = (g: GameTestAdapter) =>
  prompt(g)?.type === "Option" && (prompt(g)?.helperText ?? "").includes("Vice Admiral Rampart");

/** P2 plays Confiscate on the upgrade with `targetPlayId`. */
async function confiscate(g: GameTestAdapter, targetPlayId: string, player: 1 | 2 = 2) {
  const hand = (player === 1 ? g.state.player1 : g.state.player2).hand;
  await g.playCardFromHandAsync(player, hand.findIndex(c => c.cardId === CONFISCATE));
  await g.dispatchAsync(player, "choose-target", { targetPlayIds: [targetPlayId] });
}

describe("HMW_060 Vice Admiral Rampart", () => {
  describe("Confiscate on an upgrade on Rampart's base", () => {
    function board() {
      return setup()
        .WithUpgradesOnBaseForPlayer(1, [up(MEMORIAL, 1)])
        .WithCardInHandForPlayer(2, CONFISCATE);
    }

    it("offers the replacement to Rampart's controller", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().Build());

      await confiscate(g, baseUpgrade(g, 1, MEMORIAL)!.playId);

      expect(isRampartOffer(g)).toBe(true);
    });

    it("accepting defeats Rampart and the upgrade stays, untouched", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().Build());
      const memorialId = baseUpgrade(g, 1, MEMORIAL)!.playId;

      await confiscate(g, memorialId);
      expect(isRampartOffer(g)).toBe(true);
      await g.chooseYesAsync(1);

      expect(rampartInPlay(g)).toBe(false);
      expect(rampartInDiscard(g)).toBe(true);
      expect(baseUpgrade(g, 1, MEMORIAL)?.playId).toBe(memorialId);
      expect(g.state.player1.discard.some(c => c.cardId === MEMORIAL)).toBe(false);
    });

    it("declining defeats the upgrade as normal and Rampart stays", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().Build());

      await confiscate(g, baseUpgrade(g, 1, MEMORIAL)!.playId);
      expect(isRampartOffer(g)).toBe(true);
      await g.chooseNoAsync(1);

      expect(rampartInPlay(g)).toBe(true);
      expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
      expect(g.state.player1.discard.some(c => c.cardId === MEMORIAL)).toBe(true);
    });

    it("control: without Rampart the upgrade is simply defeated", async () => {
      const g = new GameTestAdapter();
      const state = board().Build();
      state.player1.groundArena = [];
      g.loadNewState(state);

      await confiscate(g, baseUpgrade(g, 1, MEMORIAL)!.playId);

      expect(prompt(g)).toBeUndefined();
      expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
      expect(g.state.player1.discard.some(c => c.cardId === MEMORIAL)).toBe(true);
    });

    it("a Rampart that lost its abilities offers nothing", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithUpgradesOnGroundUnitForPlayer(1, 0, [up(IMPRISONED, 2)]).Build());

      await confiscate(g, baseUpgrade(g, 1, MEMORIAL)!.playId);

      expect(isRampartOffer(g)).toBe(false);
      expect(rampartInPlay(g)).toBe(true);
      expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
    });

    it("can only save one upgrade — the second defeat goes through", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        board()
          .WithUpgradesOnBaseForPlayer(1, [up(MEMORIAL, 1), up(FORTRESS, 1)])
          .WithCardInHandForPlayer(2, CONFISCATE)
          .Build(),
      );

      await confiscate(g, baseUpgrade(g, 1, MEMORIAL)!.playId);
      expect(isRampartOffer(g)).toBe(true);
      await g.chooseYesAsync(1);
      expect(rampartInDiscard(g)).toBe(true);
      expect(g.state.player1.base.upgrades ?? []).toHaveLength(2);

      await g.dispatchAsync(1, "pass-action", {});
      await confiscate(g, baseUpgrade(g, 1, FORTRESS)!.playId);

      expect(isRampartOffer(g)).toBe(false);
      expect(baseUpgrade(g, 1, FORTRESS)).toBeUndefined();
      expect(baseUpgrade(g, 1, MEMORIAL)).toBeDefined();
      expect(g.state.player1.discard.some(c => c.cardId === FORTRESS)).toBe(true);
    });
  });

  describe("only upgrades on YOUR base", () => {
    it("an upgrade on a unit is defeated without an offer", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE)
          .WithUpgradesOnGroundUnitForPlayer(1, 1, [up(XP, 1)])
          .WithUpgradesOnBaseForPlayer(1, [up(MEMORIAL, 1)])
          .WithCardInHandForPlayer(2, CONFISCATE)
          .Build(),
      );

      await confiscate(g, g.state.player1.groundArena[1].upgrades[0].playId);

      expect(isRampartOffer(g)).toBe(false);
      expect(g.state.player1.groundArena[1].upgrades).toHaveLength(0);
      expect(rampartInPlay(g)).toBe(true);
      expect(baseUpgrade(g, 1, MEMORIAL)).toBeDefined();
    });

    it("an upgrade on the ENEMY base is defeated without an offer", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithUpgradesOnBaseForPlayer(2, [up(MEMORIAL, 2)])
          .WithCardInHandForPlayer(1, CONFISCATE)
          .WithActivePlayer(1)
          .Build(),
      );

      await confiscate(g, baseUpgrade(g, 2, MEMORIAL)!.playId, 1);

      expect(isRampartOffer(g)).toBe(false);
      expect(g.state.player2.base.upgrades ?? []).toHaveLength(0);
      expect(g.state.player2.discard.some(c => c.cardId === MEMORIAL)).toBe(true);
      expect(rampartInPlay(g)).toBe(true);
    });
  });

  describe("HMW_171 Trap Field defeating itself", () => {
    function board() {
      return setup()
        .WithUpgradesOnBaseForPlayer(1, [up(TRAP, 1)])
        .WithCardInHandForPlayer(2, CSF);
    }

    it("accepting: Rampart dies, the trap stays, and the 3 damage still lands (CR 9.2)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().Build());
      const trapId = baseUpgrade(g, 1, TRAP)!.playId;

      await g.playCardFromHandAsync(2, 0);
      expect(prompt(g)?.type).toBe("Option"); // the trap's own "you may"
      await g.chooseYesAsync(1);
      expect(isRampartOffer(g)).toBe(true);
      await g.chooseYesAsync(1);

      expect(rampartInDiscard(g)).toBe(true);
      expect(baseUpgrade(g, 1, TRAP)?.playId).toBe(trapId);
      expect(g.state.player2.groundArena.find(u => u.cardId === CSF)!.damage).toBe(3);
    });

    it("declining: the trap is defeated and the 3 damage lands", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().Build());

      await g.playCardFromHandAsync(2, 0);
      await g.chooseYesAsync(1);
      expect(isRampartOffer(g)).toBe(true);
      await g.chooseNoAsync(1);

      expect(rampartInPlay(g)).toBe(true);
      expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
      expect(g.state.player1.discard.some(c => c.cardId === TRAP)).toBe(true);
      expect(g.state.player2.groundArena.find(u => u.cardId === CSF)!.damage).toBe(3);
    });
  });

  describe("HMW_081 Alliance Shield Generator defeating itself", () => {
    function board() {
      return setup()
        .WithUpgradesOnBaseForPlayer(1, [up(SHIELD_GEN, 1)])
        .WithCardInDeckForPlayer(1, MARINE)
        .WithCardInDeckForPlayer(1, MARINE)
        .WithSpaceUnitForPlayer(2, BIG)
        .WithSpaceUnitForPlayer(2, BIG);
    }

    it("accepting: the hit is prevented, the card is drawn, Rampart dies and the generator stays", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().Build());
      const handBefore = g.state.player1.hand.length;
      const genId = baseUpgrade(g, 1, SHIELD_GEN)!.playId;

      await g.attackWithSpaceUnitAsync(2, 0);
      await g.chooseBaseAsync(2, 1);
      expect(isRampartOffer(g)).toBe(true);
      await g.chooseYesAsync(1);

      expect(g.state.player1.base.damage).toBe(0);
      expect(g.state.player1.hand.length).toBe(handBefore + 1);
      expect(rampartInDiscard(g)).toBe(true);
      expect(baseUpgrade(g, 1, SHIELD_GEN)?.playId).toBe(genId);
    });

    it("a saved generator prevents the NEXT big hit too", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().Build());

      await g.attackWithSpaceUnitAsync(2, 0);
      await g.chooseBaseAsync(2, 1);
      await g.chooseYesAsync(1);

      await g.dispatchAsync(1, "pass-action", {});
      await g.attackWithSpaceUnitAsync(2, 1);
      await g.chooseBaseAsync(2, 1);

      expect(g.state.player1.base.damage).toBe(0);
      expect(g.state.player1.base.upgrades ?? []).toHaveLength(0); // no Rampart this time
    });

    it("declining: the hit is prevented and the generator is defeated", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().Build());
      const handBefore = g.state.player1.hand.length;

      await g.attackWithSpaceUnitAsync(2, 0);
      await g.chooseBaseAsync(2, 1);
      expect(isRampartOffer(g)).toBe(true);
      await g.chooseNoAsync(1);

      expect(g.state.player1.base.damage).toBe(0);
      expect(g.state.player1.hand.length).toBe(handBefore + 1);
      expect(rampartInPlay(g)).toBe(true);
      expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
      expect(g.state.player1.discard.some(c => c.cardId === SHIELD_GEN)).toBe(true);
    });
  });

  it("Vane's On Attack (not a cost): Rampart may stand in, and the 'If you do' 2 damage still follows", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .MyLeader(VANE)
        .WithUpgradesOnBaseForPlayer(1, [up(MEMORIAL, 1)])
        .WithActivePlayer(1)
        .Build(),
    );
    const memorialId = baseUpgrade(g, 1, MEMORIAL)!.playId;
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});

    await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.findIndex(u => u.cardId === VANE));
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [memorialId] });
    expect(isRampartOffer(g)).toBe(true);
    await g.chooseYesAsync(1);

    expect(rampartInDiscard(g)).toBe(true);
    expect(baseUpgrade(g, 1, MEMORIAL)?.playId).toBe(memorialId);
    await g.chooseBaseAsync(1, 2); // the 2 damage is still dealt
    expect(g.state.player2.base.damage).toBe(2 + 3); // ability + Vane's combat damage
  });

  it("the uniqueness rule's defeat is a defeat too — Rampart is offered, and the rule then re-applies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithUpgradesOnBaseForPlayer(1, [up(DOCTRINE, 1)])
        .WithCardInHandForPlayer(1, DOCTRINE)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] }); // Fortify host
    const copies = (g.state.player1.base.upgrades ?? []).filter(u => u.cardId === DOCTRINE);
    expect(copies).toHaveLength(2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [copies[0].playId] });
    expect(isRampartOffer(g)).toBe(true);
    await g.chooseYesAsync(1);

    // Rampart died in its place; two copies remain, so the rule asks again — no Rampart this time.
    expect(rampartInDiscard(g)).toBe(true);
    const left = (g.state.player1.base.upgrades ?? []).filter(u => u.cardId === DOCTRINE);
    expect(left).toHaveLength(2);
    expect([...(prompt(g)?.fromPlayIds ?? [])].sort()).toEqual(left.map(u => u.playId).sort());
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [left[0].playId] });

    expect(isRampartOffer(g)).toBe(false);
    expect((g.state.player1.base.upgrades ?? []).filter(u => u.cardId === DOCTRINE)).toHaveLength(1);
    expect(g.state.player1.discard.some(c => c.cardId === DOCTRINE)).toBe(true);
  });

  describe("a defeat paid as a COST is not replaceable", () => {
    it("Bacta Tank's Action [defeat this upgrade] offers nothing", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithUpgradesOnBaseForPlayer(1, [up(BACTA, 1)])
          .WithCardInDiscardForPlayer(1, TURTLE)
          .WithActivePlayer(1)
          .Build(),
      );

      await g.dispatchAsync(1, "use-ability", { playId: baseUpgrade(g, 1, BACTA)!.playId, cardId: BACTA });

      expect(isRampartOffer(g)).toBe(false);
      expect(prompt(g)?.type).toBe("Option"); // Bacta Tank's own discard pick
      expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
      expect(g.state.player1.discard.some(c => c.cardId === BACTA)).toBe(true);
      expect(rampartInPlay(g)).toBe(true);
    });

    it("Vane's Action [defeat a friendly upgrade] offers nothing", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .MyLeader(VANE)
          .WithUpgradesOnBaseForPlayer(1, [up(MEMORIAL, 1)])
          .WithActivePlayer(1)
          .Build(),
      );

      await g.useLeaderAbilityAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [baseUpgrade(g, 1, MEMORIAL)!.playId] });

      expect(isRampartOffer(g)).toBe(false);
      expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
      expect(rampartInPlay(g)).toBe(true);
    });
  });
});

describe("\"Defeat an upgrade\" can target upgrades on bases", () => {
  it("Confiscate offers upgrades on both bases and on units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(XP, 2)])
        .WithUpgradesOnBaseForPlayer(1, [up(MEMORIAL, 1)])
        .WithUpgradesOnBaseForPlayer(2, [up(FORTRESS, 2)])
        .WithCardInHandForPlayer(2, CONFISCATE)
        .Build(),
    );

    await g.playCardFromHandAsync(2, 0);

    expect([...(prompt(g)?.fromPlayIds ?? [])].sort()).toEqual([
      baseUpgrade(g, 1, MEMORIAL)!.playId,
      baseUpgrade(g, 2, FORTRESS)!.playId,
      g.state.player2.groundArena[0].upgrades[0].playId,
    ].sort());
  });

  it("Confiscate defeats an upgrade on its own player's base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithUpgradesOnBaseForPlayer(2, [up(FORTRESS, 2)])
        .WithCardInHandForPlayer(2, CONFISCATE)
        .Build(),
    );

    await confiscate(g, baseUpgrade(g, 2, FORTRESS)!.playId);

    expect(g.state.player2.base.upgrades ?? []).toHaveLength(0);
    expect(g.state.player2.discard.some(c => c.cardId === FORTRESS)).toBe(true);
  });
});
