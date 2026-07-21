import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { TargetIds } from "../../test-helpers";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { playCost } from "@/server/engine/card-playability";

const SHIELD = Cards.upgrades.token.shield; // SOR_T02
const ADVANTAGE = Cards.upgrades.token.advantage; // ASH_T02

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

// ---------- When-Played upgrades ----------

describe("ASH_086 Durasteel Plating — When Played: give a Shield to attached unit", () => {
  it("gives the attached unit a Shield token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.upgrades.ash.durasteelPlating)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === SHIELD)).toBe(true);
  });
});

describe("ASH_087 Cybernetic Enhancements — When Played: draw a card", () => {
  it("draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.upgrades.ash.cyberneticEnhancements)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );
    const deckBefore = g.state.player1.deck.length;
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.deck.length).toBe(deckBefore - 1);
  });
});

describe("ASH_228 Preparation — When Played: exhaust attached unit", () => {
  it("exhausts the attached unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.upgrades.ash.preparation)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // ready
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});

describe("ASH_182 Unfettered Ambition — Advantage token per non-Advantage upgrade (incl. itself)", () => {
  it("gives 2 Advantage tokens when the unit already has one other upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.upgrades.ash.unfetteredAmbition)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(Cards.upgrades.sor.protector, 1)])
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    // Protector + Unfettered = 2 non-Advantage upgrades → 2 Advantage tokens.
    const advTokens = g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === ADVANTAGE).length;
    expect(advTokens).toBe(2);
  });
});

// ---------- Cost-reduction upgrades ----------

describe("ASH_262 Faith in the Empire — costs 1 less on an Imperial unit", () => {
  it("is 1 cheaper when an Imperial unit is in play, full price otherwise", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.ibh.blizzardForceAtst).Build()); // Imperial
    expect(playCost(g.state, 1, Cards.upgrades.ash.faithInTheEmpire)).toBe(1); // 2 - 1

    const g2 = new GameTestAdapter();
    g2.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build()); // not Imperial
    expect(playCost(g2.state, 1, Cards.upgrades.ash.faithInTheEmpire)).toBe(2);
  });
});

describe("ASH_263 The Way of the Mand'alor — costs 1 less on a Mandalorian unit", () => {
  it("is 1 cheaper with a Mandalorian unit in play", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.shd.theMandalorian).Build()); // Mandalorian
    expect(playCost(g.state, 1, Cards.upgrades.ash.theWayOfTheMandalor)).toBe(1);

    const g2 = new GameTestAdapter();
    g2.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());
    expect(playCost(g2.state, 1, Cards.upgrades.ash.theWayOfTheMandalor)).toBe(2);
  });
});

// ---------- Sentinel grants ----------

describe("Sentinel-granting upgrades", () => {
  function withUpgrade(upgradeId: string, exhausted = false) {
    const g = new GameTestAdapter();
    const s = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, !exhausted)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(upgradeId, 1)])
      .Build();
    g.loadNewState(s);
    return g.state.player1.groundArena[0];
  }

  it("ASH_198 Nowhere to Hide grants Sentinel", () => {
    const u = withUpgrade(Cards.upgrades.ash.nowhereToHide);
    expect(HasSentinel(u.cardId, u.playId, 1)).toBe(true);
  });

  it("TWI_071 Unshakeable Will grants Sentinel", () => {
    const u = withUpgrade(Cards.upgrades.twi.unshakeableWill);
    expect(HasSentinel(u.cardId, u.playId, 1)).toBe(true);
  });

  it("SEC_071 Disciples' Devotion grants Sentinel only while the unit is exhausted", () => {
    const exhausted = withUpgrade(Cards.upgrades.sec.disciplesDevotion, true);
    expect(HasSentinel(exhausted.cardId, exhausted.playId, 1)).toBe(true);
    const ready = withUpgrade(Cards.upgrades.sec.disciplesDevotion, false);
    expect(HasSentinel(ready.cardId, ready.playId, 1)).toBe(false);
  });
});

// ---------- Mark My Words ----------

describe("ASH_181 Mark My Words — attach to a damaged unit; grants Overwhelm", () => {
  it("grants Overwhelm to the attached unit", () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 1) // damaged
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(Cards.upgrades.ash.markMyWords, 1)])
      .Build();
    g.loadNewState(s);
    const u = g.state.player1.groundArena[0];
    expect(HasOverwhelm(u.cardId, u.playId, 1)).toBe(true);
  });

  it("only offers damaged units as attach targets", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithCardInHandForPlayer(1, Cards.upgrades.ash.markMyWords)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 1) // damaged (idx 0)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 0) // undamaged (idx 1)
      .Build();
    g.loadNewState(s);
    const damagedId = s.player1.groundArena[0].playId;
    const healthyId = s.player1.groundArena[1].playId;
    await g.playCardFromHandAsync(1, 0);
    const targets = TargetIds(g);
    expect(targets).toContain(damagedId);
    expect(targets).not.toContain(healthyId);
  });
});

// ---------- Bokken Saber ----------

describe("ASH_180 Bokken Saber — When Attack Ends: give an Advantage token to this unit", () => {
  it("gives the attacker an Advantage token when its attack ends", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(Cards.upgrades.ash.bokkenSaber, 1)])
      .Build();
    g.loadNewState(s);
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === ADVANTAGE)).toBe(true);
  });

  it("cannot attach to a Vehicle unit", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithCardInHandForPlayer(1, Cards.upgrades.ash.bokkenSaber)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // non-Vehicle (idx 0)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft) // Vehicle (space)
      .Build();
    g.loadNewState(s);
    const marineId = s.player1.groundArena[0].playId;
    const vehicleId = s.player1.spaceArena[0].playId;
    await g.playCardFromHandAsync(1, 0);
    const targets = TargetIds(g);
    expect(targets).toContain(marineId);
    expect(targets).not.toContain(vehicleId);
  });
});

// ---------- Blade of Talzin ----------

describe("ASH_055 Blade of Talzin — When Defeated: if on a friendly Night unit, return to hand", () => {
  it("returns to hand when its Night host unit is defeated", async () => {
    const g = new GameTestAdapter();
    const s = base()
      // Nightsister Warrior (LOF_059, Night, 2/2) attacks a 3/3 Marine and dies to the counter.
      .WithGroundUnitForPlayer(1, Cards.units.lof.nightsisterWarrior)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(Cards.upgrades.ash.bladeOfTalzin, 1)])
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // Nightsister (2 HP + Blade +1 = 3 HP) takes 3 → defeated
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.upgrades.ash.bladeOfTalzin)).toBe(true);
  });

  it("control: does NOT return when its host is not a Night unit", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not Night
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(Cards.upgrades.ash.bladeOfTalzin, 1)])
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // 4 power kills the 3(+Blade)-power Marine
      .Build();
    g.loadNewState(s);
    // Marine is 3/3 + Blade (+2/+1) = 5/4. Give the enemy enough to kill it.
    g.state.player1.groundArena[0].damage = 3; // 1 HP left after Blade's +1 → 4 HP, 3 dmg = 1 HP
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // Gamorrean counter (4) kills the Marine
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.upgrades.ash.bladeOfTalzin)).toBe(false);
  });
});

// ---------- Deadly Vulnerability ----------

describe("ASH_150 Deadly Vulnerability — double incoming damage; attacker loses Overwhelm while defending", () => {
  it("doubles combat damage the attached unit takes", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power attacker
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // 4 HP defender
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.ash.deadlyVulnerability, 1)])
      .Build();
    g.loadNewState(s);
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    // 3 combat damage doubled to 6 → the 4-HP Gamorrean Guards is defeated.
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("control: without the upgrade the 4-HP defender survives 3 damage", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
      .Build();
    g.loadNewState(s);
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena[0].damage).toBe(3); // survives
  });

  it("doubles ability damage too", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithCardInHandForPlayer(1, Cards.events.ibh.wereInTrouble) // deal 3 to a unit
      .WithSpaceUnitForPlayer(2, Cards.units.sor.redemption) // 9 HP
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.ash.deadlyVulnerability, 1)])
      .Build();
    g.loadNewState(s);
    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    expect(g.state.player2.spaceArena[0].damage).toBe(6); // 3 doubled
  });

  it("the attacker loses Overwhelm while attacking a unit with this upgrade", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.wampa) // 4 power, Overwhelm
      .WithGroundUnitForPlayer(2, Cards.units.lof.nightsisterWarrior) // 2 HP
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.ash.deadlyVulnerability, 1)])
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine) // avoid empty-deck base penalty on the WD draw
      .Build();
    g.loadNewState(s);
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    // Wampa would normally overflow 2 excess to the base; the upgrade strips Overwhelm → 0.
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("control: without the upgrade, Wampa's Overwhelm spills 2 excess to the base", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.wampa)
      .WithGroundUnitForPlayer(2, Cards.units.lof.nightsisterWarrior)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.base.damage).toBe(2); // 4 power - 2 HP = 2 excess
  });
});
