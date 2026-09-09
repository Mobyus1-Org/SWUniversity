import { describe, it, expect } from "vitest";

import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

//   ASH_093 Captain Pellaeon    — Raid 3 while a LEADER unit has been defeated this phase
//   ASH_098 AT-ST Raider        — Ambush while you control another NON-UNIQUE unit
//   ASH_113 Mandalorian Flagship — Ambush while you control a leader unit; +1/+0 per OTHER
//                                  friendly Mandalorian
//   ASH_073 Palace Chef Droid   — Sentinel; +2/+0 WHILE DEFENDING
//   ASH_065 Home One            — Sentinel

const PELLAEON = Cards.units.ash.captainPellaeon;
const RAIDER = Cards.units.ash.atStRaider;
const FLAGSHIP = Cards.units.ash.mandalorianFlagship;
const CHEF = Cards.units.ash.palaceChefDroid;
const HOME_ONE = Cards.units.ash.homeOne;
const MANDO_TOKEN = Cards.units.token.mandalorian;
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3, non-unique
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7, non-unique
const UNIQUE_UNIT = Cards.units.ash.koskaReeves;        // unique

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}

const at = (g: GameTestAdapter, p: 1 | 2, cardId: string) => {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId)!;
};

describe("ASH_093 Captain Pellaeon — Plotting from the Shadows", () => {
  it("has no Raid until a leader unit has died this phase", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, PELLAEON).Build());
    const p = at(g, 1, PELLAEON);
    expect(RaidAmount(PELLAEON, p.playId, 1)).toBe(0);
  });

  it("gains Raid 3 once a leader unit has been defeated this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, PELLAEON)
        .WithGroundUnitForPlayer(1, Cards.units.sor.wampa) // 4/5 killer
        .Build(),
    );
    // Deploy player 2's leader, then kill it.
    g.state.activePlayer = 2;
    await g.deployLeaderAsync(2);
    await g.dispatchAsync(2, "pass-action", {});
    const leaderUnit = g.state.player2.groundArena[0];
    leaderUnit.damage = 99;
    await g.attackWithGroundUnitAsync(1, 1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [leaderUnit.playId] });
    expect(g.state.player2.groundArena).toHaveLength(0);

    const p = at(g, 1, PELLAEON);
    expect(RaidAmount(PELLAEON, p.playId, 1)).toBe(3);
  });
});

describe("ASH_098 AT-ST Raider", () => {
  it("has no Ambush alone", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, RAIDER).Build());
    const r = at(g, 1, RAIDER);
    expect(HasAmbush(RAIDER, r.playId, undefined, 1)).toBe(false);
  });

  it("gains Ambush beside another NON-UNIQUE friendly unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, RAIDER).WithGroundUnitForPlayer(1, MARINE).Build());
    const r = at(g, 1, RAIDER);
    expect(HasAmbush(RAIDER, r.playId, undefined, 1)).toBe(true);
  });

  it("a UNIQUE friendly unit does not satisfy it", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, RAIDER).WithGroundUnitForPlayer(1, UNIQUE_UNIT).Build());
    const r = at(g, 1, RAIDER);
    expect(HasAmbush(RAIDER, r.playId, undefined, 1)).toBe(false);
  });

  it("an ENEMY non-unique unit does not satisfy it", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, RAIDER).WithGroundUnitForPlayer(2, MARINE).Build());
    const r = at(g, 1, RAIDER);
    expect(HasAmbush(RAIDER, r.playId, undefined, 1)).toBe(false);
  });
});

describe("ASH_113 Mandalorian Flagship", () => {
  it("is 4/8 alone", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, FLAGSHIP).Build());
    const f = Unit.FromInterface(at(g, 1, FLAGSHIP));
    expect({ p: f.CurrentPower(), h: f.TotalHP() }).toEqual({ p: 4, h: 8 });
  });

  it("gets +1/+0 per OTHER friendly Mandalorian, HP untouched", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, FLAGSHIP)
        .WithGroundUnitForPlayer(1, MANDO_TOKEN)
        .WithGroundUnitForPlayer(1, MANDO_TOKEN)
        .Build(),
    );
    const f = Unit.FromInterface(at(g, 1, FLAGSHIP));
    expect({ p: f.CurrentPower(), h: f.TotalHP() }).toEqual({ p: 6, h: 8 });
  });

  it("does not count itself or enemy Mandalorians", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithSpaceUnitForPlayer(1, FLAGSHIP).WithGroundUnitForPlayer(2, MANDO_TOKEN).Build(),
    );
    const f = Unit.FromInterface(at(g, 1, FLAGSHIP));
    expect(f.CurrentPower()).toBe(4);
  });

  it("gains Ambush while you control a leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, FLAGSHIP).Build());
    const before = at(g, 1, FLAGSHIP);
    expect(HasAmbush(FLAGSHIP, before.playId, undefined, 1)).toBe(false);

    await g.deployLeaderAsync(1);

    const after = at(g, 1, FLAGSHIP);
    expect(HasAmbush(FLAGSHIP, after.playId, undefined, 1)).toBe(true);
  });
});

describe("ASH_073 Palace Chef Droid", () => {
  it("has Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, CHEF).Build());
    const c = at(g, 1, CHEF);
    expect(HasSentinel(CHEF, c.playId, 1)).toBe(true);
  });

  it("deals 2 counter-damage while DEFENDING, despite printing no power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, CHEF)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [at(g, 1, CHEF).playId] });

    expect(at(g, 2, SECURITY).damage).toBe(2);
  });

  it("does NOT get the bonus while attacking", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, CHEF).WithGroundUnitForPlayer(2, SECURITY).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, SECURITY).playId] });

    expect(at(g, 2, SECURITY).damage).toBe(0); // it has no printed power
  });
});

describe("ASH_065 Home One", () => {
  it("has Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, HOME_ONE).Build());
    const h = at(g, 1, HOME_ONE);
    expect(HasSentinel(HOME_ONE, h.playId, 1)).toBe(true);
  });
});
