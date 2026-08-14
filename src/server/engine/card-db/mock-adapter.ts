import type { MockCard } from "@/server/engine/card-db/card-mocks";
import type { SwuCardAttributes, SwuRelation, SwuRelationList } from "@/server/engine/card-db/swu-api-types";

/**
 * Converts a mock card into the nested shape the official SWU API returns, so a mocked card is
 * processed by byte-identical code to an official one — see the parity test in
 * tests/unit/card-db/mock-adapter.test.ts.
 *
 * Every derived dictionary value (the text + epic action join, the When Played / When Defeated
 * flags, the leader-only deploy text, the comma-joined lists) therefore comes from
 * populateDictionaries rather than being re-implemented here.
 */

function relation(name: string): SwuRelation | undefined {
  if (name === "") {
    return undefined;
  }
  return { data: { attributes: { name, englishName: name, code: name } } };
}

function relationList(names: string[]): SwuRelationList | undefined {
  if (names.length === 0) {
    return undefined;
  }
  return { data: names.map((name) => ({ attributes: { name, englishName: name } })) };
}

function cardNumberOf(cardId: string): string {
  return cardId.slice(cardId.indexOf("_") + 1);
}

export function mockToSwuAttributes(cardId: string, mock: MockCard): SwuCardAttributes {
  return {
    cardId,
    title: mock.title,
    subtitle: mock.subtitle,
    cardNumber: cardNumberOf(cardId),
    cost: mock.cost,
    hp: mock.hp,
    power: mock.power,
    upgradeHp: mock.upgradeHp,
    upgradePower: mock.upgradePower,
    text: mock.text,
    epicAction: mock.epicAction,
    deployBox: mock.leaderUnitText,
    unique: mock.unique,
    rarity: relation(mock.rarity),
    type: relation(mock.type),
    type2: relation(mock.type2),
    expansion: relation(mock.set),
    aspects: relationList(mock.aspects),
    traits: relationList(mock.traits),
    arenas: relationList(mock.arena === "" ? [] : [mock.arena]),
    // generateCardImagesFromResolvedCardsAsync gates back-image download on this being truthy.
    artBack: mock.imageUrlBack === "" ? undefined : { data: { attributes: { url: mock.imageUrlBack } } },
  };
}
