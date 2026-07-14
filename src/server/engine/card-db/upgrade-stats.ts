import { CardHp, CardPower, CardType, CardUpgradeHp, CardUpgradePower } from "@/server/engine/card-db/generated";

/**
 * Power/HP an upgrade gives the unit it is attached to.
 *
 * The official card API is inconsistent for some token upgrades: it reports their buff under
 * `power`/`hp` (the fields meant for units) instead of `upgradePower`/`upgradeHp`, which leaves
 * `CardUpgradePower` at 0 for them. Advantage (ASH_T02) and the Experience reprints
 * (LAW_T02, LOF_T01, TS26_T03) all land in that hole, so fall back to the unit fields.
 *
 * Gated on cardType === "Upgrade" so a leader deployed as a pilot upgrade (cardType "Leader")
 * can never contribute its unit-side power through this path.
 */
function upgradeStat(
  cardId: string,
  upgradeValue: number,
  unitValue: number,
): number {
  if (upgradeValue !== 0) return upgradeValue;
  return CardType(cardId) === "Upgrade" ? unitValue : 0;
}

export function UpgradePowerOf(cardId: string): number {
  return upgradeStat(cardId, CardUpgradePower(cardId), CardPower(cardId));
}

export function UpgradeHpOf(cardId: string): number {
  return upgradeStat(cardId, CardUpgradeHp(cardId), CardHp(cardId));
}
