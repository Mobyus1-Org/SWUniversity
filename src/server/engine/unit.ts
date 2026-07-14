import { CardInPlay, PHASE_STAT_MOD, PlayerId, Unit as UnitInterface } from "@/lib/engine/core-models";
import { GetCurrentEffectsForPlayer, GetUnitsForPlayer, GetLeaderForPlayer, GetResources, GetBaseDamage, LeaderAbilitiesIgnored, TraitContains, CardIsLeader, IsCoordinateActive, InitiativePlayer, HasTheForce } from "@/server/engine/core-functions";
import { CardHp, CardPower } from "@/server/engine/card-db/generated";
import { UpgradeHpOf, UpgradePowerOf } from "@/server/engine/card-db/upgrade-stats";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { CountBounties } from "@/server/engine/card-db/keyword-dictionaries.ts/bounty";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { HasGrit } from "./card-db/keyword-dictionaries.ts/grit";

export class Unit implements UnitInterface {
  cardId: string;
  playId: string;
  controller: PlayerId;
  owner: PlayerId;
  ready: boolean;
  damage: number;
  upgrades: CardInPlay[];
  captives: Unit[];
  numUses: number;
  isClone: boolean;
  namedCardTitle?: string;

  constructor(cardId: string, playId: string, owner: PlayerId, isClone = false) {
    this.cardId = cardId;
    this.playId = playId;
    this.controller = owner;
    this.owner = owner;
    this.ready = false;
    this.damage = 0;
    this.upgrades = [];
    this.captives = [];
    this.numUses = 0;
    this.isClone = isClone;
  }

  static FromInterface(unit: UnitInterface): Unit {
    const newUnit = new Unit(unit.cardId, unit.playId, unit.owner, unit.isClone);
    newUnit.controller = unit.controller;
    newUnit.ready = unit.ready;
    newUnit.damage = unit.damage;
    newUnit.upgrades = unit.upgrades;
    newUnit.captives = unit.captives.map(c => Unit.FromInterface(c));
    newUnit.isClone = unit.isClone;
    newUnit.numUses = unit.numUses;
    newUnit.namedCardTitle = unit.namedCardTitle;
    return newUnit;
  }

  IsLeader(): boolean {
    return CardIsLeader(this.cardId) || this.HasPilotLeader();
  }

  HasPilotLeader(): boolean {
    const exceptions = ["JTL_013"]//Poe Dameron - I Can Fly Anything

    return this.upgrades.some(u => CardIsLeader(u.cardId) && !exceptions.includes(u.cardId));
  }

  IsTokenUnit(): boolean {
    switch(this.cardId) {
      case "TWI_T01": //Battle Drod
      case "TWI_T02": //Clone Trooper
      case "JTL_T01": //TIE Fighter
      case "JTL_T02": //X-Wing
      case "SEC_T01": //Spy
        return true;
      default: break;
    }

    return false;
  }

  IsDamaged(): boolean {
    return this.damage > 0;
  }

  LostAbilities(ignoreFirstCardId: string = ""): boolean {
    const currentEffects = GetCurrentEffectsForPlayer(this.controller);

    // Check for effects that prevent abilities
    for (const effect of currentEffects) {
      if (effect.targetPlayId && effect.targetPlayId !== this.playId) continue;

      switch (effect.cardId) {
        case "SOR_138": //Force Lightning
        case "JTL_018": //Kazuda Xiono
        case "JTL_244": //There Is No Escape
        case "LOF_202": //Mind Trick
          return true;
        default: break;
      }
    }

    // Check for upgrades that prevent abilities
    const upgrades = this.upgrades || [];
    let ignoredUpgrade = 0;
    for (const upgrade of upgrades) {
      //in case of Imprisoned, upgrade are added before all triggers, we need to ignore it for Krayt Dragon
      if(ignoreFirstCardId !== "" && upgrade.cardId === ignoreFirstCardId && ignoredUpgrade === 0) {
        ignoredUpgrade++;
        continue;
      }

      switch (upgrade.cardId) {
        case "SHD_072"://Imprisoned
        case "LOF_054"://Exiled From The Force (loses all except Grit)
          return true;
        default: break;
      }
    }

    if (this.IsLeader() && LeaderAbilitiesIgnored()) {
      return true;
    }

    return false;
  }

  CurrentPower(isAttacking: boolean = false, isDefending: boolean = false): number {
    let power = CardPower(this.cardId) || 0;
    if (this.HasUpgrade("LOF_056")) { //Size Matters Not
      power = 5;
    }

    // Check for undeployed leader abilities that grant passive power buff to this unit
    const leader = GetLeaderForPlayer(this.controller);
    if (!leader.deployed && !LeaderAbilitiesIgnored()) {
      switch (leader.cardId) {
        case "SOR_001": //Director Krennic - Aspiring to Authority
          power += this.damage > 0 ? 1 : 0;
          break;
      }
    }

    // Check for other units that buff power
    for(const unit of GetUnitsForPlayer(this.controller)) {
      const isOtherUnit = unit.playId !== this.playId;
      switch (unit.cardId) {
        case "SOR_001": //Director Krennic - Aspiring to Authority
          power += this.damage > 0 ? 1 : 0;
          break;
        case "SHD_008": //Boba Fett - Daimyo
          power += isOtherUnit && HasKeyword(this.cardId, "Any", this.playId, this.controller) ? 1 : 0;
          break;
        case "SOR_230": // General Veers — other friendly Imperial units get +1/+1
          power += isOtherUnit && TraitContains(this.cardId, "Imperial", this.controller, this.playId) ? 1 : 0;
          break;
        case "SOR_242": // General Dodonna — other friendly Rebel units get +1/+1
          power += isOtherUnit && TraitContains(this.cardId, "Rebel", this.controller, this.playId) ? 1 : 0;
          break;
        case "SOR_100": // Wedge Antilles — each friendly VEHICLE unit gets +1/+1
          power += TraitContains(this.cardId, "Vehicle", this.controller, this.playId) ? 1 : 0;
          break;
        case "TWI_094": // Shaak Ti — each friendly token unit gets +1/+0
          power += this.IsTokenUnit() ? 1 : 0;
          break;
        case "TWI_114": //Clone Commander Cody - Commanding the 212th
          power += IsCoordinateActive(this.controller) && isOtherUnit ? 1 : 0;
          break;
        case "TWI_011": // Ahsoka Tano (deployed) — Coordinate: this unit gets +2/+0
          power += (!isOtherUnit && IsCoordinateActive(this.controller)) ? 2 : 0;
          break;
        case "LOF_007": //Avar Kriss (deployed) — while the Force is with you, this unit gets +4/+0
          power += (!isOtherUnit && HasTheForce(this.controller)) ? 4 : 0;
          break;
        default: break;
      }
    }

    for(const currentEffect of GetCurrentEffectsForPlayer(this.controller)) {
      if (currentEffect.targetPlayId && currentEffect.targetPlayId !== this.playId) continue;

      switch(currentEffect.cardId) {
        case PHASE_STAT_MOD: // generic +X/+X or –X/–X for this phase
          power += currentEffect.value ?? 0;
          break;
        case "SOR_103": //Rebel Assault
          power += 1;
          break;
        case "SOR_168": //Precision Fire
          power += TraitContains(this.cardId, "Trooper", this.controller, this.playId) ? 2 : 0;
          break;
        case "SOR_227": // Snowtrooper Lieutenant
        case "SHD_236":
          power += 2;
          break;
        case "SHD_008": //Boba Fett - Daimyo
          power += 1;
          break;
        case "SOR_150": //Heroic Sacrifice
          power += 2;
          break;
        case "SHD_179": //Desperate Attack
          power += 2;
          break;
        case "SOR_106_3": power += 3; break; // Attack Pattern Delta
        case "SOR_106_2": power += 2; break;
        case "SOR_106_1": power += 1; break;
        case "SOR_092": // Overwhelming Barrage
          if (currentEffect.targetPlayId === this.playId) power += 2;
          break;
        case "JTL_106": power += 1; break; // Unity of Purpose
        case "SOR_124": power += 2; break; // Tactical Advantage +2/+2 Phase
        case "SOR_051": power -= (currentEffect.value ?? 3); break; // Luke Skywalker –3/–3 or –6/–6 Phase
        case "SOR_076": power -= 2; break; // Make an Opening –2/–2 Phase
        case "SOR_054": power -= 2; break; // Jedi Lightsaber –2/–2 Phase (conditional Force On Attack)
        case "SOR_116": power += 2; break; // Steadfast Battalion +2/+2 Phase
        case "SOR_216": power -= 4; break; // Disarm –4/+0 Phase
        case "SOR_028": power -= 4; break; // Jedha City base Epic Action –4/–0 Phase
        case "SOR_217": power += 1; break; // Shoot First +1/+0 ForAttack
        case "SOR_220": power += 3; break; // Surprise Strike +3/+0 ForAttack
        case "SOR_240": power += 2; break; // Fleet Lieutenant +2/+0 ForAttack
        case "TWI_012_action": power += 2; break; // Anakin Skywalker leader Action +2/+0 ForAttack (vs a unit)
        case "TWI_011_action": power += 1; break; // Ahsoka Tano leader Action +1/+0 for this attack
        default: break;
      }
    }

    for (const upgrade of this.upgrades) {
      power += UpgradePowerOf(upgrade.cardId);
    }

    if (this.cardId === "SHD_056" && this.upgrades.length > 0 && !this.LostAbilities()) {
      power += 1;
    }

    // Black One — "While this unit is upgraded, it gets +1/+0."
    if (this.cardId === "JTL_147" && this.upgrades.length > 0 && !this.LostAbilities()) {
      power += 1;
    }

    if (this.cardId === "JTL_249" && !this.LostAbilities()) {
      power += this.upgrades.filter(upg => TraitContains(upg.cardId, "Pilot")).length;
    }

    if (HasGrit(this.cardId, this.playId, this.controller) && !this.LostAbilities()) {
      power += this.damage;
    }

    if (!this.LostAbilities()) {
      if (this.cardId === "SOR_081" && GetResources(this.controller).length >= 6) power += 2; // Seasoned Shoretrooper
      if (this.cardId === "SOR_118") power += GetResources(this.controller).length; // 97th Legion
      if (this.cardId === "SOR_161" && InitiativePlayer() === this.controller) power += 2; // Ardent Sympathizer
      if (this.cardId === "TWI_142" && GetBaseDamage(this.controller) >= 15) power += 2; // Anakin's Interceptor
      if (this.cardId === "TWI_012") power += Math.floor(GetBaseDamage(this.controller) / 5); // Anakin Skywalker (leader unit)
    }

    if (isAttacking) {
      power += RaidAmount(this.cardId, this.playId, this.controller);
    }

    // Concord Dawn Interceptors — "This unit gets +2/+0 while defending."
    if (isDefending && this.cardId === "SHD_042" && !this.LostAbilities()) {
      power += 2;
    }

    // A unit's power can never be reduced below 0. Without this, a debuffed unit (e.g. Nowhere
    // to Hide on a 1-power unit) attacking a base would HEAL it — dealBaseDamage does `+= amount`.
    return Math.max(0, power);
  }

  CurrentHP(): number {
    return this.TotalHP() - this.damage;
  }

  TotalHP(): number {
    let hp = CardHp(this.cardId) || 0;
    if (this.HasUpgrade("LOF_056")) { //Size Matters Not
      hp = 5;
    }

    for(const unit of GetUnitsForPlayer(this.controller)) {
      const isOtherUnit = unit.playId !== this.playId;
      switch (unit.cardId) {
       case "TWI_114": //Clone Commander Cody - Commanding the 212th
          hp += IsCoordinateActive(this.controller) && isOtherUnit ? 1 : 0;
          break;
        case "TWI_007": // Captain Rex (deployed) — each other friendly Trooper unit gets +0/+1
          hp += isOtherUnit && TraitContains(this.cardId, "Trooper", this.controller, this.playId) ? 1 : 0;
          break;
        case "SOR_230": // General Veers — other friendly Imperial units get +1/+1
          hp += isOtherUnit && TraitContains(this.cardId, "Imperial", this.controller, this.playId) ? 1 : 0;
          break;
        case "SOR_242": // General Dodonna — other friendly Rebel units get +1/+1
          hp += isOtherUnit && TraitContains(this.cardId, "Rebel", this.controller, this.playId) ? 1 : 0;
          break;
        case "SOR_100": // Wedge Antilles — each friendly VEHICLE unit gets +1/+1
          hp += TraitContains(this.cardId, "Vehicle", this.controller, this.playId) ? 1 : 0;
          break;
        default: break;
       }
    }

    for (const upgrade of this.upgrades) {
      hp += UpgradeHpOf(upgrade.cardId);
    }

    if (this.cardId === "SHD_056" && this.upgrades.length > 0) {
      hp += 1;
    }

    if (this.cardId === "SOR_118" && !this.LostAbilities()) {
      hp += GetResources(this.controller).length; // 97th Legion
    }

    for (const effect of GetCurrentEffectsForPlayer(this.controller)) {
      if (effect.targetPlayId && effect.targetPlayId !== this.playId) continue;
      switch (effect.cardId) {
        case PHASE_STAT_MOD: hp += effect.value ?? 0; break; // generic +X/+X or –X/–X for this phase
        case "SOR_106_3": hp += 3; break; // Attack Pattern Delta
        case "SOR_106_2": hp += 2; break;
        case "SOR_106_1": hp += 1; break;
        case "SOR_092": // Overwhelming Barrage
          if (effect.targetPlayId === this.playId) hp += 2;
          break;
        case "SOR_124": hp += 2; break; // Tactical Advantage +2/+2 Phase
        case "SOR_051": hp -= (effect.value ?? 3); break; // Luke Skywalker –3/–3 or –6/–6 Phase
        case "SOR_076": hp -= 2; break; // Make an Opening –2/–2 Phase
        case "SOR_054": hp -= 2; break; // Jedi Lightsaber –2/–2 Phase
        case "SOR_116": hp += 2; break; // Steadfast Battalion +2/+2 Phase
        case "JTL_106": hp += 1; break; // Unity of Purpose
      }
    }

    return hp;
  }

  HasUpgrade(cardId: string): boolean {
    return this.upgrades.some(u => u.cardId === cardId);
  }

  HasBounty(): boolean {
    if (CountBounties(this.cardId) > 0) return true;
    if (this.upgrades.some(u => CountBounties(u.cardId) > 0)) return true;
    for (const effect of GetCurrentEffectsForPlayer(this.controller)) {
      if (effect.targetPlayId && effect.targetPlayId !== this.playId) continue;

      switch (effect.cardId) {
        case "SHD_006"://Jabba The Hutt - His High Exaltness's
          return true;
        default: break;
      }
    }

    return false;
  }

  CanUseLimitedAbility(): boolean {
    return this.numUses > 0;
  }
}