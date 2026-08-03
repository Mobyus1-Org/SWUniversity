import { CardInPlay, HP_MOD, PHASE_STAT_MOD, POWER_MOD, PlayerId, Unit as UnitInterface } from "@/lib/engine/core-models";
import { GetCurrentEffectsForPlayer, GetHand, GetUnitsForPlayer, GetLeaderForPlayer, GetResources, GetBaseDamage, LeaderAbilitiesIgnored, TraitContains, CardIsLeader, IsCoordinateActive, InitiativePlayer, HasTheForce, DistinctCostsInDiscard } from "@/server/engine/core-functions";
import { CardArena, CardHp, CardPower } from "@/server/engine/card-db/generated";
import { UpgradeHpOf, UpgradePowerOf } from "@/server/engine/card-db/upgrade-stats";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { CountBounties } from "@/server/engine/card-db/keyword-dictionaries.ts/bounty";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { HasGrit } from "./card-db/keyword-dictionaries.ts/grit";

/**
 * Re-entrancy guard for ASH_206 Kelleran Beq, whose power depends on other units' current power.
 * With two Kellerans in play the lookup would otherwise recurse forever; while non-zero, a nested
 * Kelleran computes its power without the "+1 per 0-power unit" term.
 */
let kelleranPowerDepth = 0;

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

  // Keep in sync with the token unit IDs spawnToken() can create in token-helpers.ts — a token
  // missing from this list is treated as a real card, so it wrongly goes to a hand/discard and
  // can be held captive.
  IsTokenUnit(): boolean {
    switch(this.cardId) {
      case "TWI_T01": //Battle Drod
      case "TWI_T02": //Clone Trooper
      case "JTL_T01": //TIE Fighter
      case "JTL_T02": //X-Wing
      case "SEC_T01": //Spy
      case "ASH_T01": //Mandalorian
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
        case "LAW_132": //The Tree Remembers
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
        case "SHD_001": // Gar Saxon (deployed) — each friendly upgraded unit gets +1/+0
          power += this.upgrades.length > 0 ? 1 : 0;
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

    power += selfStatBonus(this);
    power += friendlyAuraBonus(this);
    power -= enemyAuraDebuff(this);

    // Gar Saxon (SHD_001) grants friendly upgraded units +1/+0 from the leader zone too. When he is
    // deployed he is caught by the loop above; when undeployed his aura still applies from the zone.
    if (this.upgrades.length > 0 && !LeaderAbilitiesIgnored()) {
      const leaderCtrl = GetLeaderForPlayer(this.controller);
      if (leaderCtrl.cardId === "SHD_001" && !leaderCtrl.deployed) {
        power += 1;
      }
    }

    for(const currentEffect of GetCurrentEffectsForPlayer(this.controller)) {
      if (currentEffect.targetPlayId && currentEffect.targetPlayId !== this.playId) continue;

      switch(currentEffect.cardId) {
        case PHASE_STAT_MOD: // generic +X/+X or –X/–X for this phase
          power += currentEffect.value ?? 0;
          break;
        case POWER_MOD: // generic +X/+0 or –X/–0 (HP untouched — see TotalHP, which ignores it)
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
        case "TWI_014": power += 1; break; // Asajj Ventress +1/+0 ForAttack (event played this phase)
        case "SOR_220": power += 3; break; // Surprise Strike +3/+0 ForAttack
        case "JTL_177": power += 2; break; // Stay on Target +2/+0 ForAttack
        case "JTL_156": power += 4; break; // Trench Run +4/+0 ForAttack
        case "SOR_240": power += 2; break; // Fleet Lieutenant +2/+0 ForAttack
        case "TWI_012_action": power += 2; break; // Anakin Skywalker leader Action +2/+0 ForAttack (vs a unit)
        case "TWI_011_action": power += 1; break; // Ahsoka Tano leader Action +1/+0 for this attack
        case "SOR_012_action": power += 1; break; // IG-88 leader Action +1/+0 (more units than defender)
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

    // Doctor Aphra (deployed) — "While there are 5 or more different costs among cards in your
    // discard pile, this unit gets +3/+0."
    if (this.cardId === "SHD_015" && !this.LostAbilities() && DistinctCostsInDiscard(this.controller) >= 5) {
      power += 3;
    }

    if (this.cardId === "JTL_249" && !this.LostAbilities()) {
      power += this.upgrades.filter(upg => TraitContains(upg.cardId, "Pilot")).length;
    }

    // Resistance X-Wing — "While this unit has a Pilot on it, it gets +1/+1." (HP half in TotalHP.)
    if (this.cardId === "JTL_247" && !this.LostAbilities()
      && this.upgrades.some(upg => TraitContains(upg.cardId, "Pilot"))) {
      power += 1;
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

    power += kananSurvivalBonus(this);

    // Kit Fisto (deployed leader) — "This unit gets +1/+0 for each other friendly Jedi unit."
    if (this.cardId === "LOF_011" && !this.LostAbilities()) {
      power += GetUnitsForPlayer(this.controller)
        .filter(u => u.playId !== this.playId && TraitContains(u.cardId, "Jedi", this.controller, u.playId))
        .length;
    }

    // War Juggernaut — "This unit gets +1/+0 for each damaged unit." (Any unit in play with damage,
    // both sides, including itself.) A constant ability, so it is lost if the unit loses abilities.
    if (this.cardId === "JTL_170" && !this.LostAbilities()) {
      power += [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)].filter(u => u.damage > 0).length;
    }

    // Executor — "This unit gets +1/+0 for each upgrade on other friendly units."
    if (this.cardId === "ASH_197" && !this.LostAbilities()) {
      power += GetUnitsForPlayer(this.controller)
        .filter(u => u.playId !== this.playId)
        .reduce((sum, u) => sum + u.upgrades.length, 0);
    }

    // Qi'ra (Master of Teräs Käsi) — "This unit gets –1/–0 for each card in your hand."
    // The final Math.max keeps her from going negative on a huge hand.
    if (this.cardId === "ASH_226" && !this.LostAbilities()) {
      power -= GetHand(this.controller).length;
    }

    // Kelleran Beq — "This unit gets +1/+0 for each other unit (friendly and enemy) with 0 power."
    // Reading another unit's CurrentPower can come straight back here (two Kellerans in play), so
    // the re-entrant call is served from the flat computation instead — see kelleranPowerDepth.
    if (this.cardId === "ASH_206" && !this.LostAbilities() && kelleranPowerDepth === 0) {
      kelleranPowerDepth++;
      try {
        power += [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
          .filter(u => u.playId !== this.playId)
          .filter(u => Unit.FromInterface(u).CurrentPower() === 0)
          .length;
      } finally {
        kelleranPowerDepth--;
      }
    }

    // Mandalorian Super Commandos — "While you control a leader unit, this unit gets +2/+0."
    // A leader deployed as a Pilot upgrade is a leader UPGRADE, not a leader unit, so this only
    // looks at the cardIds of units in the arena.
    if (this.cardId === "ASH_240" && !this.LostAbilities()
      && GetUnitsForPlayer(this.controller).some(u => CardIsLeader(u.cardId))) {
      power += 2;
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

    hp += selfStatBonus(this);
    hp += friendlyAuraBonus(this);
    hp -= enemyAuraDebuff(this);

    for (const upgrade of this.upgrades) {
      hp += UpgradeHpOf(upgrade.cardId);
      // JTL_150 Biggs Darklighter — "If attached unit is a Transport, it gets +0/+1." His other
      // two conditional grants (Overwhelm on a Fighter, Grit on a Speeder) live in the keyword
      // dictionaries; this is the stat-only third.
      if (upgrade.cardId === "JTL_150" && TraitContains(this.cardId, "Transport", this.controller, this.playId)) {
        hp += 1;
      }
    }

    if (this.cardId === "SHD_056" && this.upgrades.length > 0) {
      hp += 1;
    }

    // Resistance X-Wing — "While this unit has a Pilot on it, it gets +1/+1." (Power half above.)
    if (this.cardId === "JTL_247" && !this.LostAbilities()
      && this.upgrades.some(upg => TraitContains(upg.cardId, "Pilot"))) {
      hp += 1;
    }

    if (this.cardId === "SOR_118" && !this.LostAbilities()) {
      hp += GetResources(this.controller).length; // 97th Legion
    }

    hp += kananSurvivalBonus(this);

    for (const effect of GetCurrentEffectsForPlayer(this.controller)) {
      if (effect.targetPlayId && effect.targetPlayId !== this.playId) continue;
      switch (effect.cardId) {
        case PHASE_STAT_MOD: hp += effect.value ?? 0; break; // generic +X/+X or –X/–X for this phase
        case HP_MOD: hp += effect.value ?? 0; break; // generic +0/+X or –0/–X (power untouched)
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

/** True when this unit sits in the Space arena. */
function isSpaceUnit(unit: UnitInterface): boolean {
  return (CardArena(unit.cardId) ?? "Ground") === "Space";
}

/**
 * The number of OTHER friendly space units — the count JTL_115 Clone Combat Squadron scales on
 * and the condition JTL_085 Victor Leader's aura reads.
 */
function otherFriendlySpaceUnitCount(unit: Unit): number {
  return GetUnitsForPlayer(unit.controller)
    .filter(u => u.playId !== unit.playId && isSpaceUnit(u))
    .length;
}

/**
 * Stat bonuses a unit grants ITSELF from its own printed text, returned as a single amount added
 * to both power and HP. Kept in one helper called from CurrentPower and TotalHP so a +X/+X can
 * never end up applied to only one half.
 */
function selfStatBonus(unit: Unit): number {
  if (unit.LostAbilities()) return 0;
  switch (unit.cardId) {
    // TWI_090 Echo — "Coordinate — This unit gets +2/+2." Coordinate turns on at 3+ friendly units.
    case "TWI_090":
      return IsCoordinateActive(unit.controller) ? 2 : 0;
    // JTL_115 Clone Combat Squadron — "+1/+1 for each other friendly space unit."
    case "JTL_115":
      return otherFriendlySpaceUnitCount(unit);
    default:
      return 0;
  }
}

/**
 * Stat bonuses OTHER friendly units grant `unit`, as a single amount added to both power and HP.
 * The switch-based loops above cover the older auras; new ones land here so the +X/+X halves
 * stay in lockstep. Unlike those loops, this one respects the SOURCE losing its abilities.
 *
 * JTL_085 Victor Leader — "Each other friendly space unit gets +1/+1."
 * LAW_139 Admiral Motti — "Friendly leader units get +2/+2."
 */
function friendlyAuraBonus(unit: Unit): number {
  const friendly = GetUnitsForPlayer(unit.controller);
  const active = (u: UnitInterface) => !Unit.FromInterface(u).LostAbilities();
  let bonus = 0;

  // Victor Leader: other friendly SPACE units only.
  if (isSpaceUnit(unit)) {
    bonus += friendly.filter(u => u.cardId === "JTL_085" && u.playId !== unit.playId && active(u)).length;
  }

  // Admiral Motti: friendly LEADER units. IsLeader() also covers a Vehicle carrying a pilot
  // leader — those print "Attached unit is a leader unit" on the leader's deployed side.
  if (unit.IsLeader()) {
    bonus += friendly.filter(u => u.cardId === "LAW_139" && u.playId !== unit.playId && active(u)).length * 2;
  }

  return bonus;
}

/**
 * Auras an OPPONENT's units project onto `unit` — the mirror of the friendly-aura loops in
 * CurrentPower/TotalHP, which only ever scan the unit's own controller. Returns the total amount
 * to SUBTRACT from both power and HP.
 *
 * Kept as one helper called from both stat methods so a debuff can never apply to only one half.
 * Reads nothing but cardIds and LostAbilities(), so it cannot recurse back into stat calculation.
 *
 * SHD_037 Supreme Leader Snoke — "Each enemy non-leader unit gets –2/–2." Not arena-limited: a
 * ground Snoke still shrinks enemy space units.
 */
/**
 * Cards whose mere presence shrinks the OPPONENT's units — the ones enemyAuraDebuff reads.
 * Such a unit can defeat an enemy just by arriving (one already damaged past its newly reduced
 * HP), and nothing else in the play-a-card path re-checks HP, so completePlayCard sweeps when
 * this is true. Keep in sync with enemyAuraDebuff.
 */
export function ProjectsEnemyStatAura(cardId: string): boolean {
  return cardId === "SHD_037"; // Supreme Leader Snoke — each enemy non-leader unit gets –2/–2
}

function enemyAuraDebuff(unit: Unit): number {
  if (unit.IsLeader()) return 0; // "each enemy NON-LEADER unit"
  const enemy: PlayerId = unit.controller === 1 ? 2 : 1;
  let debuff = 0;
  for (const foe of GetUnitsForPlayer(enemy)) {
    if (foe.cardId !== "SHD_037") continue;
    if (Unit.FromInterface(foe).LostAbilities()) continue;
    debuff += 2;
  }
  return debuff;
}

/**
 * LOF_004 Kanan Jarrus (deployed) — "While you control another Creature or Spectre unit, this unit
 * gets +2/+2." A while-condition, so it is worth +2 once however many such units are out.
 */
function kananSurvivalBonus(unit: Unit): number {
  if (unit.cardId !== "LOF_004" || unit.LostAbilities()) return 0;
  const hasOther = GetUnitsForPlayer(unit.controller).some(u =>
    u.playId !== unit.playId
    && (TraitContains(u.cardId, "Creature", unit.controller, u.playId)
      || TraitContains(u.cardId, "Spectre", unit.controller, u.playId)));
  return hasOther ? 2 : 0;
}
