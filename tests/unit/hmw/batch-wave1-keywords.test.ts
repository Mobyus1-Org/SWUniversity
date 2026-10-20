import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// Wave 1 — four HMW cards whose whole behaviour is a keyword that turns on from board state.
//
//   HMW_074 Yord Fandar      1/5 Ground  "While a base has 15 or more damage on it, gains Sentinel."
//   HMW_138 Commander Gree   3/6 Ground  "While there are 3 or more Command aspect icons among
//                                         friendly units (including this one) and upgrades, gains Raid 4."
//   HMW_066 Carrion Spike    3/5 Space   "Shielded. For each upgrade on your base, +1/+0 and Restore 1."
//   HMW_126 Verdant Fortress Fortify     "Attached base gains: Friendly units gain Raid 1."
const YORD = Cards.units.hmw.yordFandar;
const GREE = Cards.units.hmw.commanderGree;
const SPIKE = Cards.units.hmw.carrionSpike;
const FORTRESS = Cards.upgrades.hmw.verdantFortress;
const SHIELD_GEN = Cards.upgrades.hmw.allianceShieldGenerator; // another Fortify, to stack
const MARINE = Cards.units.sor.battlefieldMarine;

function base(myDamage = 0, theirDamage = 0) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, myDamage)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP, theirDamage)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}
const u = (g: GameTestAdapter, cardId: string) =>
  [...g.state.player1.groundArena, ...g.state.player1.spaceArena].find(x => x.cardId === cardId)!;

describe("HMW_074 Yord Fandar — Sentinel while a base is at 15 damage", () => {
  it("has no Sentinel while both bases are undamaged", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, YORD).Build());
    const yord = u(g, YORD);
    expect(HasSentinel(YORD, yord.playId, 1)).toBe(false);
  });

  it("gains Sentinel when YOUR base is at 15", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(15).WithGroundUnitForPlayer(1, YORD).Build());
    const yord = u(g, YORD);
    expect(HasSentinel(YORD, yord.playId, 1)).toBe(true);
  });

  it("gains Sentinel when the ENEMY base is at 15 — the text says 'a base'", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(0, 15).WithGroundUnitForPlayer(1, YORD).Build());
    const yord = u(g, YORD);
    expect(HasSentinel(YORD, yord.playId, 1)).toBe(true);
  });

  it("14 damage is not enough — the boundary is 15", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(14).WithGroundUnitForPlayer(1, YORD).Build());
    const yord = u(g, YORD);
    expect(HasSentinel(YORD, yord.playId, 1)).toBe(false);
  });
});

describe("HMW_138 Commander Gree — Raid 4 on 3+ Command icons", () => {
  it("counts his own icon: alone he is at 1 and has no Raid", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, GREE).Build());
    const gree = u(g, GREE);
    expect(RaidAmount(GREE, gree.playId, 1)).toBe(0);
  });

  it("gains Raid 4 at exactly 3 Command icons", () => {
    const g = new GameTestAdapter();
    // Gree (1 Command) + two Battlefield Marines (Command+Heroism = 1 Command each) = 3.
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, GREE)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(1, MARINE)
      .Build());
    const gree = u(g, GREE);
    expect(RaidAmount(GREE, gree.playId, 1)).toBe(4);
  });

  it("two icons is not enough", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, GREE)
      .WithGroundUnitForPlayer(1, MARINE)
      .Build());
    const gree = u(g, GREE);
    expect(RaidAmount(GREE, gree.playId, 1)).toBe(0);
  });

  it("counts icons on UPGRADES too", () => {
    const g = new GameTestAdapter();
    // Gree + one Marine = 2; a Command upgrade on the Marine makes the third icon.
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, GREE)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(1, 1, [
        { cardId: Cards.upgrades.jtl.dorsalTurret, playId: "up1", owner: 1, controller: 1 }, // Command
      ])
      .Build());
    const gree = u(g, GREE);
    expect(RaidAmount(GREE, gree.playId, 1)).toBe(4);
  });

  it("does not count ENEMY Command icons", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, GREE)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());
    const gree = u(g, GREE);
    expect(RaidAmount(GREE, gree.playId, 1)).toBe(0);
  });
});

describe("HMW_066 Carrion Spike — scales off upgrades on your base", () => {
  it("has Shielded", () => {
    expect(HasShielded(SPIKE)).toBe(true);
  });

  it("is a plain 3/5 with no upgrades on your base", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, SPIKE).Build());
    const spike = Unit.FromInterface(u(g, SPIKE));
    expect(spike.CurrentPower()).toBe(3);
    expect(RestoreAmount(SPIKE, u(g, SPIKE).playId, 1)).toBe(0);
  });

  it("one Fortify upgrade gives +1/+0 and Restore 1", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, SPIKE)
      .WithUpgradesOnBaseForPlayer(1, [
        { cardId: FORTRESS, playId: "f1", owner: 1, controller: 1 },
      ])
      .Build());
    const spike = Unit.FromInterface(u(g, SPIKE));
    expect(spike.CurrentPower()).toBe(4);
    expect(RestoreAmount(SPIKE, u(g, SPIKE).playId, 1)).toBe(1);
  });

  it("two Fortify upgrades give +2/+0 and Restore 2 — it scales", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, SPIKE)
      .WithUpgradesOnBaseForPlayer(1, [
        { cardId: FORTRESS, playId: "f1", owner: 1, controller: 1 },
        { cardId: SHIELD_GEN, playId: "f2", owner: 1, controller: 1 },
      ])
      .Build());
    const spike = Unit.FromInterface(u(g, SPIKE));
    expect(spike.CurrentPower()).toBe(5);
    expect(RestoreAmount(SPIKE, u(g, SPIKE).playId, 1)).toBe(2);
  });

  it("upgrades on the ENEMY base do not count — it says 'your base'", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, SPIKE)
      .WithUpgradesOnBaseForPlayer(2, [
        { cardId: FORTRESS, playId: "f1", owner: 2, controller: 2 },
      ])
      .Build());
    const spike = Unit.FromInterface(u(g, SPIKE));
    expect(spike.CurrentPower()).toBe(3);
  });
});

describe("HMW_126 Verdant Fortress — the base grants Raid 1", () => {
  it("friendly units gain Raid 1 while it is on your base", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithUpgradesOnBaseForPlayer(1, [
        { cardId: FORTRESS, playId: "f1", owner: 1, controller: 1 },
      ])
      .Build());
    const marine = u(g, MARINE);
    expect(RaidAmount(MARINE, marine.playId, 1)).toBe(1);
  });

  it("without it, the same unit has no Raid", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, MARINE).Build());
    const marine = u(g, MARINE);
    expect(RaidAmount(MARINE, marine.playId, 1)).toBe(0);
  });

  it("does not grant Raid to the enemy", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, MARINE)
      .WithUpgradesOnBaseForPlayer(1, [
        { cardId: FORTRESS, playId: "f1", owner: 1, controller: 1 },
      ])
      .Build());
    const marine = g.state.player2.groundArena[0];
    expect(RaidAmount(MARINE, marine.playId, 2)).toBe(0);
  });

  it("the Raid 1 shows up in combat: +1/+0 while attacking", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithUpgradesOnBaseForPlayer(1, [
        { cardId: FORTRESS, playId: "f1", owner: 1, controller: 1 },
      ])
      .Build());
    const marine = Unit.FromInterface(u(g, MARINE));
    expect(marine.CurrentPower(false)).toBe(3);
    expect(marine.CurrentPower(true)).toBe(4);
  });
});
